import sys

if sys.version_info < (3, 10):
    print(
        f"goodvibes requires Python 3.10 or higher. "
        f"You have Python {sys.version_info.major}.{sys.version_info.minor}.",
        file=sys.stderr,
    )
    sys.exit(1)

import typer  # noqa: E402 — version guard must run before any import
from goodvibes_cli.main import app  # noqa: E402

if __name__ == "__main__":
    app()
