"""goodvibes init command — port of init.ts."""
import pathlib
from typing import Annotated

import typer
from rich.console import Console
from rich.panel import Panel

from goodvibes_cli.steps.configure_mcp import configure_mcp
from goodvibes_cli.steps.copy_templates import copy_templates, list_template_files, resolve_templates_dir
from goodvibes_cli.steps.install_headroom import install_headroom
from goodvibes_cli.utils.detect_project_type import detect_project_type

console = Console()

_NEXT_STEPS = (
    "1. Open this project in Claude Code\n"
    "2. In Claude Code CLI: /plugin marketplace add DietrichGebert/ponytail\n"
    "3. Start coding — CLAUDE.md rules are already active"
)


def init_cmd(
    dry_run: Annotated[bool, typer.Option("--dry-run", help="Preview files without writing")] = False,
    minimal: Annotated[bool, typer.Option("--minimal", help="Skip headroom install and CI workflows")] = False,
) -> None:
    """Bootstrap a project with goodvibes configuration."""
    template_dir = resolve_templates_dir()
    cwd = pathlib.Path.cwd()
    project_type = detect_project_type(cwd)

    console.rule("[bold]goodvibes init[/bold]")

    if dry_run:
        if minimal:
            all_files = list_template_files(template_dir)
            files = [f for f in all_files if not f.startswith(".github") and not f.startswith("docs")]
        else:
            files_tuple = copy_templates(template_dir, cwd, dry_run=True, minimal=False, project_type=project_type)
            files = files_tuple[0]
        file_list = "\n".join(f"  Would write: {f}" for f in files)
        console.print(Panel(file_list, title="Dry run — no files written"))
        if minimal:
            console.print(Panel(
                "CI workflows and docs were skipped.\nRun goodvibes init without --minimal to add them.",
                title="Skipped layers"
            ))
        console.print(Panel(_NEXT_STEPS, title="Next steps"))
        console.rule("Run without --dry-run to apply these changes.")
        return

    # Non-empty directory notice (UX-01)
    existing = [e for e in cwd.iterdir() if e.name not in (".git", ".DS_Store")]
    if existing:
        console.print(Panel("Existing files will not be overwritten.", title="Non-empty project detected"))

    created_files: list[str] = []
    skipped_files_list: list[str] = []

    try:
        with console.status("Copying template files") as status:
            def log_copy(msg: str) -> None:
                status.update(msg)

            written, skipped = copy_templates(template_dir, cwd, dry_run=False, minimal=minimal, project_type=project_type)
            created_files.extend(written)
            skipped_files_list.extend(skipped)

        if not minimal:
            with console.status("Installing headroom") as status:
                def log_install(msg: str) -> None:
                    status.update(msg)

                install_headroom(log_install)

            with console.status("Configuring headroom MCP") as status:
                def log_mcp(msg: str) -> None:
                    status.update(msg)

                configure_mcp(log_mcp)
    except PermissionError as e:
        console.print(f"[red]Error:[/red] {e}")
        console.print("[yellow]Fix:[/yellow] Make sure you are inside your project directory before running this command.")
        console.print("      If permissions are the issue: [bold]chmod u+w .[/bold]  (macOS/Linux)")
        raise typer.Exit(1)
    except (OSError, Exception) as e:
        console.print(f"[red]Unexpected error:[/red] {e}")
        raise typer.Exit(1)

    written_str = "\n".join(created_files) if created_files else "(none)"
    console.print(Panel(written_str, title=f"Files written ({len(created_files)})"))
    if skipped_files_list:
        skipped_str = "\n".join(skipped_files_list)
        console.print(Panel(skipped_str, title=f"Files skipped ({len(skipped_files_list)})"))
    console.print(Panel(_NEXT_STEPS, title="Next steps"))
    if minimal:
        console.print(Panel(
            "CI workflows and docs were skipped.\nRun goodvibes init without --minimal to add them.",
            title="Skipped layers"
        ))
    console.rule("[green]You're all set![/green]")
