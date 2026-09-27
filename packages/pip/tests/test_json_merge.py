"""Unit tests for json_merge (pure functions, no I/O)."""
import copy

from goodvibes_cli.utils.json_merge import managed_ids, merge_managed_json, present_ids, shape_error

GATE = {"matcher": "Bash", "hooks": [{"type": "command", "command": ": goodvibes-journal-gate; exit 0"}]}
GATE_V2 = {"matcher": "Bash", "hooks": [{"type": "command", "command": ": goodvibes-journal-gate; exit 2"}]}
USER_HOOK = {"matcher": "Edit", "hooks": [{"type": "command", "command": "npx prettier --write"}]}
TPL_SETTINGS = {
    "permissions": {"allow": ["Bash(npx*)"], "ask": ["Bash(git push*)"], "deny": ["Bash(git reset --hard*)"]},
    "hooks": {"PreToolUse": [GATE_V2]},
}
TPL_MCP = {"mcpServers": {"context7": {"type": "http", "url": "https://mcp.context7.com/mcp"}}}
TPL_CURSOR = {"mcpServers": {"context7": {"url": "https://mcp.context7.com/mcp"}}}
TPL_VSCODE = {"servers": {"context7": {"type": "http", "url": "https://mcp.context7.com/mcp"}}}


def test_managed_ids_lists_ask_deny_and_marked_hooks_but_never_allow():
    assert managed_ids(".claude/settings.json", TPL_SETTINGS) == [
        "ask:Bash(git push*)",
        "deny:Bash(git reset --hard*)",
        "hook:PreToolUse:goodvibes-journal-gate",
    ]


def test_managed_ids_lists_one_id_per_template_mcp_server():
    assert managed_ids(".mcp.json", TPL_MCP) == ["mcp:context7"]


def test_managed_ids_lists_context7_for_the_cursor_and_vscode_mcp_files():
    assert managed_ids(".cursor/mcp.json", TPL_CURSOR) == ["mcp:context7"]
    assert managed_ids(".vscode/mcp.json", TPL_VSCODE) == ["mcp:context7"]


def test_present_ids_finds_context7_under_servers_in_vscode_mcp_json():
    assert present_ids(".vscode/mcp.json", TPL_VSCODE, {"servers": {"context7": {}}}) == ["mcp:context7"]
    assert present_ids(".vscode/mcp.json", TPL_VSCODE, {"mcpServers": {"context7": {}}}) == []


def test_merge_adds_context7_under_servers_in_vscode_mcp_json_and_keeps_user_servers_and_inputs():
    user = {"inputs": [{"id": "token"}], "servers": {"github": {"type": "http", "url": "https://api.githubcopilot.com/mcp"}}}
    merged, changes = merge_managed_json(".vscode/mcp.json", TPL_VSCODE, user)
    assert merged == {"inputs": user["inputs"], "servers": {**user["servers"], "context7": TPL_VSCODE["servers"]["context7"]}}
    assert changes == ["+ servers.context7"]


def test_merge_adds_context7_under_mcp_servers_in_cursor_mcp_json_and_keeps_user_servers():
    merged, changes = merge_managed_json(".cursor/mcp.json", TPL_CURSOR, {"mcpServers": {"postgres": {"command": "pg-mcp"}}})
    assert merged["mcpServers"] == {"postgres": {"command": "pg-mcp"}, "context7": TPL_CURSOR["mcpServers"]["context7"]}
    assert changes == ["+ mcpServers.context7"]


def test_merge_does_not_re_add_context7_to_vscode_mcp_json_after_the_user_removed_it():
    merged, changes = merge_managed_json(".vscode/mcp.json", TPL_VSCODE, {"servers": {}}, ["mcp:context7"])
    assert merged == {"servers": {}}
    assert changes == []


def test_present_ids_returns_only_managed_ids_found_in_content():
    content = {"permissions": {"deny": ["Bash(git reset --hard*)"]}, "hooks": {"PreToolUse": [GATE]}}
    assert present_ids(".claude/settings.json", TPL_SETTINGS, content) == [
        "deny:Bash(git reset --hard*)",
        "hook:PreToolUse:goodvibes-journal-gate",
    ]


