"""goodvibes init command — port of init.ts."""
import importlib.metadata
import pathlib
from typing import Annotated

import typer
from rich.console import Console
from rich.panel import Panel

from goodvibes_cli.steps.configure_mcp import configure_mcp
from goodvibes_cli.steps.copy_templates import copy_templates, list_template_files, resolve_templates_dir
from goodvibes_cli.steps.install_headroom import install_headroom
from goodvibes_cli.steps.telemetry import opted_out, start_telemetry_thread
from goodvibes_cli.steps.write_manifest import ManifestError, write_manifest
from goodvibes_cli.utils.detect_project_type import detect_project_type
from goodvibes_cli.utils.json_merge import managed_record
from goodvibes_cli.steps.global_setup import apply_global_config, ensure_global_cli, format_global, register_context7
from goodvibes_cli.utils.scope import global_owned

console = Console()


# ponytail: inline helper — too small to justify a separate module
def _format_headroom_status(hr: dict[str, str], mr: dict[str, str]) -> str:
    install_labels = {
        "installed":         "headroom: installed",
        "already-installed": "headroom: already installed",
        "skipped":           f"headroom: skipped ({hr.get('reason', '')})",
        "failed":            f"headroom: install failed ({hr.get('reason', '')})",
    }
    mcp_labels = {
        "registered":         "MCP: registered",
        "already-registered": "MCP: already configured",
        "skipped":            f"MCP: skipped ({mr.get('reason', '')})",
        "failed":             f"MCP: failed ({mr.get('reason', '')})",
    }
    lines = [
        install_labels.get(hr.get("status", ""), f"headroom: {hr.get('status', 'unknown')}"),
        mcp_labels.get(mr.get("status", ""), f"MCP: {mr.get('status', 'unknown')}"),
    ]
    return "\n".join(lines)


_NEXT_STEPS = (
    "1. Open this project in your AI coding tool\n"
    "2. Claude Code users: /plugin marketplace add DietrichGebert/ponytail\n"
    "   Other IDEs (Cursor, Windsurf, Kiro, Antigravity, etc.): rules already active\n"
    "3. Start coding — CLAUDE.md rules are already active"
)


