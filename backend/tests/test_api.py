import json
import time
from collections.abc import Callable, Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from tests.factories import raw_event


@pytest.fixture
def client(tmp_path: Path) -> Iterator[TestClient]:
    events = [
        raw_event(domain="en.wikipedia.org", title="Alpha", seconds=1),
        raw_event(domain="en.wikipedia.org", title="Alpha", seconds=2),
        raw_event(domain="de.wikipedia.org", title="Berlin", seconds=3),
        raw_event(domain="de.wikipedia.org", title="Bot work", seconds=4, bot=True),
        raw_event(type="log", seconds=5),
    ]
    recording = tmp_path / "events.jsonl"
    recording.write_text("\n".join(json.dumps(event) for event in events), encoding="utf-8")
    settings = Settings(
        stream_source="replay",
        replay_file=recording,
        replay_speed=0,
        replay_loop=False,
        broadcast_interval_seconds=0.05,
    )
    with TestClient(create_app(settings)) as test_client:
        wait_for_replay(test_client)
        yield test_client


def wait_for_replay(client: TestClient) -> None:
    wait_until(lambda: client.get("/api/health").json()["upstream"] == "stopped")


def wait_until(condition: Callable[[], bool], timeout: float = 5) -> None:
    deadline = time.monotonic() + timeout
    while not condition():
        assert time.monotonic() < deadline, "condition not met in time"
        time.sleep(0.01)


def test_health_reports_pipeline_counters(client: TestClient) -> None:
    body = client.get("/api/health").json()

    assert body["status"] == "ok"
    assert body["processor"]["accepted"] == 4
    assert body["processor"]["skipped"] == 1


def test_snapshot_endpoint_applies_filters(client: TestClient) -> None:
    everything = client.get("/api/snapshot").json()
    humans_on_de = client.get(
        "/api/snapshot", params={"wiki": "de.wikipedia.org", "include_bots": "false"}
    ).json()

    assert everything["stats"]["edits_last_5_minutes"] == 4
    assert everything["stats"]["top_pages"][0] == {
        "domain": "en.wikipedia.org",
        "title": "Alpha",
        "edits": 2,
    }
    assert [item["event"]["title"] for item in humans_on_de["feed"]] == ["Berlin"]


def test_websocket_sends_snapshot_then_live_stats_and_honours_subscribe(
    client: TestClient,
) -> None:
    with client.websocket_connect("/ws") as ws:
        first = ws.receive_json()
        assert first["type"] == "snapshot"
        assert first["data"]["stats"]["edits_last_5_minutes"] == 4

        assert ws.receive_json()["type"] == "stats"

        ws.send_json({"type": "subscribe", "wiki": "de.wikipedia.org", "include_bots": False})
        message = ws.receive_json()
        while message["type"] != "snapshot":
            message = ws.receive_json()
        assert message["data"]["stats"]["filter"] == {
            "wiki": "de.wikipedia.org",
            "include_bots": False,
        }
        assert message["data"]["stats"]["edits_last_5_minutes"] == 1

        # TestClient cancels the server task as soon as the block exits; let the server
        # finish handling the disconnect first so the test does not race its own teardown.
        ws.close()
        wait_until(lambda: client.get("/api/health").json()["clients"] == 0)
