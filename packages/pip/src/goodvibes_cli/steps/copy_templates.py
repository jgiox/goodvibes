"""File copy orchestrator — port of copy-templates.ts. Uses shutil + importlib.resources."""
from __future__ import annotations

import importlib.resources
import pathlib
import shutil

from goodvibes_cli.utils.safe_path import SymlinkError, check_writable
from goodvibes_cli.utils.scope import global_owned, project_stub
from goodvibes_cli.utils.sentinel_merge import ClaudeMdError, merge_claude

FILE_SIZE_WORKFLOW = ".github/workflows/file-size.yml"


def resolve_templates_dir() -> pathlib.Path:
    """Return the bundled templates directory, or the repo's templates/ when running from a source checkout."""
    ref = importlib.resources.files("goodvibes_cli").joinpath("templates")
    # Wrap with Path(str(...)) for str/PathLike compatibility (RESEARCH.md Pitfall 2)
    path = pathlib.Path(str(ref))
    if path.exists():
        return path
    # Editable/dev installs have no bundled copy; the build hook only adds it to wheels.
    for parent in pathlib.Path(__file__).resolve().parents:
        if (parent / "templates" / "CLAUDE.md").is_file():
            return parent / "templates"
    raise FileNotFoundError("goodvibes template files not found in installed package")


def resolve_hooks_dir() -> pathlib.Path:
    """Return the bundled git hooks directory, or the repo's hooks/ when running from a source checkout."""
    path = pathlib.Path(str(importlib.resources.files("goodvibes_cli").joinpath("hooks")))
    if path.exists():
        return path
    for parent in pathlib.Path(__file__).resolve().parents:
        if (parent / "hooks" / "pre-commit").is_file():
            return parent / "hooks"
    raise FileNotFoundError("goodvibes git hook files not found in installed package")


def list_template_files(template_dir: pathlib.Path) -> list[str]:
    """Return sorted list of relative file paths under template_dir."""
    return sorted(
        f.relative_to(template_dir).as_posix()
        for f in template_dir.rglob("*")
        if f.is_file()
    )


def copy_templates(
    template_dir: pathlib.Path,
    dest_dir: pathlib.Path,
    dry_run: bool = False,
    minimal: bool = False,
    project_type: str = "both",
    scope: str = "project",
) -> tuple[list[str], list[str]]:
    """Copy template files to dest_dir, handling CLAUDE.md via sentinel merge.

    Returns (written, skipped) tuple of file paths relative to dest_dir.
    When dry_run=True, returns (filtered_template_list, []) without writing any files.
    """
    ci_variants = {"ci-node.yml", "ci-python.yml", "ci-both.yml"}
    selected_variant = f"ci-{project_type}.yml"

    if dry_run:
        all_files = [
            p for p in list_template_files(template_dir)
            if not any(p.endswith(v) and v != selected_variant for v in ci_variants)
            and (scope == "project" or not global_owned(p))
        ]
        return (all_files, [])

    skipped_files: list[str] = []

    dest_workflows = dest_dir / ".github" / "workflows"
    dest_has_workflows = dest_workflows.is_dir() and any(dest_workflows.glob("*.yml"))

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
            if scope == "global" and global_owned(str(rel)):
                ignored.add(name)
            if minimal and (".github" in rel.parts or "docs" in rel.parts):
                ignored.add(name)  # ponytail: MIN-01
            # Skip CI variants not matching the detected project type
            if name in ci_variants and name != selected_variant:
                ignored.add(name)
            # Skip template workflows if dest already has CI; file-size.yml travels with its script in .github/scripts
            if dest_has_workflows and rel.parts[:2] == (".github", "workflows") and name.endswith((".yml", ".yaml")) and rel.as_posix() != FILE_SIZE_WORKFLOW:
                ignored.add(name)
            # Skip selected CI variant on re-runs where ci.yml already exists (prevents orphaned variant file)
            if name == selected_variant and (dest_dir / ".github" / "workflows" / "ci.yml").is_file():
                ignored.add(name)
                skipped_files.append(".github/workflows/ci.yml")
            dest_candidate = dest_dir / rel
            if name not in ignored:
                try:
                    check_writable(dest_dir, dest_candidate)
                except SymlinkError as e:
                    ignored.add(name)
                    skipped_files.append(str(e))
                    continue
            # No-clobber: skip files (not dirs) that already exist at dest (T-03-02-03)
            if dest_candidate.is_file():
                ignored.add(name)
                skipped_files.append(dest_candidate.relative_to(dest_dir).as_posix())
        return ignored

    # Only files copied here are goodvibes'; everything else in the project (src/, .git/, a user's own files) is not.
    copied: list[str] = []

    def copy_fn(src: str, dst: str) -> None:
        shutil.copy2(src, dst)
        copied.append(pathlib.Path(dst).relative_to(dest_dir).as_posix())

    try:
        shutil.copytree(str(template_dir), str(dest_dir), ignore=ignore_fn, dirs_exist_ok=True, copy_function=copy_fn)
    except PermissionError as e:
        raise PermissionError(
            f"Cannot write files to {dest_dir}.\n"
            f"Why: Permission denied.\n"
            f"Fix: chmod u+w {dest_dir}  (macOS/Linux) or check folder properties (Windows)"
        ) from e
    except OSError as e:
        raise OSError(f"Cannot copy template files: {e}. Check available disk space.") from e

    # Rename selected CI variant to ci.yml
    variant_rel = f".github/workflows/{selected_variant}"
    if variant_rel in copied:
        ci_path = dest_dir / ".github" / "workflows" / "ci.yml"
        if ci_path.exists() or ci_path.is_symlink():
            skipped_files.append(".github/workflows/ci.yml")  # ponytail: UX-04
        else:
            (dest_dir / variant_rel).rename(ci_path)
            copied[copied.index(variant_rel)] = ".github/workflows/ci.yml"

    # Handle CLAUDE.md via sentinel merge
    claude_src = template_dir / "CLAUDE.md"
    claude_merged = False
    if claude_src.exists():
        claude_dest = dest_dir / "CLAUDE.md"
        template_content = claude_src.read_text(encoding="utf-8")
        if scope == "project":
            try:
                merge_claude(claude_dest, template_content)
                claude_merged = True
            except (ClaudeMdError, SymlinkError) as e:
                skipped_files.append(str(e))
        elif claude_dest.is_symlink():
            skipped_files.append("CLAUDE.md: symlink, not written")
        elif not claude_dest.exists():
            claude_dest.write_text(project_stub(template_content), encoding="utf-8")
            claude_merged = True

    written = copied + (["CLAUDE.md"] if claude_merged else [])
    return (sorted(written), sorted(skipped_files))
