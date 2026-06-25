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
    project_type: str = "both",
) -> list[str]:
    """Copy template files to dest_dir, handling CLAUDE.md via sentinel merge.

    Returns the list of file paths relative to dest_dir (shows ci.yml, not ci-node.yml).
    When dry_run=True, returns the filtered template list without writing any files.
    """
    ci_variants = {"ci-node.yml", "ci-python.yml", "ci-both.yml"}
    selected_variant = f"ci-{project_type}.yml"

    if dry_run:
        # Preserve --dry-run behaviour: return template files excluding non-selected CI variants
        return [
            p for p in list_template_files(template_dir)
            if not any(p.endswith(v) and v != selected_variant for v in ci_variants)
        ]

    def ignore_fn(directory: str, contents: list[str]) -> set[str]:
        ignored: set[str] = set()
        for name in contents:
            full = pathlib.Path(directory) / name
            try:
                full.resolve().relative_to(template_dir.resolve())  # raises if symlink escapes
            except ValueError:
                ignored.add(name)
                continue
            try:
                rel = full.relative_to(template_dir)
            except ValueError:
                ignored.add(name)
                continue
            if name == "CLAUDE.md":
                ignored.add(name)  # sentinel merge handles it separately
            if minimal and ".github" in rel.parts and "workflows" in rel.parts:
                ignored.add(name)
            # Skip CI variants not matching the detected project type
            if name in ci_variants and name != selected_variant:
                ignored.add(name)
            # No-clobber: skip if destination already exists (T-03-02-03)
            dest_candidate = dest_dir / rel
            if dest_candidate.exists():
                ignored.add(name)
        return ignored

    shutil.copytree(str(template_dir), str(dest_dir), ignore=ignore_fn, dirs_exist_ok=True)

    # Rename selected CI variant to ci.yml
    if not minimal:
        variant_path = dest_dir / ".github" / "workflows" / selected_variant
        ci_path = dest_dir / ".github" / "workflows" / "ci.yml"
        if variant_path.exists():
            variant_path.rename(ci_path)

    # Handle CLAUDE.md via sentinel merge
    claude_src = template_dir / "CLAUDE.md"
    if claude_src.exists():
        claude_dest = dest_dir / "CLAUDE.md"
        template_content = claude_src.read_text(encoding="utf-8")
        merge_claude(claude_dest, template_content)

    # Walk destDir so return shows ci.yml (not ci-node.yml) — per RESEARCH.md Pitfall 6
    return sorted(str(f.relative_to(dest_dir)) for f in dest_dir.rglob("*") if f.is_file())
