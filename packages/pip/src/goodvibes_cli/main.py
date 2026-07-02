import importlib.metadata

import typer

from goodvibes_cli.commands.doctor_cmd import doctor_cmd
from goodvibes_cli.commands.init_cmd import init_cmd
from goodvibes_cli.commands.upgrade_cmd import upgrade_cmd

app = typer.Typer(help="goodvibes — one-command bootstrap for vibe coding projects")


def _version_callback(value: bool) -> None:
    if value:
        version = importlib.metadata.version("goodvibes-cli")
        typer.echo(f"goodvibes {version}")
        raise typer.Exit()


@app.callback()
def _callback(
    version: bool = typer.Option(None, "--version", callback=_version_callback, is_eager=True, help="Show version"),
) -> None:
    """goodvibes CLI — run 'goodvibes init' to bootstrap a project"""


app.command("init")(init_cmd)
app.command("upgrade")(upgrade_cmd)
app.command("update")(upgrade_cmd)
app.command("doctor")(doctor_cmd)

if __name__ == "__main__":
    app()
