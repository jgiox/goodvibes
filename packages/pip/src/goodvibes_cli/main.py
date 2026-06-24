import sys

if sys.version_info < (3, 10):
    print(
        f"goodvibes requires Python 3.10 or higher. "
        f"You have Python {sys.version_info.major}.{sys.version_info.minor}.",
        file=sys.stderr,
    )
    sys.exit(1)

import typer  # noqa: E402 — version guard must run before any import

from goodvibes_cli.commands.init_cmd import init_cmd  # noqa: E402

app = typer.Typer(help="goodvibes — one-command bootstrap for vibe coding projects")


@app.callback()
def _callback() -> None:
    """goodvibes CLI — run 'goodvibes init' to bootstrap a project"""


app.command("init")(init_cmd)

if __name__ == "__main__":
    app()
