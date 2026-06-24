"""Hatchling build hook — copies templates into the wheel when building from sdist."""
from __future__ import annotations

import pathlib
import shutil

from hatchling.builders.hooks.plugin.interface import BuildHookInterface


class CustomBuildHook(BuildHookInterface):
    """Resolve and inject the templates directory into the wheel build.

    When building directly from source, ../../templates resolves correctly.
    When building from an sdist, the templates are at <sdist-root>/templates/.
    This hook copies whichever location exists into the wheel's goodvibes_cli/templates/.
    """

    def initialize(self, version: str, build_data: dict) -> None:
        root = pathlib.Path(self.root)

        # Direct source build: root = packages/pip/, templates at ../../templates
        templates_source = root / ".." / ".." / "templates"
        # Sdist build: templates were included at the sdist root level
        templates_sdist = root / "templates"

        if templates_source.exists():
            src = templates_source.resolve()
        elif templates_sdist.exists():
            src = templates_sdist.resolve()
        else:
            return  # no templates to bundle

        dest = root / "src" / "goodvibes_cli" / "templates"
        if dest.exists():
            shutil.rmtree(dest)
        shutil.copytree(src, dest)

        # Clean up after wheel build completes (cleanup hook handles this)
        self._templates_dest = dest

    def finalize(self, version: str, build_data: dict, artifact_path: str) -> None:
        if hasattr(self, "_templates_dest") and self._templates_dest.exists():
            shutil.rmtree(self._templates_dest)
