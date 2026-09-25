"""Static shape assertion on the canonical repo-root templates/.mcp.json (not the installed wheel)."""
import json
import pathlib


def test_mcp_json_ships_context7_http_endpoint_with_no_headers():
    templates_dir = pathlib.Path(__file__).resolve().parents[3] / "templates"
    mcp_json = json.loads((templates_dir / ".mcp.json").read_text(encoding="utf-8"))
    context7 = mcp_json["mcpServers"]["context7"]
    assert context7["type"] == "http"
    assert context7["url"] == "https://mcp.context7.com/mcp"
    assert "headers" not in context7


def _template(rel):
    return json.loads((pathlib.Path(__file__).resolve().parents[3] / "templates" / rel).read_text(encoding="utf-8"))


def test_cursor_mcp_json_ships_only_context7_under_mcp_servers_as_a_url_entry():
    assert _template(".cursor/mcp.json") == {"mcpServers": {"context7": {"url": "https://mcp.context7.com/mcp"}}}


def test_vscode_mcp_json_ships_only_context7_under_servers_as_an_http_entry():
    assert _template(".vscode/mcp.json") == {"servers": {"context7": {"type": "http", "url": "https://mcp.context7.com/mcp"}}}