def test_merge_adds_missing_managed_keys_and_keeps_user_keys():
    user = {"permissions": {"allow": ["Bash(make*)"], "deny": ["Bash(rm -rf*)"]}, "hooks": {"PostToolUse": [USER_HOOK]}, "model": "x"}
    merged, changes = merge_managed_json(".claude/settings.json", TPL_SETTINGS, user)
    assert merged["permissions"]["allow"] == ["Bash(make*)"]
    assert merged["permissions"]["deny"] == ["Bash(rm -rf*)", "Bash(git reset --hard*)"]
    assert merged["permissions"]["ask"] == ["Bash(git push*)"]
    assert merged["hooks"]["PostToolUse"] == [USER_HOOK]
    assert merged["hooks"]["PreToolUse"] == [GATE_V2]
    assert merged["model"] == "x"
    assert changes == [
        "+ permissions.ask: Bash(git push*)",
        "+ permissions.deny: Bash(git reset --hard*)",
        "+ hooks.PreToolUse: goodvibes-journal-gate",
    ]


def test_merge_never_adds_template_allow_rules():
    merged, _ = merge_managed_json(".claude/settings.json", TPL_SETTINGS, {})
    assert "allow" not in merged["permissions"]


def test_merge_replaces_outdated_goodvibes_hook_and_keeps_user_hook_in_same_event():
    user = {"hooks": {"PreToolUse": [USER_HOOK, GATE]}}
    merged, changes = merge_managed_json(".claude/settings.json", {"hooks": {"PreToolUse": [GATE_V2]}}, user)
    assert merged["hooks"]["PreToolUse"] == [USER_HOOK, GATE_V2]
    assert changes == ["~ hooks.PreToolUse: goodvibes-journal-gate"]


def test_merge_does_not_readd_managed_key_the_user_removed():
    merged, changes = merge_managed_json(
        ".claude/settings.json", TPL_SETTINGS, {"permissions": {}},
        ["ask:Bash(git push*)", "hook:PreToolUse:goodvibes-journal-gate"],
    )
    assert "ask" not in merged["permissions"]
    assert "hooks" not in merged
    assert changes == ["+ permissions.deny: Bash(git reset --hard*)"]


def test_merge_adds_context7_and_keeps_other_mcp_servers():
    merged, changes = merge_managed_json(".mcp.json", TPL_MCP, {"mcpServers": {"postgres": {"command": "pg-mcp"}}})
    assert merged["mcpServers"]["postgres"] == {"command": "pg-mcp"}
    assert merged["mcpServers"]["context7"] == TPL_MCP["mcpServers"]["context7"]
    assert changes == ["+ mcpServers.context7"]


def test_merge_keeps_user_headers_on_context7_while_updating_managed_fields():
    user = {"mcpServers": {"context7": {"type": "http", "url": "https://old.example/mcp", "headers": {"Authorization": "Bearer ${CONTEXT7_API_KEY}"}}}}
    merged, changes = merge_managed_json(".mcp.json", TPL_MCP, user)
    assert merged["mcpServers"]["context7"] == {
        "type": "http",
        "url": "https://mcp.context7.com/mcp",
        "headers": {"Authorization": "Bearer ${CONTEXT7_API_KEY}"},
    }
    assert changes == ["~ mcpServers.context7"]


def test_merge_reports_no_changes_when_managed_keys_are_current():
    _, changes = merge_managed_json(".mcp.json", TPL_MCP, copy.deepcopy(TPL_MCP))
    assert changes == []


def test_merge_replaces_only_the_goodvibes_hook_and_keeps_user_hooks_and_fields_in_the_same_group():
    mine = {"type": "command", "command": "./my-lint.sh"}
    user_group = {"matcher": "Bash|Edit", "hooks": [mine, GATE["hooks"][0]], "note": "mine"}
    merged, changes = merge_managed_json(".claude/settings.json", {"hooks": {"PreToolUse": [GATE_V2]}}, {"hooks": {"PreToolUse": [user_group]}})
    assert merged["hooks"]["PreToolUse"] == [{"matcher": "Bash|Edit", "hooks": [mine, GATE_V2["hooks"][0]], "note": "mine"}]
    assert changes == ["~ hooks.PreToolUse: goodvibes-journal-gate"]


