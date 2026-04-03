from __future__ import annotations

import os
from pathlib import Path


def find_repo_root(start: Path | None = None) -> Path:
    """
    Resolve repository root by walking parents and finding marker files.
    Priority:
    1) REPO_ROOT env var
    2) nearest parent containing one of marker files
    3) fallback to current file parent
    """
    env_root = os.getenv("REPO_ROOT", "").strip()
    if env_root:
        p = Path(env_root).expanduser().resolve()
        if p.exists():
            return p

    current = (start or Path(__file__)).resolve()
    markers = ("pyproject.toml", ".git", "README.md")
    for parent in [current] + list(current.parents):
        if any((parent / marker).exists() for marker in markers):
            return parent

    return current.parent

