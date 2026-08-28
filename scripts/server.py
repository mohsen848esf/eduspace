#!/usr/bin/env python3
"""Manual Linux deployment; stdlib only. No CI, registry account, sudo or git pull."""
import argparse
from contextlib import contextmanager
from datetime import datetime, timezone
import errno
import ipaddress
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import socket
import subprocess
import sys
import time
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
STATE = ROOT / '.deploy'
ENVIRONMENTS = ('staging', 'production')
PORTS = ('WEB_PORT', 'RTC_HTTP_PORT', 'RTC_TCP_PORT', 'RTC_UDP_PORT', 'TURN_UDP_PORT')
DOMAINS = ('APP_DOMAIN', 'RTC_DOMAIN')
IDENTITY = ('DB_NAME', 'DB_USER', 'DB_PASSWORD')
SERVICES = ('db', 'redis', 'backend', 'worker', 'beat', 'web', 'livekit', 'egress', 'gotenberg')
WRITERS = ('web', 'beat', 'worker', 'egress', 'livekit', 'backend')


class DeployError(Exception):
    pass


def read_env(path):
    """A deliberately small dotenv subset. Never source/eval operator input."""
    result = {}
    if not path.is_file():
        raise DeployError(f'Missing {path}. Run init first.')
    for number, raw in enumerate(path.read_text(encoding='utf-8-sig').splitlines(), 1):
        line = raw.strip()
        if not line or line.startswith('#'):
            continue
        key, sep, value = line.partition('=')
        if not sep or not re.fullmatch(r'[A-Z][A-Z0-9_]*', key) or key in result:
            raise DeployError(f'Invalid or duplicate key in {path.name}, line {number}.')
        if value[:1] in ('"', "'"):
            if len(value) < 2 or value[-1] != value[0]:
                raise DeployError(f'Unclosed quote on line {number}.')
            value = value[1:-1]
        if any(c in value for c in ('$','`','\x00','\r','\n')):
            raise DeployError(f'Interpolation/control characters are not supported on line {number}.')
        if '#' in value or value != value.strip():
            raise DeployError(f'Inline comments/edge whitespace are not supported on line {number}.')
        result[key] = value
    return result