def test_write_json_keeps_non_ascii_text(tmp_path):
    from goodvibes_cli.utils.json_merge import write_json
    path = tmp_path / "settings.json"
    write_json(path, {"note": "café ✓"})
    assert "café ✓" in path.read_text(encoding="utf-8")


def test_write_json_leaves_the_old_file_intact_when_the_write_fails(tmp_path, mocker):
    from goodvibes_cli.utils.json_merge import write_json
    path = tmp_path / "settings.json"
    path.write_text('{"old": true}\n', encoding="utf-8")
    mocker.patch("goodvibes_cli.utils.json_merge.os.replace", side_effect=OSError("disk full"))
    import pytest
    with pytest.raises(OSError):
        write_json(path, {"new": True})
    assert path.read_text(encoding="utf-8") == '{"old": true}\n'
    assert [p.name for p in tmp_path.iterdir()] == ["settings.json"]


def test_present_ids_returns_nothing_for_content_that_is_not_an_object():
    assert present_ids(".claude/settings.json", TPL_SETTINGS, []) == []


RETIRED = ['Bash(npm install*)', 'Bash(npm run*)', 'Bash(npx*)', 'Bash(pip install*)', 'Bash(uv*)', 'Bash(python*)', 'Bash(node*)', 'Bash(git restore *)']
RETIRE_USER = {"permissions": {"allow": ["Read(**)", *RETIRED, "Bash(make test*)"]}}


def test_retiring_removes_allow_rules_that_auto_approved_arbitrary_code_and_keeps_user_rules():
    merged, changes = merge_managed_json(".claude/settings.json", {}, RETIRE_USER, [], retire_allow=True)
    assert merged["permissions"]["allow"] == ["Read(**)", "Bash(make test*)"]
    for r in RETIRED:
        assert f"- permissions.allow: {r}" in changes


def test_allow_rules_are_left_alone_when_not_retiring():
    merged, _ = merge_managed_json(".claude/settings.json", {}, RETIRE_USER)
    assert merged["permissions"]["allow"] == RETIRE_USER["permissions"]["allow"]


def test_write_json_keeps_a_symlinked_config_file_a_symlink_and_updates_its_target(tmp_path):
    import json as _json
    import os
    from goodvibes_cli.utils.json_merge import write_json
    (tmp_path / "dotfiles").mkdir()
    target = tmp_path / "dotfiles" / "settings.json"
    target.write_text("{}\n", encoding="utf-8")
    link = tmp_path / "settings.json"
    os.symlink(target, link)
    write_json(link, {"a": 1})
    assert link.is_symlink()
    assert _json.loads(target.read_text(encoding="utf-8")) == {"a": 1}


def test_write_json_keeps_a_restrictive_0600_mode(tmp_path):
    import os
    import stat
    from goodvibes_cli.utils.json_merge import write_json
    f = tmp_path / "settings.json"
    f.write_text("{}\n", encoding="utf-8")
    os.chmod(f, 0o600)
    write_json(f, {"a": 1})
    assert stat.S_IMODE(f.stat().st_mode) == 0o600


def test_shape_error_returns_none_for_well_formed_settings_and_mcp_files_and_for_files_without_those_keys():
    assert shape_error(".claude/settings.json", TPL_SETTINGS) is None
    assert shape_error(".claude/settings.json", {}) is None
    assert shape_error(".cursor/mcp.json", {"mcpServers": {"context7": {"url": "https://mcp.context7.com/mcp"}}}) is None
    assert shape_error(".vscode/mcp.json", {}) is None
    assert shape_error(".claude/settings.json", {"hooks": None, "permissions": {"deny": None}}) is None
    assert shape_error(".claude/settings.json", {"hooks": {"PreToolUse": [None]}}) is None


