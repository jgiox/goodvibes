"""Tests for telemetry — Phase 13 (13-03-PLAN.md). All network calls mocked; no real HTTP during the suite."""
import re

import pytest


def test_posts_to_telemetry_url_when_no_opt_out_env_var_set(mocker, monkeypatch):
    """start_telemetry_thread() fires urlopen exactly once with a POST request when no opt-out env var is set."""
    monkeypatch.delenv("DO_NOT_TRACK", raising=False)
    monkeypatch.delenv("GOODVIBES_NO_TELEMETRY", raising=False)
    monkeypatch.delenv("CI", raising=False)
    urlopen = mocker.patch("goodvibes_cli.steps.telemetry.urllib.request.urlopen")
    from goodvibes_cli.steps.telemetry import start_telemetry_thread

    thread = start_telemetry_thread()
    assert thread is not None
    thread.join(timeout=2.0)

    urlopen.assert_called_once()
    req = urlopen.call_args[0][0]
    assert req.get_method() == "POST"


def test_sends_uuid_in_x_request_id_header(mocker, monkeypatch):
    """start_telemetry_thread() sends a UUID4 in the X-Request-Id header."""
    monkeypatch.delenv("DO_NOT_TRACK", raising=False)
    monkeypatch.delenv("GOODVIBES_NO_TELEMETRY", raising=False)
    monkeypatch.delenv("CI", raising=False)
    urlopen = mocker.patch("goodvibes_cli.steps.telemetry.urllib.request.urlopen")
    from goodvibes_cli.steps.telemetry import start_telemetry_thread

    thread = start_telemetry_thread()
    assert thread is not None
    thread.join(timeout=2.0)

    req = urlopen.call_args[0][0]
    # urllib stores headers capitalised: X-Request-id
    request_id = req.get_header("X-request-id")
    assert request_id is not None
    assert re.fullmatch(
        r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
        request_id,
    )


def test_returns_none_when_do_not_track_is_set(mocker, monkeypatch):
    """start_telemetry_thread() returns None and skips urlopen when DO_NOT_TRACK=1."""
    monkeypatch.setenv("DO_NOT_TRACK", "1")
    urlopen = mocker.patch("goodvibes_cli.steps.telemetry.urllib.request.urlopen")
    from goodvibes_cli.steps.telemetry import start_telemetry_thread

    result = start_telemetry_thread()

    assert result is None
    urlopen.assert_not_called()


def test_returns_none_when_goodvibes_no_telemetry_is_set(mocker, monkeypatch):
    """start_telemetry_thread() returns None and skips urlopen when GOODVIBES_NO_TELEMETRY=1."""
    monkeypatch.setenv("GOODVIBES_NO_TELEMETRY", "1")
    urlopen = mocker.patch("goodvibes_cli.steps.telemetry.urllib.request.urlopen")
    from goodvibes_cli.steps.telemetry import start_telemetry_thread

    result = start_telemetry_thread()

    assert result is None
    urlopen.assert_not_called()


def test_returns_none_when_ci_is_set(mocker, monkeypatch):
    """start_telemetry_thread() returns None and skips urlopen when CI=true."""
    monkeypatch.setenv("CI", "true")
    urlopen = mocker.patch("goodvibes_cli.steps.telemetry.urllib.request.urlopen")
    from goodvibes_cli.steps.telemetry import start_telemetry_thread

    result = start_telemetry_thread()

    assert result is None
    urlopen.assert_not_called()


def test_does_not_raise_when_urlopen_raises_os_error(mocker, monkeypatch):
    """start_telemetry_thread() returns a thread that completes without raising when urlopen raises OSError."""
    monkeypatch.delenv("DO_NOT_TRACK", raising=False)
    monkeypatch.delenv("GOODVIBES_NO_TELEMETRY", raising=False)
    monkeypatch.delenv("CI", raising=False)
    mocker.patch(
        "goodvibes_cli.steps.telemetry.urllib.request.urlopen",
        side_effect=OSError("network down"),
    )
    from goodvibes_cli.steps.telemetry import start_telemetry_thread

    thread = start_telemetry_thread()
    assert thread is not None
    thread.join(timeout=2.0)
    assert not thread.is_alive()