def init_cmd(
    dry_run: Annotated[bool, typer.Option("--dry-run", help="Preview files without writing")] = False,
    minimal: Annotated[bool, typer.Option("--minimal", help="Skip headroom install and CI workflows")] = False,
    scope: Annotated[str, typer.Option("--scope", help="global (default): set up Claude Code for every project and install goodvibes globally; project: this folder only")] = "global",
) -> None:
    """Bootstrap a project with goodvibes configuration."""
    if scope not in ("global", "project"):
        console.print(f'[red]Unknown --scope "{scope}".[/red] Use --scope global (the default) or --scope project.')
        raise typer.Exit(1)
    template_dir = resolve_templates_dir()
    cwd = pathlib.Path.cwd()
    # Running init from the home folder (or a drive root) sets up global config only, never scatters project files there.
    in_project = not (scope == "global" and (cwd.resolve() == pathlib.Path.home().resolve() or cwd.resolve() == pathlib.Path(cwd.resolve().anchor)))
    project_type = detect_project_type(cwd)

    console.rule("[bold]goodvibes init[/bold]")

    if not opted_out():
        console.print(Panel(
            "Anonymous usage stats are collected. Set DO_NOT_TRACK=1 to opt out.",
            title="Privacy",
        ))

    if dry_run:
        if scope == "global":
            version = importlib.metadata.version("goodvibes-cli")
            g = apply_global_config(template_dir, version, dry_run=True)
            console.print(Panel(format_global(g, ensure_global_cli(version, dry_run=True), None), title=f"Dry run — global setup ({g['config_dir']})"))
        all_files = [f for f in list_template_files(template_dir) if scope == "project" or not global_owned(f)] if in_project else []
        ci_variants = ["ci-node.yml", "ci-python.yml", "ci-both.yml"]
        selected = f"ci-{project_type}.yml"
        if minimal:
            files = [f for f in all_files if not f.startswith(".github") and not f.startswith("docs")]
        else:
            files = [f for f in all_files if not any(f.endswith(v) and not f.endswith(selected) for v in ci_variants)]
        file_list = "\n".join(f"  Would write: {f}" for f in files) or "  (no project files: run init inside a project folder)"
        console.print(Panel(file_list, title="Dry run — no files written"))
        if minimal:
            console.print(Panel(
                "CI workflows and docs were skipped.\nRun goodvibes init without --minimal to add them.",
                title="Skipped layers"
            ))
        console.print(Panel(_NEXT_STEPS, title="Next steps"))
        console.rule("Run without --dry-run to apply these changes.")
        return

    tel_thread = start_telemetry_thread()

    # Non-empty directory notice (UX-01)
    existing = [e for e in cwd.iterdir() if e.name not in (".git", ".DS_Store")]
    if existing:
        console.print(Panel("Existing files will not be overwritten.", title="Non-empty project detected"))

    created_files: list[str] = []
    skipped_files_list: list[str] = []

    global_result = cli_result = c7_result = None
    try:
        if scope == "global":
            with console.status("Setting up goodvibes for all your projects"):
                _v = importlib.metadata.version("goodvibes-cli")
                global_result = apply_global_config(template_dir, _v, dry_run=False)
                c7_result = register_context7(dry_run=False)
                cli_result = ensure_global_cli(_v, dry_run=False)
        if in_project:
            with console.status("Copying template files"):
                written, skipped = copy_templates(template_dir, cwd, dry_run=False, minimal=minimal, project_type=project_type, scope=scope)
                created_files.extend(written)
                skipped_files_list.extend(skipped)

        # ponytail: default to skipped — minimal path never enters the block
        headroom_result: dict[str, str] = {"status": "skipped", "reason": ""}
        mcp_result: dict[str, str] = {"status": "skipped", "reason": ""}

        if not minimal:
            with console.status("Installing headroom") as status:
                def log_install(msg: str) -> None:
                    status.update(msg)

                headroom_result = install_headroom(log_install)

            with console.status("Configuring headroom MCP") as status:
                def log_mcp(msg: str) -> None:
                    status.update(msg)

                mcp_result = configure_mcp(log_mcp)
    except PermissionError as e:
        console.print(f"[red]Error:[/red] {e}")
        console.print("[yellow]Fix:[/yellow] Make sure you are inside your project directory before running this command.")
        console.print("      If permissions are the issue: [bold]chmod u+w .[/bold]  (macOS/Linux)")
        raise typer.Exit(1)
    except OSError as e:
        console.print(f"[red]Unexpected error:[/red] {e}")
        raise typer.Exit(1)
    except ManifestError as e:
        console.print(str(e), style="red", markup=False)
        raise typer.Exit(1)

    _version = importlib.metadata.version("goodvibes-cli")
    if in_project:
        write_manifest(
            cwd,
            [f for f in created_files if f != ".goodvibes.json"],
            _version,
            managed=managed_record(cwd, template_dir),
            scope=scope,
        )

    if tel_thread:
        tel_thread.join(timeout=1.0)

    if global_result:
        console.print(Panel(format_global(global_result, cli_result, c7_result), title=f"Global setup ({global_result['config_dir']})"))
    if in_project:
        written_str = "\n".join(created_files) if created_files else "(none)"
        console.print(Panel(written_str, title=f"Files written ({len(created_files)})"))
    else:
        console.print(Panel(f"No project files written: {cwd} is your home folder.\nRun goodvibes init inside a project folder to add JOURNAL.md, CI and IDE rule files.", title="Project files"))
    if skipped_files_list:
        skipped_str = "\n".join(skipped_files_list)
        console.print(Panel(skipped_str, title=f"Files skipped ({len(skipped_files_list)})"))
    if not minimal:
        console.print(Panel(_format_headroom_status(headroom_result, mcp_result), title="Headroom"))
    console.print(Panel(_NEXT_STEPS, title="Next steps"))
    if minimal:
        console.print(Panel(
            "CI workflows and docs were skipped.\nRun goodvibes init without --minimal to add them.",
            title="Skipped layers"
        ))
    console.rule("[green]You're all set![/green]")
