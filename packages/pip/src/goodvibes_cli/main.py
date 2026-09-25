import importlib.metadata

import typer

from goodvibes_cli.commands.doctor_cmd import doctor_cmd
from goodvibes_cli.commands.init_cmd import init_cmd
from goodvibes_cli.commands.update_cmd import update_cmd
from goodvibes_cli.commands.upgrade_cmd import upgrade_cmd
from goodvibes_cli.commands.usage_cmd import usage_cmd

# -h, help when no command is given, and no shell-completion options: the same as the npm CLI.
app = typer.Typer(help="One-command bootstrap for vibe coding projects", add_completion=False, no_args_is_help=True, context_settings={"help_option_names": ["-h", "--help"]})


def _version_callback(value: bool) -> None:
    if value:
        version = importlib.metadata.version("goodvibes-cli")
        typer.echo(version)
        raise typer.Exit()


@app.callback()
def _callback(
    version: bool = typer.Option(None, "--version", "-V", callback=_version_callback, is_eager=True, help="Show the version and exit"),
) -> None:
    pass


app.command("init")(init_cmd)
app.command("upgrade")(upgrade_cmd)
app.command("update")(update_cmd)
app.command("doctor")(doctor_cmd)
app.command("usage")(usage_cmd)

if __name__ == "__main__":
    app()
