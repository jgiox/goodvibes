"""Anonymous telemetry for goodvibes init — fire-and-forget install counter."""
import os
import threading
import urllib.request
import uuid as _uuid

TELEMETRY_URL = os.environ.get(
    "GOODVIBES_TELEMETRY_URL",
    "https://goodvibes-telemetry.igiokas.workers.dev/",
)


def opted_out() -> bool:
    return (
        any(os.environ.get(v, "").strip().lower() in ("1", "true", "yes") for v in ("DO_NOT_TRACK", "GOODVIBES_NO_TELEMETRY"))
        or os.environ.get("CI") == "true"
    )


def _fire(request_id: str) -> None:
    req = urllib.request.Request(
        url=TELEMETRY_URL,
        method="POST",
        headers={"X-Request-Id": request_id},
    )
    try:
        urllib.request.urlopen(req, timeout=5)
    except OSError:
        pass  # ponytail: silent on network error — must not affect init


def start_telemetry_thread() -> threading.Thread | None:
    if opted_out():
        return None
    request_id = str(_uuid.uuid4())
    t = threading.Thread(target=_fire, args=(request_id,), daemon=True)
    t.start()
    return t