def test_shape_error_names_the_first_container_whose_type_the_merge_cannot_use():
    assert shape_error(".mcp.json", {"mcpServers": []}) == '"mcpServers" is not a JSON object'
    assert shape_error(".vscode/mcp.json", {"servers": {"context7": "x"}}) == '"servers.context7" is not a JSON object'
    assert shape_error(".claude/settings.json", {"permissions": {"ask": "Bash(git push*)"}}) == '"permissions.ask" is not a JSON array'
    assert shape_error(".claude/settings.json", {"hooks": {"PreToolUse": {}}}) == '"hooks.PreToolUse" is not a JSON array'
    assert shape_error(".claude/settings.json", {"hooks": {"PreToolUse": ["x"]}}) == '"hooks.PreToolUse[0]" is not a JSON object'
    assert shape_error(".claude/settings.json", {"hooks": {"PreToolUse": [{"hooks": {}}]}}) == '"hooks.PreToolUse[0].hooks" is not a JSON array'



def test_merge_treats_null_hooks_and_permissions_as_absent_and_creates_them():
    merged, changes = merge_managed_json(".claude/settings.json", TPL_SETTINGS, {"hooks": None, "permissions": None, "model": "x"})
    assert merged == {"hooks": {"PreToolUse": [GATE_V2]}, "permissions": {"ask": ["Bash(git push*)"], "deny": ["Bash(git reset --hard*)"]}, "model": "x"}
    assert len(changes) == 3


def test_merge_treats_null_mcp_servers_and_servers_as_absent_and_adds_context7():
    assert merge_managed_json(".mcp.json", TPL_MCP, {"mcpServers": None})[0] == TPL_MCP
    assert merge_managed_json(".cursor/mcp.json", TPL_CURSOR, {"mcpServers": None})[0] == TPL_CURSOR
    assert merge_managed_json(".vscode/mcp.json", TPL_VSCODE, {"servers": None})[0] == TPL_VSCODE


def test_merge_fills_an_empty_context7_entry_with_the_template_fields_even_when_it_was_installed():
    merged, changes = merge_managed_json(".mcp.json", TPL_MCP, {"mcpServers": {"context7": {}}}, ["mcp:context7"])
    assert merged == TPL_MCP
    assert changes == ["~ mcpServers.context7"]


def _guard(cmd, matcher):
    return {"matcher": matcher, "hooks": [{"type": "command", "command": f": goodvibes-read-guard; {cmd}"}]}


_TPL_REFRESH = {"hooks": {"PreToolUse": [_guard("v2", "Read|Bash|Grep")]}, "permissions": {"deny": ["Bash(git push --force *)"]}}


def test_refreshes_the_matcher_of_the_goodvibes_hook_group_so_new_tools_reach_the_read_guard():
    merged, changes = merge_managed_json(".claude/settings.json", _TPL_REFRESH, {"hooks": {"PreToolUse": [_guard("v1", "Read|Bash")]}})
    assert merged["hooks"]["PreToolUse"] == [_guard("v2", "Read|Bash|Grep")]
    assert "~ hooks.PreToolUse: goodvibes-read-guard" in changes


def test_removes_the_old_force_push_deny_rules_goodvibes_installed_so_force_with_lease_reaches_the_ask_rule():
    user = {"permissions": {"deny": ["Bash(git push --force*)", "Bash(git push * --force*)", "Bash(rm -rf /*)"]}}
    installed = ["deny:Bash(git push --force*)", "deny:Bash(git push * --force*)"]
    merged, changes = merge_managed_json(".claude/settings.json", _TPL_REFRESH, user, installed)
    assert merged["permissions"]["deny"] == ["Bash(rm -rf /*)", "Bash(git push --force *)"]
    assert "- permissions.deny: Bash(git push --force*)" in changes


def test_keeps_an_old_force_push_deny_rule_the_user_added_themselves():
    merged, _ = merge_managed_json(".claude/settings.json", _TPL_REFRESH, {"permissions": {"deny": ["Bash(git push --force*)"]}})
    assert "Bash(git push --force*)" in merged["permissions"]["deny"]


# ---------------------------------------------------------------------------
# A user's allow rule beats goodvibes' ask rule
# ---------------------------------------------------------------------------

