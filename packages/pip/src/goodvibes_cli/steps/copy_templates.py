"""File copy orchestrator — port of copy-templates.ts. Uses shutil + importlib.resources."""
from __future__ import annotations

import importlib.resources
import pathlib
import shutil

from goodvibes_cli.utils.sentinel_merge import merge_claude


def resolve_templates_dir() -> pathlib.Path:
    """Return the bundled templates directory from the installed wheel."""
    ref = importlib.resources.files("goodvibes_cli").joinpath("templates")
    # Wrap with Path(str(...)) for str/PathLike compatibility (RESEARCH.md Pitfall 2)
    path = pathlib.Path(str(ref))
    if not path.exists():
        raise FileNotFoundError("goodvibes template files not found in installed package")
    return path


def list_template_files(template_dir: pathlib.Path) -> list[str]:
    """Return sorted list of relative file paths under template_dir."""
    return sorted(
        str(f.relative_to(template_dir))
        for f in template_dir.rglob("*")
        if f.is_file()
    )


def copy_templates(
    template_dir: pathlib.Path,
    dest_dir: pathlib.Path,
    dry_run: bool = False,
    minimal: bool = False,
) -> list[str]:
    """Copy template files to dest_dir, handling CLAUDE.md via sentinel merge.

    Returns the list of template file paths (relative to template_dir).
    When dry_run=True, returns the list without writing any files.
    """
    if dry_run:
        return list_template_files(template_dir)

    def ignore_fn(directory: str, contents: list[str]) -> set[str]:
        ignored: set[str] = set()
        for name in contents:
            full = pathlib.Path(directory) / name
            try:
                rel = full.relative_to(template_dir)
            except ValueError:
                # path not relative to template_dir — path traversal
                ignored.add(name)
                continue
            if name == "CLAUDE.md":
                ignored.add(name)  # sentinel merge handles it separately
            if ".." in pathlib.Path(str(rel)).parts:
                ignored.add(name)  # path traversal guard (T-03-02-01)
            if minimal and ".github" in rel.parts and "workflows" in rel.parts:
                ignored.add(name)
            # No-clobber: skip if destination already exists (T-03-02-03)
            dest_candidate = dest_dir / rel
            if dest_candidate.exists():
                ignored.add(name)
        return ignored

    shutil.copytree(str(template_dir), str(dest_dir), ignore=ignore_fn, dirs_exist_ok=True)

    # Handle CLAUDE.md via sentinel merge
    claude_src = template_dir / "CLAUDE.md"
    if claude_src.exists():
        claude_dest = dest_dir / "CLAUDE.md"
        template_content = claude_src.read_text(encoding="utf-8")
        merge_claude(claude_dest, template_content)

    return list_template_files(template_dir)
