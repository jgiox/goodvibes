import importlib.util
import pathlib
import sys
import types

import pytest

HATCH_BUILD = pathlib.Path(__file__).resolve().parents[1] / "hatch_build.py"


@pytest.fixture
def hook_class(monkeypatch):
    # hatchling is the build backend, not a test dependency, so stand in for its hook base class.
    class BuildHookInterface:
        def __init__(self, root, target_name):
            self.root = str(root)
            self.target_name = target_name
            self.metadata = types.SimpleNamespace(core=types.SimpleNamespace(name="goodvibes-cli"), version="0.0.0")

    stub = types.ModuleType("hatchling.builders.hooks.plugin.interface")
    stub.BuildHookInterface = BuildHookInterface
    monkeypatch.setitem(sys.modules, "hatchling.builders.hooks.plugin.interface", stub)
    spec = importlib.util.spec_from_file_location("hatch_build_under_test", HATCH_BUILD)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.CustomBuildHook


@pytest.fixture
def source_tree(tmp_path):
    (tmp_path / "templates").mkdir()
    (tmp_path / "templates" / "CLAUDE.md").write_text("# rules\n")
    (tmp_path / "hooks").mkdir()
    (tmp_path / "hooks" / "pre-commit").write_text("#!/bin/sh\n")
    (tmp_path / "LICENSE").write_text("licence\n")
    (tmp_path / "NOTICE").write_text("notice\n")
    root = tmp_path / "packages" / "pip"
    (root / "src" / "goodvibes_cli").mkdir(parents=True)
    return root


def test_sdist_build_does_not_copy_templates_into_the_package_source(hook_class, source_tree):
    hook = hook_class(source_tree, "sdist")
    hook.initialize("standard", {"force_include": {}})
    assert not (source_tree / "src" / "goodvibes_cli" / "templates").exists()
    assert not (source_tree / "src" / "goodvibes_cli" / "hooks").exists()


def test_wheel_build_copies_templates_and_hooks_and_removes_them_afterwards(hook_class, source_tree):
    hook = hook_class(source_tree, "wheel")
    build_data = {"force_include": {}}
    hook.initialize("standard", build_data)
    package = source_tree / "src" / "goodvibes_cli"
    assert (package / "templates" / "CLAUDE.md").is_file()
    assert (package / "hooks" / "pre-commit").is_file()
    assert sorted(build_data["force_include"].values()) == [
        "goodvibes_cli-0.0.0.dist-info/licenses/LICENSE",
        "goodvibes_cli-0.0.0.dist-info/licenses/NOTICE",
    ]
    hook.finalize("standard", build_data, "unused.whl")
    assert not (package / "templates").exists()
    assert not (package / "hooks").exists()