TPL_GIT = {"permissions": {
    "allow": ["Bash(git branch*)"],
    "ask": ["Bash(git push*)", "Bash(git branch -D*)"],
    "deny": ["Bash(git push --force *)"],
}}


def test_an_allow_rule_covers_an_ask_rule_when_it_matches_every_command_the_ask_rule_matches():
    from goodvibes_cli.utils.json_merge import covers
    assert covers("Bash(git push*)", "Bash(git push*)")
    assert covers("Bash(git push:*)", "Bash(git push --force-with-lease*)")
    assert covers("Bash(git push *)", "Bash(git push*)")
    assert covers("Bash", "Bash(git branch -D*)")
    assert covers("Bash(*)", "Bash(git branch -D*)")
    assert covers("Edit(./.mcp.json)", "Edit(./.mcp.json)")


def test_an_allow_rule_does_not_cover_an_ask_rule_that_matches_more_commands_than_it():
    from goodvibes_cli.utils.json_merge import covers
    assert not covers("Bash(git push origin*)", "Bash(git push*)")
    assert not covers("Bash(git branch -D old)", "Bash(git branch -D*)")
    assert not covers("Bash(git push * main)", "Bash(git push*)")
    assert not covers("Read(**)", "Edit(./.mcp.json)")
    assert not covers("Edit(**/*.yml)", "Edit(./.mcp.json)")


def test_rules_overlap_when_some_command_matches_both():
    from goodvibes_cli.utils.json_merge import overlaps
    assert overlaps("Bash(git push origin*)", "Bash(git push*)")
    assert overlaps("Bash(git branch -D old)", "Bash(git branch -D*)")
    assert overlaps("Bash(git push * main)", "Bash(git push*)")
    assert not overlaps("Bash(git status*)", "Bash(git push*)")
    assert not overlaps("Bash(npm test*)", "Bash(npm publish*)")
    assert not overlaps("Bash(git push origin main)", "Bash(git push --force-with-lease*)")


def test_user_allow_rules_leaves_out_allow_rules_goodvibes_ships_or_used_to_ship():
    from goodvibes_cli.utils.json_merge import user_allow_rules
    content = {"permissions": {"allow": ["Bash(git branch*)", "Bash(npx*)", "Bash(git push*)", 7]}}
    assert user_allow_rules(content, TPL_GIT) == ["Bash(git push*)"]
    assert user_allow_rules({"permissions": None}, TPL_GIT) == []


def test_merge_does_not_add_an_ask_rule_that_a_user_allow_rule_covers():
    merged, changes = merge_managed_json(".claude/settings.json", TPL_GIT, {"permissions": {"allow": ["Bash(git push:*)"]}}, [])
    assert merged["permissions"]["ask"] == ["Bash(git branch -D*)"]
    assert "+ permissions.ask: Bash(git push*)" not in changes


def test_merge_removes_an_ask_rule_goodvibes_installed_once_a_user_allow_rule_covers_it():
    user = {"permissions": {"allow": ["Bash(git branch -D*)"], "ask": ["Bash(git push*)", "Bash(git branch -D*)"]}}
    merged, changes = merge_managed_json(".claude/settings.json", TPL_GIT, user, ["ask:Bash(git push*)", "ask:Bash(git branch -D*)"])
    assert merged["permissions"]["ask"] == ["Bash(git push*)"]
    assert "- permissions.ask: Bash(git branch -D*) (your allow rule Bash(git branch -D*) covers it)" in changes


def test_merge_keeps_an_ask_rule_the_user_wrote_even_when_their_allow_rule_covers_it():
    user = {"permissions": {"allow": ["Bash(git push*)"], "ask": ["Bash(git push*)"]}}
    merged, _ = merge_managed_json(".claude/settings.json", TPL_GIT, user, [])
    assert "Bash(git push*)" in merged["permissions"]["ask"]


def test_merge_never_counts_goodvibes_own_allow_rules_as_the_users():
    merged, _ = merge_managed_json(".claude/settings.json", TPL_GIT, {"permissions": {"allow": ["Bash(git branch*)", "Bash(npx*)"]}}, [])
    assert merged["permissions"]["ask"] == ["Bash(git push*)", "Bash(git branch -D*)"]


