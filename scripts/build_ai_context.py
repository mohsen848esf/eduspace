"""
Regenerate the four AI-context snapshots used to brief external LLMs
that can't read the repo directly.

Outputs (gitignored):
  ai-context.frontend.md
  ai-context.backend.md
  ai-context.project.md
  ai-context.tasks.md

Run from the project root:
    backend\\venv\\Scripts\\python.exe scripts\\build_ai_context.py

The script reads files lazily and writes one line per file in the
shape:
    > One-line description of what this file does
    `relative/path/to/file.ext`
    ```ext
    ...file contents...
    ```

Skips dependencies, build artefacts, media, and binary blobs. The list
of skip globs is configurable below — keep them tight, the docs are
meant to be small enough for a chat window.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Iterable

ROOT = Path(__file__).resolve().parent.parent

SKIP_DIR_NAMES = {
    "node_modules",
    "dist",
    "build",
    "venv",
    ".venv",
    "__pycache__",
    ".git",
    ".kiro",
    ".vscode",
    ".cursor",
    "media",
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache",
}

SKIP_FILE_GLOBS = {
    "*.pyc",
    "*.lock",
    "*.log",
    "*.sqlite3",
    "*.db",
    "*.png",
    "*.jpg",
    "*.jpeg",
    "*.gif",
    "*.webp",
    "*.svg",
    "*.ico",
    "*.mp4",
    "*.mp3",
    "*.wav",
    "*.woff",
    "*.woff2",
    "*.ttf",
    "*.otf",
    "*.zip",
    "*.gz",
    "*.tar",
    "*.pdf",
    "ai-context.*.md",
    "COMMIT_EDITMSG.txt",
    ".editors.local",
}

# One-liner descriptions keyed by suffix — used when the file doesn't
# get a hand-rolled description below. Kept short on purpose.
GENERIC_DESCRIPTIONS = {
    ".tsx": "React component / page",
    ".ts": "TypeScript module",
    ".js": "JavaScript module",
    ".jsx": "React component",
    ".css": "Stylesheet",
    ".html": "HTML template",
    ".json": "Config / fixture / locale data",
    ".py": "Python module",
    ".md": "Markdown doc",
    ".txt": "Plain-text resource",
    ".yml": "YAML config",
    ".yaml": "YAML config",
    ".toml": "TOML config",
    ".ini": "INI config",
    ".env": "Environment template",
    ".gitignore": "Git ignore rules",
    ".editorconfig": "Editor config",
}


def should_skip(path: Path) -> bool:
    rel = path.relative_to(ROOT)
    parts = rel.parts
    if any(seg in SKIP_DIR_NAMES for seg in parts):
        return True
    name = path.name
    for pattern in SKIP_FILE_GLOBS:
        if path.match(pattern):
            return True
    if name.startswith("."):
        # Allow dotfiles we explicitly know about; skip the rest to
        # avoid leaking local IDE state.
        if name not in {".gitignore", ".env.example", ".editorconfig"}:
            return True
    return False


def describe(path: Path) -> str:
    return GENERIC_DESCRIPTIONS.get(path.suffix, "Project file")


def fence_lang(path: Path) -> str:
    suffix = path.suffix.lstrip(".")
    if suffix in {"tsx", "jsx"}:
        return "tsx"
    if suffix in {"ts"}:
        return "ts"
    if suffix in {"js", "mjs", "cjs"}:
        return "js"
    if suffix in {"py"}:
        return "python"
    if suffix in {"md", "markdown"}:
        return "md"
    if suffix in {"yml", "yaml"}:
        return "yaml"
    if suffix in {"json"}:
        return "json"
    if suffix in {"css"}:
        return "css"
    if suffix in {"html", "htm"}:
        return "html"
    return suffix or ""


def iter_files(roots: Iterable[Path]) -> list[Path]:
    out: list[Path] = []
    for root in roots:
        if not root.exists():
            continue
        for current, dirs, files in os.walk(root):
            cur = Path(current)
            # Prune skip dirs in-place so os.walk doesn't recurse.
            dirs[:] = [d for d in dirs if d not in SKIP_DIR_NAMES]
            for f in sorted(files):
                p = cur / f
                if not should_skip(p):
                    out.append(p)
    return sorted(out)


def render_file(path: Path) -> str:
    rel = path.relative_to(ROOT).as_posix()
    try:
        text = path.read_text(encoding="utf-8")
    except (UnicodeDecodeError, OSError):
        return f"> Binary or unreadable file — skipped\n`{rel}`\n\n"
    # Hard cap to avoid massive blobs; flag truncation explicitly.
    MAX_CHARS = 25_000
    truncated = len(text) > MAX_CHARS
    if truncated:
        text = text[:MAX_CHARS] + "\n... [truncated]"
    lang = fence_lang(path)
    return (
        f"> {describe(path)}\n"
        f"`{rel}`\n"
        f"```{lang}\n{text}\n```\n\n"
    )


def write_doc(out_path: Path, header: str, files: list[Path]) -> None:
    parts = [header.rstrip() + "\n\n"]
    parts.append(f"_{len(files)} files in this snapshot._\n\n")
    for f in files:
        parts.append(render_file(f))
    out_path.write_text("".join(parts), encoding="utf-8")
    print(f"  wrote {out_path.name} ({out_path.stat().st_size:,} bytes)")


def build_frontend() -> None:
    files = iter_files([ROOT / "frontend" / "src"])
    files += iter_files([ROOT / "frontend" / "public" / "games"])
    files += [
        f
        for f in [
            ROOT / "frontend" / "package.json",
            ROOT / "frontend" / "tsconfig.json",
            ROOT / "frontend" / "tsconfig.app.json",
            ROOT / "frontend" / "tsconfig.node.json",
            ROOT / "frontend" / "vite.config.ts",
            ROOT / "frontend" / "index.html",
        ]
        if f.exists()
    ]
    write_doc(
        ROOT / "ai-context.frontend.md",
        "# EduSpace — Frontend AI Context\n\n"
        "Snapshot of the React + Vite frontend. Use this file when "
        "asking an external LLM to reason about UI code without giving "
        "it repository access.\n\n"
        "## Folder layout (high level)\n\n"
        "```\n"
        "frontend/\n"
        "├── public/games/<slug>/   ← embedded mini-app iframes (word-quest etc.)\n"
        "├── src/\n"
        "│   ├── components/        ← shared UI primitives + AppShell + layout chrome\n"
        "│   ├── features/\n"
        "│   │   ├── auth/          ← login/register, notifications inbox + WS\n"
        "│   │   ├── dashboard/\n"
        "│   │   ├── games/         ← solo gallery + game catalogue API\n"
        "│   │   ├── miniapps/      ← /miniapps gallery + standalone player route\n"
        "│   │   ├── recordings/    ← in-call control plane + library + watch tracking\n"
        "│   │   └── room/          ← LiveKit shells, video grid, panels, controls\n"
        "│   ├── hooks/             ← cross-cutting hooks (useBreakpoint, useOrientation)\n"
        "│   ├── i18n/              ← namespace-per-feature en/fa locales + config\n"
        "│   ├── lib/               ← api client, utils, design tokens\n"
        "│   ├── router/            ← BrowserRouter + lazy route table\n"
        "│   └── store/             ← shellStore + small zustand slices\n"
        "├── package.json\n"
        "├── vite.config.ts\n"
        "├── tsconfig.app.json\n"
        "└── index.html\n"
        "```\n",
        sorted(set(files)),
    )


def build_backend() -> None:
    files = iter_files([ROOT / "backend"])
    write_doc(
        ROOT / "ai-context.backend.md",
        "# EduSpace — Backend AI Context\n\n"
        "Snapshot of the Django + DRF + Channels backend. Use this file "
        "when asking an external LLM to reason about server code without "
        "giving it repository access.\n\n"
        "## Folder layout (high level)\n\n"
        "```\n"
        "backend/\n"
        "├── accounts/    ← auth, users, persisted notifications, WS consumer\n"
        "├── config/      ← Django project (settings, urls, asgi)\n"
        "├── games/       ← mini-app catalogue model + API\n"
        "├── rooms/       ← rooms, participants, recording control + storage + webhook\n"
        "├── scripts/     ← smoke tests (verify_*.py)\n"
        "├── manage.py\n"
        "└── requirements.txt\n"
        "```\n\n"
        "Real-time channel groups are keyed `notifications_<user_id>`. "
        "The `accounts.notifications.record_and_dispatch` helper is the "
        "single entry point for any feature that wants to deliver a "
        "notification.\n",
        files,
    )


def build_project() -> None:
    files = []
    for f in (ROOT / "docs").rglob("*.md") if (ROOT / "docs").exists() else []:
        if not should_skip(f):
            files.append(f)
    files += [
        f
        for f in [
            ROOT / "README.md",
            ROOT / "start.ps1",
            ROOT / "start.sh",
            ROOT / "docker-compose.yml",
            ROOT / "Dockerfile",
            ROOT / "package.json",
            ROOT / ".gitignore",
            ROOT / ".editorconfig",
            ROOT / "backend" / "requirements.txt",
            ROOT / "backend" / ".env.example",
            ROOT / "backend" / "Dockerfile",
            ROOT / "backend" / "README.md",
            ROOT / "frontend" / "Dockerfile",
            ROOT / "frontend" / "README.md",
        ]
        if f.exists()
    ]
    write_doc(
        ROOT / "ai-context.project.md",
        "# EduSpace — Project + Docker AI Context\n\n"
        "Top-level docs, scripts, container files, and shared docs/. "
        "Use this snapshot for questions that span backend + frontend, "
        "or that touch deployment / containers.\n",
        sorted(set(files)),
    )


def build_tasks() -> None:
    """
    Hand-curated task log. We don't auto-generate this; instead we
    store the markdown in a stable location at scripts/_tasks.md and
    copy it out. The agent edits scripts/_tasks.md when the user asks
    to update the log.
    """
    src = ROOT / "scripts" / "_tasks.md"
    if not src.exists():
        # Bootstrap with an empty placeholder so the docs always exist
        # even before the first edit.
        src.write_text(
            "# EduSpace — Task log\n\n"
            "_(populated on the next docs regeneration)_\n",
            encoding="utf-8",
        )
    out = ROOT / "ai-context.tasks.md"
    out.write_text(src.read_text(encoding="utf-8"), encoding="utf-8")
    print(f"  wrote {out.name} ({out.stat().st_size:,} bytes)")


def main() -> int:
    print("Generating AI-context snapshots…")
    build_frontend()
    build_backend()
    build_project()
    build_tasks()
    print("Done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
