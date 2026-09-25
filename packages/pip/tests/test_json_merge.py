"""Unit tests for json_merge (pure functions, no I/O)."""
import copy

from goodvibes_cli.utils.json_merge import managed_ids, merge_managed_json, present_ids

GATE = {"matcher": "Bash", "hooks": [{"type": "command", "command": ": goodvibes-journal-gate; exit 0"}]}
GATE_V2 = {"matcher": "Bash", "hooks": [{"type": "command", "command": ": goodvibes-journal-gate; exit 2"}]}
USER_HOOK = {"matcher": "Edit", "hooks": [{"type": "command", "command": "npx prettier --write"}]}
TPL_SETTINGS = {
    "permissions": {"allow": ["Bash(npx*)"], "ask": ["Bash(git push*)"], "deny": ["Bash(git reset --hard*)"]},
    "hooks": {"PreToolUse": [GATE_V2]},
}
TPL_MCP = {"mcpServers": {"context7": {"type": "http", "url": "https://mcp.context7.com/mcp"}}}


def test_managed_ids_lists_ask_deny_and_marked_hooks_but_never_allow():
    assert managed_ids(".claude/settings.json", TPL_SETTINGS) == [
        "ask:Bash(git push*)",
        "deny:Bash(git reset --hard*)",
        "hook:PreToolUse:goodvibes-journal-gate",
    ]


def test_managed_ids_lists_one_id_per_template_mcp_server():
    assert managed_ids(".mcp.json", TPL_MCP) == ["mcp:context7"]


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