def test_merge_yields_to_allow_rules_from_other_settings_files():
    merged, changes = merge_managed_json(".claude/settings.json", TPL_GIT, {}, [], extra_allow=["Bash(git push*)"])
    assert merged["permissions"]["ask"] == ["Bash(git branch -D*)"]


def test_merge_never_drops_a_deny_rule_for_an_allow_rule():
    merged, _ = merge_managed_json(".claude/settings.json", TPL_GIT, {"permissions": {"allow": ["Bash(git push --force *)"]}}, [])
    assert merged["permissions"]["deny"] == ["Bash(git push --force *)"]


def test_overridden_lines_name_the_goodvibes_rule_that_still_beats_each_allow_rule():
    from goodvibes_cli.utils.json_merge import overridden_lines
    content = {"permissions": {"ask": ["Bash(git push*)", "Bash(my own*)"], "deny": ["Bash(git push --force *)"]}}
    allows = ["Bash(git push origin main)", "Bash(git push --force origin x)", "Bash(my own thing)", "Bash(make*)"]
    assert overridden_lines(".claude/settings.json", allows, content, TPL_GIT) == [
        ".claude/settings.json: Claude Code still asks before commands your allow rule Bash(git push origin main) matches, "
        "because goodvibes' ask rule Bash(git push*) is checked first. To change that, delete Bash(git push*) from "
        ".claude/settings.json; goodvibes will not add it back.",
        ".claude/settings.json: Claude Code still refuses commands your allow rule Bash(git push --force origin x) matches, "
        "because goodvibes' deny rule Bash(git push --force *) is checked first. To change that, delete Bash(git push --force *) from "
        ".claude/settings.json; goodvibes will not add it back.",
    ]


def test_overridden_lines_say_nothing_about_a_deny_rule_that_a_broader_allow_rule_merely_includes():
    from goodvibes_cli.utils.json_merge import overridden_lines
    content = {"permissions": {"deny": ["Bash(git push --force *)"]}}
    assert overridden_lines(".claude/settings.json", ["Bash(git push:*)"], content, TPL_GIT) == []
    assert len(overridden_lines(".claude/settings.json", ["Bash(git push --force *)"], content, TPL_GIT)) == 1


def test_a_path_rule_with_wildcards_covers_the_paths_it_matches():
    from goodvibes_cli.utils.json_merge import covers
    assert covers("Edit(./.claude/**)", "Edit(./.claude/settings.json)")
    assert covers("Edit(./.claude/**)", "Edit(./.claude/hooks/**)")
    assert covers("Edit(./.claude/*.json)", "Edit(./.claude/settings.local.json)")
    assert not covers("Edit(./.claude/*)", "Edit(./.claude/hooks/**)")
    assert not covers("Edit(./.github/**)", "Edit(./.claude/settings.json)")


def test_a_path_rule_overlaps_a_wildcard_path_rule_that_matches_it():
    from goodvibes_cli.utils.json_merge import overlaps
    assert overlaps("Edit(./.claude/hooks/pre.sh)", "Edit(./.claude/hooks/**)")
    assert overlaps("Edit(./.claude/**)", "Edit(./.claude/hooks/**)")
    assert not overlaps("Edit(./src/**)", "Edit(./.claude/hooks/**)")


# ---------------------------------------------------------------------------
# Hooks and MCP entries the user edited are kept
# ---------------------------------------------------------------------------

import json as _json
import pathlib as _pathlib

_REPO = _pathlib.Path(__file__).resolve().parents[3]
_REAL_SETTINGS = _json.loads((_REPO / "templates" / ".claude" / "settings.json").read_text(encoding="utf-8"))
_REAL_MCP = _json.loads((_REPO / "templates" / ".mcp.json").read_text(encoding="utf-8"))


def _gate(content):
    return next(g for g in content["hooks"]["PreToolUse"] if "goodvibes-journal-gate" in g["hooks"][0]["command"])


