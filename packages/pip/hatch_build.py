"""Hatchling build hook — copies templates and git hooks into the wheel when building from sdist."""
from __future__ import annotations

import pathlib
import shutil

from hatchling.builders.hooks.plugin.interface import BuildHookInterface

LICENCE_FILES = ("LICENSE", "NOTICE")


class CustomBuildHook(BuildHookInterface):
    """Resolve and inject the templates directory into the wheel build.

    When building directly from source, ../../templates resolves correctly.
    When building from an sdist, the templates are at <sdist-root>/templates/.
    This hook copies whichever location exists into the wheel's goodvibes_cli/templates/,
    and hooks/ (beside templates/ in both layouts) into goodvibes_cli/hooks/.
    A wheel built straight from source also gets the repo-root LICENSE and NOTICE here.
    """

    def initialize(self, version: str, build_data: dict) -> None:
        # The sdist gets templates/ and hooks/ at its root from force-include; a copy under src/ would ship them twice.
        if self.target_name != "wheel":
            return
        root = pathlib.Path(self.root)

        # Direct source build: root = packages/pip/, templates at ../../templates
        templates_source = root / ".." / ".." / "templates"
        # Sdist build: templates were included at the sdist root level
        templates_sdist = root / "templates"

        if templates_source.exists():
            src = templates_source.resolve()
            if self.target_name == "wheel" and version == "standard":
                # license-files globs before hooks run, and in a source tree LICENSE/NOTICE live two levels up.
                dist_info = f"{self.metadata.core.name.replace('-', '_')}-{self.metadata.version}.dist-info"
                for name in LICENCE_FILES:
                    licence = src.parent / name
                    if not licence.is_file():
                        raise FileNotFoundError(f"goodvibes build: {licence} is missing; the wheel must ship it.")
                    build_data["force_include"][str(licence)] = f"{dist_info}/licenses/{name}"
        elif templates_sdist.exists():
            src = templates_sdist.resolve()
            missing = [name for name in LICENCE_FILES if not (root / name).is_file()]
            if missing:
                raise FileNotFoundError(f"goodvibes build: sdist at {root} lacks {', '.join(missing)}; rebuild the sdist.")
        else:
            raise FileNotFoundError(
                f"goodvibes build: no templates directory at {templates_source.resolve()} "
                f"or {templates_sdist.resolve()}. Build from packages/pip/ in the goodvibes repo, "
                "or from a goodvibes-cli sdist."
            )

        # The git hooks sit next to templates in both layouts: ../../hooks from source, <root>/hooks in an sdist.
        hooks = src.parent / "hooks" if templates_source.exists() else root / "hooks"
        if not (hooks / "pre-commit").is_file():
            raise FileNotFoundError(f"goodvibes build: {hooks.resolve() / 'pre-commit'} is missing; the package must ship it.")

        self._copied = []
        for src_dir, name in ((src, "templates"), (hooks.resolve(), "hooks")):
            dest = root / "src" / "goodvibes_cli" / name
            if dest.exists():
                shutil.rmtree(dest)
            shutil.copytree(src_dir, dest)
            self._copied.append(dest)

    def finalize(self, version: str, build_data: dict, artifact_path: str) -> None:
        for dest in getattr(self, "_copied", []):
            if dest.exists():
                shutil.rmtree(dest)
