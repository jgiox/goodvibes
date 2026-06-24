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
        files = list_template_files(template_dir)
        file_list = "\n".join(f"  Would write: {f}" for f in files)
        console.print(Panel(file_list, title="Dry run — no files written"))
        console.print(Panel(_NEXT_STEPS, title="Next steps"))
        console.rule("Run without --dry-run to apply these changes.")
        return

    created_files: list[str] = []

    with console.status("Copying template files") as status:
        def log_copy(msg: str) -> None:
            status.update(msg)

        files = copy_templates(template_dir, cwd, dry_run=False, minimal=minimal, project_type=project_type)
        created_files.extend(files)

    if not minimal:
        with console.status("Installing headroom") as status:
            def log_install(msg: str) -> None:
                status.update(msg)

            install_headroom(log_install)

        with console.status("Configuring headroom MCP") as status:
            def log_mcp(msg: str) -> None:
                status.update(msg)

            configure_mcp(log_mcp)

    file_list_str = "\n".join(created_files) if created_files else "(none)"
    console.print(Panel(file_list_str, title="Files created"))
    console.print(Panel(_NEXT_STEPS, title="Next steps"))
    console.rule("[green]You're all set![/green]")