def test_entry_digest_is_the_sha256_of_compact_json_with_sorted_keys():
    import hashlib
    from goodvibes_cli.utils.json_merge import entry_digest
    assert entry_digest({"b": 1, "a": "é"}) == hashlib.sha256('{"a":"é","b":1}'.encode("utf-8")).hexdigest()


def test_every_hook_matcher_and_server_goodvibes_ships_is_listed_as_shipped():
    from goodvibes_cli.utils.json_merge import SHIPPED_ENTRIES, entry_digest
    for rel in (".claude/settings.json", ".gemini/settings.json", ".codex/hooks.json"):
        tpl = _json.loads((_REPO / "templates" / rel).read_text(encoding="utf-8"))
        for groups in tpl["hooks"].values():
            for g in groups:
                h = g["hooks"][0]
                hid = h["command"].split(";")[0][2:]
                assert entry_digest(h) in SHIPPED_ENTRIES, f"add {entry_digest(h)} to SHIPPED_ENTRIES in json_merge.py and json-merge.ts"
                assert entry_digest({"hook": hid, "matcher": g.get("matcher")}) in SHIPPED_ENTRIES
    for rel, key in ((".mcp.json", "mcpServers"), (".cursor/mcp.json", "mcpServers"), (".vscode/mcp.json", "servers")):
        for name, server in _json.loads((_REPO / "templates" / rel).read_text(encoding="utf-8"))[key].items():
            assert entry_digest({"server": name, "value": server}) in SHIPPED_ENTRIES


def test_merge_keeps_a_goodvibes_hook_the_user_edited():
    user = copy.deepcopy(_REAL_SETTINGS)
    _gate(user)["hooks"][0]["command"] += " # mine"
    merged, changes = merge_managed_json(".claude/settings.json", _REAL_SETTINGS, user, [])
    assert _gate(merged) == _gate(user)
    assert not [c for c in changes if "goodvibes-journal-gate" in c]


def test_merge_keeps_a_goodvibes_hook_group_whose_matcher_the_user_changed():
    user = copy.deepcopy(_REAL_SETTINGS)
    _gate(user)["matcher"] = "Bash|Edit"
    merged, changes = merge_managed_json(".claude/settings.json", _REAL_SETTINGS, user, [])
    assert _gate(merged)["matcher"] == "Bash|Edit"
    assert not [c for c in changes if "goodvibes-journal-gate" in c]


def test_merge_refreshes_a_goodvibes_hook_an_earlier_version_shipped():
    from .fixtures import SETTINGS_1100
    merged, changes = merge_managed_json(".claude/settings.json", _REAL_SETTINGS, copy.deepcopy(SETTINGS_1100), [])
    assert _gate(merged) == _gate(_REAL_SETTINGS)
    assert "~ hooks.PreToolUse: goodvibes-journal-gate" in changes


def test_merge_keeps_a_context7_entry_the_user_edited():
    user = {"mcpServers": {"context7": {"type": "http", "url": "https://mcp.context7.com/mcp/mine"}}}
    merged, changes = merge_managed_json(".mcp.json", _REAL_MCP, copy.deepcopy(user), [])
    assert merged == user
    assert changes == []


def test_kept_entry_lines_name_each_goodvibes_hook_and_server_the_user_edited():
    from goodvibes_cli.utils.json_merge import kept_entry_lines
    user = copy.deepcopy(_REAL_SETTINGS)
    _gate(user)["hooks"][0]["command"] += " # mine"
    assert kept_entry_lines(".claude/settings.json", _REAL_SETTINGS, user) == [
        ".claude/settings.json: kept your edited hook goodvibes-journal-gate (PreToolUse); goodvibes did not replace it with its new version"
    ]
    mcp = {"mcpServers": {"context7": {"url": "https://example.test/mcp"}}}
    assert kept_entry_lines(".mcp.json", _REAL_MCP, mcp) == [
        ".mcp.json: kept your edited mcpServers.context7 entry; goodvibes did not replace it with its new version"
    ]
    from .fixtures import SETTINGS_1100
    assert kept_entry_lines(".claude/settings.json", _REAL_SETTINGS, SETTINGS_1100) == []
