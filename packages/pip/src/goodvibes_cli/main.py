import typer

from goodvibes_cli.commands.init_cmd import init_cmd

app = typer.Typer(help="goodvibes — one-command bootstrap for vibe coding projects")


@app.callback()
def _callback() -> None:
    """goodvibes CLI — run 'goodvibes init' to bootstrap a project"""


app.command("init")(init_cmd)

if __name__ == "__main__":
    app()