def validate(values, target):
    required = (*DOMAINS, *PORTS, 'DEPLOY_ENV', 'PUBLIC_IP', 'EDGE_MODE',
                'SECRET_KEY', *IDENTITY, 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET')
    for key in required:
        if not values.get(key) or 'GENERATED_BY_INIT' in values[key]:
            raise DeployError(f'{key} is missing. Use init to generate a complete configuration.')
    if values['DEPLOY_ENV'] != target:
        raise DeployError('Environment mismatch: refusing to operate on another environment.')
    for key in DOMAINS:
        if not re.fullmatch(r'(?=.{1,253}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?', values[key]):
            raise DeployError(f'{key} must be a lowercase DNS hostname without a URL/path/port.')
        if '.' not in values[key] or values[key].endswith('.example.com') or '..' in values[key]:
            raise DeployError(f'Set a real {key}, not the example domain.')
    if values['APP_DOMAIN'] == values['RTC_DOMAIN']:
        raise DeployError('APP_DOMAIN and RTC_DOMAIN must be different.')
    try:
        address = ipaddress.IPv4Address(values['PUBLIC_IP'])
        if not address.is_global:
            raise ValueError()
    except ValueError:
        raise DeployError('PUBLIC_IP must be the public IPv4 address reachable by browsers.') from None
    if values['EDGE_MODE'] not in ('caddy', 'external'):
        raise DeployError('EDGE_MODE must be caddy or external.')
    for key in PORTS:
        if not values[key].isdigit() or not 1024 <= int(values[key]) <= 65535:
            raise DeployError(f'{key} must be a port between 1024 and 65535.')
    if len({values[k] for k in PORTS}) != len(PORTS):
        raise DeployError('Use distinct port numbers in the server env file.')
    for key in ('DB_NAME', 'DB_USER', 'LIVEKIT_API_KEY'):
        if not re.fullmatch(r'[A-Za-z][A-Za-z0-9_-]{0,62}', values[key]):
            raise DeployError(f'{key} must be an identifier (letters, digits, dash, underscore).')
    for key in ('SECRET_KEY', 'DB_PASSWORD', 'LIVEKIT_API_SECRET'):
        if len(values[key]) < 32 or 'change' in values[key].lower() or values[key].startswith('replace-'):
            raise DeployError(f'{key} must be a new random secret of at least 32 characters.')
    # A narrower format keeps YAML/Compose/env parsing unambiguous for core secrets.
    for key in ('DB_PASSWORD', 'LIVEKIT_API_SECRET', 'SECRET_KEY'):
        if not re.fullmatch(r'[A-Za-z0-9_-]+', values[key]):
            raise DeployError(f'Use generated alphanumeric secrets for {key}.')
    for key in ('LIVEKIT_IMAGE', 'EGRESS_IMAGE'):
        if not re.fullmatch(r'[a-z0-9./_-]+:[A-Za-z0-9._-]+', values.get(key, '')):
            raise DeployError(f'{key} must specify an explicit image tag.')
        if values[key].endswith(':latest'):
            raise DeployError(f'{key}: choose a fixed version, not latest.')


def check_other_environment(values, target):
    other = 'production' if target == 'staging' else 'staging'
    path = STATE / f'{other}.env'
    if path.exists():
        other_values = read_env(path)
        for key in DOMAINS:
            if values[key] in [other_values.get(k) for k in DOMAINS]:
                raise DeployError('Staging and production must use different domains.')
        if {values[k] for k in PORTS} & {other_values.get(k) for k in PORTS}:
            raise DeployError('Staging and production must use different host ports.')
        for key in ('SECRET_KEY', 'DB_PASSWORD', 'LIVEKIT_API_SECRET'):
            if values[key] == other_values.get(key):
                raise DeployError(f'Staging and production must not share {key}.')


def write_private(path, content):
    path.parent.mkdir(parents=True, exist_ok=True)
    # No symlink following or partially-written configuration.
    if path.is_symlink():
        raise DeployError(f'Refusing a symlink: {path}')
    temp = path.with_name(path.name + '.tmp')
    with open(temp, 'x', encoding='utf-8', newline='\n') as stream:
        os.chmod(temp, 0o600)
        stream.write(content)
    temp.replace(path)


def initialize(target, args):
    STATE.mkdir(mode=0o700, parents=True, exist_ok=True)
    env_path = STATE / f'{target}.env'
    if env_path.exists():
        raise DeployError(f'{env_path} already exists; edit it instead. Secrets were not changed.')
    template = (ROOT / 'infra/server/.env.example').read_text(encoding='utf-8')
    values = {
        'DEPLOY_ENV': target,
        'APP_DOMAIN': args.domain or input('Application hostname (e.g. staging.yourdomain.ir): ').strip(),
        'RTC_DOMAIN': args.rtc_domain or input('LiveKit hostname (e.g. rtc-staging.yourdomain.ir): ').strip(),
        'PUBLIC_IP': args.public_ip or input('Server public IPv4 address: ').strip(),
        'EDGE_MODE': args.edge,
        'SECRET_KEY': secrets.token_hex(32), 'DB_PASSWORD': secrets.token_hex(32),
        'LIVEKIT_API_KEY': 'edu' + secrets.token_hex(8), 'LIVEKIT_API_SECRET': secrets.token_hex(32),
    }
    if target == 'production':
        values.update(dict(zip(PORTS, ('8081', '7890', '7891', '7892', '3479'))))
    for key, value in values.items():
        # Validate interactive input BEFORE it can become another env line.
        if any(c in value for c in '\r\n'):
            raise DeployError('Configuration values must be a single line.')
        template = re.sub(rf'^{key}=.*$', lambda match: f'{key}={value}', template, flags=re.MULTILINE)
    temporary = STATE / f'{target}.init.env'
    write_private(temporary, template)
    try:
        parsed = read_env(temporary)
        validate(parsed, target)
        check_other_environment(parsed, target)
        temporary.replace(env_path)
    finally:
        if temporary.exists():
            temporary.unlink()
    print(f'Created {env_path}. Secrets were generated and not printed.')
    print('Set DNS, open the documented media ports, then run check and deploy.')


def render(values, config_dir):
    config_dir.mkdir(parents=True, exist_ok=True)
    # Not secret: signing credentials remain injected by Compose.
    config = (
        'port: 7880\nrtc:\n'
        f"  tcp_port: {values['RTC_TCP_PORT']}\n  udp_port: {values['RTC_UDP_PORT']}\n"
        f"  node_ip: {values['PUBLIC_IP']}\n  use_external_ip: false\n  advertise_internal_ip: true\n"
        'redis:\n  address: redis:6379\n'
        f"turn:\n  enabled: true\n  udp_port: {values['TURN_UDP_PORT']}\n"
        f"webhook:\n  api_key: {values['LIVEKIT_API_KEY']}\n"
        '  urls:\n    - http://backend:8000/api/recordings/webhook/\n'
    )
    write_private(config_dir / 'livekit.yaml', config)
    # Non-root upstream containers must be able to read this non-secret file.
    os.chmod(config_dir / 'livekit.yaml', 0o644)


class Deployment:
    def __init__(self, target):
        self.target = target
        self.env_path = STATE / f'{target}.env'
        self.values = read_env(self.env_path)
        validate(self.values, target)
        check_other_environment(self.values, target)
        self.directory = STATE / target
        self.manifest = self.directory / 'release.json'
        self.previous = json.loads(self.manifest.read_text()) if self.manifest.exists() else {}
        self.release = self.previous.get('release', 'initial')

    def environment(self):
        env = {k: v for k, v in os.environ.items() if not k.startswith('COMPOSE_')}
        env.update(self.values)
        env.update(SERVER_ENV_FILE=str(self.env_path), SERVER_CONFIG_DIR=str(self.directory),
                   RELEASE_ID=self.release, COMPOSE_IGNORE_ORPHANS='true')
        return env

    def run(self, args, capture=False, stdout=None, check=True):
        result = subprocess.run(args, cwd=ROOT, env=self.environment(), check=False,
                                stdout=subprocess.PIPE if capture else stdout,
                                stderr=subprocess.PIPE if capture else None)
        if check and result.returncode:
            # Never print subprocess env or a resolved Compose configuration.
            raise DeployError(f'Command failed ({args[0]} {args[1]}), exit {result.returncode}. See output above.')
        return result

    def compose(self, *args, **kwargs):
        return self.run(['docker', 'compose', '--project-name', f'eduspace-{self.target}',
                         '--env-file', str(self.env_path), '-f', 'compose.server.yml', *args], **kwargs)

    def edge(self, *args, **kwargs):
        return self.run(['docker', 'compose', '--project-name', 'eduspace-edge',
                         '-f', 'compose.edge.yml', *args], **kwargs)

    def running(self):
        result = self.compose('ps', '--status', 'running', '--services', capture=True)
        return set(result.stdout.decode().split())

    def prepare(self):
        if not shutil.which('docker'):
            raise DeployError('Docker with the Compose plugin is required.')
        self.run(['docker', 'info'], capture=True)
        result = self.run(['docker', 'compose', 'version', '--short'], capture=True)
        version = re.match(r'v?(\d+)\.(\d+)', result.stdout.decode().strip())
        if not version or tuple(map(int, version.groups())) < (2, 24):
            raise DeployError('Docker Compose 2.24 or newer is required.')
        render(self.values, self.directory)
        self.compose('config', '--quiet')

    def dns_check(self):
        for key in DOMAINS:
            domain = self.values[key]
            try:
                addresses = socket.gethostbyname_ex(domain)[2]
            except OSError:
                raise DeployError(f'DNS does not resolve: {domain}') from None
            if self.values['PUBLIC_IP'] not in addresses:
                raise DeployError(f'{domain} must resolve directly to PUBLIC_IP (DNS-only, no HTTP CDN proxy).')
        print('DNS OK. Also remove stale AAAA records unless IPv6 is configured.')

    def network(self):
        if self.run(['docker', 'network', 'inspect', 'eduspace-edge'], capture=True, check=False).returncode:
            self.run(['docker', 'network', 'create', 'eduspace-edge'])

    def port_check(self):
        running = self.running()
        requested = []
        if 'web' not in running:
            requested.append(('127.0.0.1', int(self.values['WEB_PORT']), socket.SOCK_STREAM))
        if 'livekit' not in running:
            requested.extend([
                ('127.0.0.1', int(self.values['RTC_HTTP_PORT']), socket.SOCK_STREAM),
                ('0.0.0.0', int(self.values['RTC_TCP_PORT']), socket.SOCK_STREAM),
                ('0.0.0.0', int(self.values['RTC_UDP_PORT']), socket.SOCK_DGRAM),
                ('0.0.0.0', int(self.values['TURN_UDP_PORT']), socket.SOCK_DGRAM),
            ])
        if self.values['EDGE_MODE'] == 'caddy':
            edge = self.edge('ps', '--status', 'running', '--services', capture=True)
            if 'edge' not in edge.stdout.decode().split():
                requested.extend([('0.0.0.0', 80, socket.SOCK_STREAM), ('0.0.0.0', 443, socket.SOCK_STREAM)])
        for host, port, kind in requested:
            with socket.socket(socket.AF_INET, kind) as probe:
                try:
                    probe.bind((host, port))
                except OSError as error:
                    if error.errno == errno.EACCES:
                        # An unprivileged operator may not bind 80/443 even though
                        # Docker can publish them. Still detect an existing listener.
                        if kind == socket.SOCK_STREAM:
                            probe.settimeout(1)
                            if probe.connect_ex(('127.0.0.1', port)) != 0:
                                continue
                    raise DeployError(f'Port {port} is occupied. For existing HTTPS servers use EDGE_MODE=external; do not stop unrelated sites.') from None

    def configure_edge(self):
        if self.values['EDGE_MODE'] != 'caddy':
            print('External proxy mode: configure HTTPS/WSS using docs/DEPLOY.fa.md.')
            return
        edge_directory = STATE / 'edge'
        edge_directory.mkdir(parents=True, exist_ok=True)
        site = edge_directory / f'{self.target}.caddy'
        old_content = site.read_text() if site.exists() else None
        content = (
            f"{self.values['APP_DOMAIN']} {{\n"
            f'    reverse_proxy eduspace-{self.target}-web:80\n}}\n'
            f"{self.values['RTC_DOMAIN']} {{\n"
            f'    reverse_proxy eduspace-{self.target}-rtc:7880\n}}\n'
        )
        write_private(site, content)
        os.chmod(site, 0o644)
        try:
            self.edge('run', '--rm', '--no-deps', 'edge', 'caddy', 'validate', '--config', '/etc/caddy/Caddyfile', '--adapter', 'caddyfile')
            self.edge('up', '-d')
            self.edge('exec', '-T', 'edge', 'caddy', 'reload', '--config', '/etc/caddy/Caddyfile', '--adapter', 'caddyfile')
        except DeployError:
            if old_content is None:
                site.unlink()
            else:
                write_private(site, old_content)
                os.chmod(site, 0o644)
            raise

    def backup(self):
        stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
        destination = self.directory / 'backups' / stamp
        destination.mkdir(mode=0o700, parents=True)
        try:
            with open(destination / 'database.dump', 'wb') as stream:
                self.compose('exec', '-T', 'db', 'pg_dump', '-U', self.values['DB_USER'],
                             '-d', self.values['DB_NAME'], '-Fc', stdout=stream)
            archive_code = (
                "import sys,tarfile; t=tarfile.open(fileobj=sys.stdout.buffer,mode='w|gz'); "
                "t.add('/app/media',arcname='media'); "
                "t.add('/app/private_media',arcname='private_media'); t.close()"
            )
            with open(destination / 'files.tar.gz', 'wb') as stream:
                self.compose('run', '--rm', '--no-deps', '-T', 'backend', 'python', '-c', archive_code, stdout=stream)
            shutil.copyfile(self.env_path, destination / 'server.env')
            if self.manifest.exists():
                shutil.copyfile(self.manifest, destination / 'release.json')
            write_private(destination / 'COMPLETE', 'Database and files copied while application writers were stopped.\n')
            print(f'Backup complete: {destination}. Copy it securely OFF this server.')
        except Exception:
            print(f'INCOMPLETE backup: {destination}; do not use it for restore.', file=sys.stderr)
            raise

    def deploy(self, allow_interruption=False):
        self.dns_check()
        self.port_check()
        running = self.running()
        if running & set(WRITERS) and not allow_interruption:
            raise DeployError('This interrupts running classes. Retry outside class hours with --allow-interruption.')
        previous_env = self.directory / 'deployed.env'
        if previous_env.exists():
            old = read_env(previous_env)
            if any(old.get(key) != self.values[key] for key in IDENTITY):
                raise DeployError('DB identity changed. Existing PostgreSQL volumes do not adopt new env credentials. Restore the previous env first.')
        revision = self.run(['git', 'rev-parse', 'HEAD'], capture=True).stdout.decode().strip()
        old_release = self.release
        self.release = f"{revision[:12]}-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
        # Complete expensive/fallible builds before stopping the previous release.
        self.compose('build', 'backend', 'web')
        self.compose('pull', 'db', 'redis', 'livekit', 'egress', 'gotenberg')
        self.network()
        if running & set(WRITERS):
            self.compose('stop', *WRITERS)
        self.compose('up', '-d', '--wait', '--wait-timeout', '180', 'db', 'redis', 'gotenberg')
        self.compose('run', '--rm', '--no-deps', 'init-storage')
        new_release = self.release
        self.release = old_release if self.previous else new_release
        try:
            # Also protect stopped volumes and interrupted first deployments.
            # A first installation simply gets a small pre-migration backup.
            self.backup()
        finally:
            self.release = new_release
        self.compose('run', '--rm', '--no-deps', 'backend', 'python', 'manage.py', 'check', '--deploy')
        self.compose('run', '--rm', '--no-deps', 'backend', 'python', 'manage.py', 'migrate', '--noinput')
        self.compose('run', '--rm', '--no-deps', 'backend', 'python', 'manage.py', 'collectstatic', '--noinput')
        self.compose('up', '-d', '--wait', '--wait-timeout', '240')
        self.compose('exec', '-T', 'worker', 'celery', '-A', 'config', 'inspect', 'ping', '--timeout=10')
        self.configure_edge()
        write_private(self.manifest, json.dumps({'release': self.release, 'commit': revision,
                      'environment': self.target, 'previous_release': old_release}, indent=2) + '\n')
        write_private(previous_env, self.env_path.read_text(encoding='utf-8'))
        print(f'Containers are running: https://{self.values["APP_DOMAIN"]}')
        self.smoke()
        print('HTTPS and services checked. Manually test two-user video, upload and recording before real use.')

    def smoke(self):
        for domain, path in ((self.values['APP_DOMAIN'], '/'), (self.values['RTC_DOMAIN'], '/')):
            deadline = time.monotonic() + 90
            while True:
                try:
                    with urllib.request.urlopen(f'https://{domain}{path}', timeout=10) as response:
                        if response.status != 200:
                            raise OSError('Unexpected HTTP status')
                    break
                except OSError:
                    if time.monotonic() >= deadline:
                        raise DeployError(f'HTTPS check failed for {domain}. Check DNS/certificates/proxy, then run check again. Containers are left running.') from None
                    time.sleep(3)


@contextmanager
def deployment_lock():
    # Global lock also protects the shared ingress from concurrent stage/prod updates.
    import fcntl
    STATE.mkdir(mode=0o700, parents=True, exist_ok=True)
    with open(STATE / 'operation.lock', 'a') as stream:
        try:
            fcntl.flock(stream, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise DeployError('Another deployment operation is running. Try again later.') from None
        yield


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=('init', 'check', 'deploy', 'status', 'logs', 'admin', 'backup'))
    parser.add_argument('environment', choices=ENVIRONMENTS)
    parser.add_argument('--domain')
    parser.add_argument('--rtc-domain')
    parser.add_argument('--public-ip')
    parser.add_argument('--edge', choices=('caddy', 'external'), default='caddy')
    parser.add_argument('--service', choices=SERVICES)
    parser.add_argument('--confirm-production', action='store_true')
    parser.add_argument('--allow-interruption', action='store_true')
    args = parser.parse_args()
    if sys.platform != 'linux':
        raise DeployError('Run this command on the Linux server, not on your local development machine.')
    if args.environment == 'production' and args.action in ('init', 'deploy', 'admin', 'backup') and not args.confirm_production:
        raise DeployError('Production requires --confirm-production. Nothing was changed.')
    os.umask(0o077)
    with deployment_lock():
        if args.action == 'init':
            initialize(args.environment, args)
            return
        deployment = Deployment(args.environment)
        deployment.prepare()
        if args.action == 'deploy':
            deployment.deploy(args.allow_interruption)
        elif args.action == 'check':
            deployment.dns_check()
            deployment.port_check()
            if deployment.previous:
                deployment.smoke()
            print('Configuration checks passed. Firewall and real WebRTC still require external testing.')
        elif args.action == 'status':
            deployment.compose('ps')
            print(json.dumps(deployment.previous, indent=2))
        elif args.action == 'logs':
            deployment.compose('logs', '--tail=100', *([args.service] if args.service else []))
        elif args.action == 'admin':
            deployment.compose('exec', 'backend', 'python', 'manage.py', 'createsuperuser')
        elif args.action == 'backup':
            if not deployment.previous:
                raise DeployError('No successful deployment to back up.')
            if not args.allow_interruption:
                raise DeployError('Backup pauses application writers. Pass --allow-interruption outside class hours.')
            running = deployment.running() & set(WRITERS)
            deployment.compose('stop', *WRITERS)
            try:
                deployment.backup()
            finally:
                if running:
                    deployment.compose('start', *sorted(running))


if __name__ == '__main__':
    try:
        main()
    except (DeployError, OSError, KeyboardInterrupt) as error:
        print(f'ERROR: {error}', file=sys.stderr)
        sys.exit(1)
