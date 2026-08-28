"""Run without Docker: python -m unittest discover -s scripts/tests -v."""
import argparse
import importlib.util
from pathlib import Path
import tempfile
import subprocess
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location('server', Path(__file__).resolve().parents[1] / 'server.py')
server = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(server)


class ServerDeploymentTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.state = Path(self.temp.name)
        patcher = patch.object(server, 'STATE', self.state)
        patcher.start()
        self.addCleanup(patcher.stop)
        self.args = argparse.Namespace(domain='staging.school.ir', rtc_domain='rtc-staging.school.ir',
                                       public_ip='8.8.8.8', edge='external')

    def initialize(self):
        server.initialize('staging', self.args)
        return server.read_env(self.state / 'staging.env')

    def test_init_is_complete_and_cannot_overwrite_secrets(self):
        values = self.initialize()
        server.validate(values, 'staging')
        original = (self.state / 'staging.env').read_bytes()
        with self.assertRaises(server.DeployError):
            self.initialize()
        self.assertEqual((self.state / 'staging.env').read_bytes(), original)

    def test_production_has_distinct_secrets_ports_and_domains(self):
        stage = self.initialize()
        self.args.domain, self.args.rtc_domain = 'app.school.ir', 'rtc.school.ir'
        server.initialize('production', self.args)
        prod = server.read_env(self.state / 'production.env')
        server.validate(prod, 'production')
        server.check_other_environment(prod, 'production')
        self.assertNotEqual(prod['DB_PASSWORD'], stage['DB_PASSWORD'])
        self.assertNotEqual(prod['RTC_UDP_PORT'], stage['RTC_UDP_PORT'])

    def test_environment_mismatch_and_conflicting_domains_are_rejected(self):
        values = self.initialize()
        with self.assertRaises(server.DeployError):
            server.validate(values, 'production')
        values['DEPLOY_ENV'] = 'production'
        with self.assertRaises(server.DeployError):
            server.check_other_environment(values, 'production')

    def test_parser_never_evaluates_shell_or_compose_expansions(self):
        path = self.state / 'bad.env'
        for content in ('KEY=$(touch something)', 'KEY=`whoami`', 'KEY=${SECRET}', 'KEY=one\nKEY=two'):
            with self.subTest(content=content):
                path.write_text(content)
                with self.assertRaises(server.DeployError):
                    server.read_env(path)

    def test_invalid_network_and_secrets_fail_before_docker(self):
        values = self.initialize()
        for key, value in (('PUBLIC_IP', '192.168.1.7'), ('RTC_DOMAIN', 'https://rtc.school.ir'),
                           ('SECRET_KEY', 'short'), ('RTC_UDP_PORT', '443'),
                           ('LIVEKIT_IMAGE', 'livekit/livekit-server:latest')):
            with self.subTest(key=key), self.assertRaises(server.DeployError):
                server.validate({**values, key: value}, 'staging')

    def test_generated_livekit_config_has_no_windows_address_or_secret(self):
        values = self.initialize()
        server.render(values, self.state / 'staging')
        config = (self.state / 'staging/livekit.yaml').read_text()
        self.assertIn('http://backend:8000/api/recordings/webhook/', config)
        self.assertIn('udp_port: 7882', config)
        self.assertNotIn('host.docker.internal', config)
        self.assertNotIn(values['LIVEKIT_API_SECRET'], config)

    def test_no_implicit_production_or_docker_on_non_linux(self):
        with patch.object(server.sys, 'platform', 'linux'), patch.object(server.sys, 'argv',
                ['server.py', 'deploy', 'production']), self.assertRaises(server.DeployError):
            server.main()

    def test_deploy_requires_explicit_interruption_before_build(self):
        self.initialize()
        deployment = server.Deployment('staging')
        with patch.object(deployment, 'dns_check'), patch.object(deployment, 'port_check'), patch.object(deployment, 'running', return_value={'backend'}), \
                patch.object(deployment, 'compose') as compose, self.assertRaises(server.DeployError):
            deployment.deploy()
        compose.assert_not_called()

    def test_environment_overrides_ambient_compose_and_local_urls(self):
        self.initialize()
        deployment = server.Deployment('staging')
        with patch.dict(server.os.environ, {'COMPOSE_PROFILES': 'unrelated', 'APP_DOMAIN': 'wrong.ir'}):
            env = deployment.environment()
        self.assertNotIn('COMPOSE_PROFILES', env)
        self.assertEqual(env['APP_DOMAIN'], 'staging.school.ir')

    def test_failed_migration_never_starts_public_services_or_records_success(self):
        self.initialize()
        deployment = server.Deployment('staging')
        deployment.directory.mkdir(parents=True)

        def compose(*args, **kwargs):
            if 'migrate' in args:
                raise server.DeployError('migration failed')

        with patch.object(deployment, 'dns_check'), patch.object(deployment, 'port_check'), \
                patch.object(deployment, 'network'), patch.object(deployment, 'running', return_value={'db'}), \
                patch.object(deployment, 'run', return_value=subprocess.CompletedProcess([], 0, b'a' * 40)), \
                patch.object(deployment, 'compose', side_effect=compose), \
                patch.object(deployment, 'backup') as backup, \
                patch.object(deployment, 'configure_edge') as edge, \
                self.assertRaises(server.DeployError):
            deployment.deploy()
        # Even an interrupted first deployment without a manifest gets a backup.
        backup.assert_called_once()
        edge.assert_not_called()
        self.assertFalse(deployment.manifest.exists())

    def test_failed_backup_has_no_complete_marker(self):
        self.initialize()
        deployment = server.Deployment('staging')
        with patch.object(deployment, 'compose', side_effect=server.DeployError('dump failed')), \
                self.assertRaises(server.DeployError):
            deployment.backup()
        self.assertFalse(list(deployment.directory.glob('backups/*/COMPLETE')))


if __name__ == '__main__':
    unittest.main()
