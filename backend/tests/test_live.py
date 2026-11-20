import json
from collections.abc import AsyncIterator

import httpx
import pytest

from app.ingestion import live
from app.ingestion.live import backoff_seconds, live_events, parse_sse

URL = "https://stream.example/v2/stream/recentchange"


async def lines(*items: str) -> AsyncIterator[str]:
    for item in items:
        yield item


async def collect(source: AsyncIterator[str], count: int) -> list[str]:
    result = [await anext(source) for _ in range(count)]
    await source.aclose()
    return result


def sse_body(*events: tuple[str, dict]) -> bytes:
    chunks = [":ok\n\n"]
    for event_id, payload in events:
        chunks.append(f"event: message\nid: {event_id}\ndata: {json.dumps(payload)}\n\n")
    return "".join(chunks).encode()


@pytest.fixture
def no_sleep(monkeypatch: pytest.MonkeyPatch) -> list[float]:
    sleeps: list[float] = []

    async def fake_sleep(seconds: float) -> None:
        sleeps.append(seconds)

    monkeypatch.setattr(live.asyncio, "sleep", fake_sleep)
    return sleeps


async def test_parser_joins_data_lines_and_ignores_comments() -> None:
    events = [
        event
        async for event in parse_sse(
            lines(":heartbeat", "id: [1]", 'data: {"a":', "data: 1}", "", "event: other", "")
        )
    ]

    assert len(events) == 1
    assert events[0].id == "[1]"
    assert events[0].data == ['{"a":', "1}"]


async def test_yields_payloads_and_sends_identifying_headers(no_sleep: list[float]) -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(200, content=sse_body(("[1]", {"n": 1}), ("[2]", {"n": 2})))

    states: list[str] = []
    source = live_events(URL, "WikiPulse/test", states.append, httpx.MockTransport(handler))

    payloads = await collect(source, 2)

    assert [json.loads(p)["n"] for p in payloads] == [1, 2]
    assert seen[0].headers["User-Agent"] == "WikiPulse/test"
    assert "Last-Event-ID" not in seen[0].headers
    assert states == ["connecting", "live"]


async def test_reconnects_with_last_event_id_after_the_stream_drops(
    no_sleep: list[float],
) -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        if len(requests) == 1:
            return httpx.Response(200, content=sse_body(("[7]", {"n": 7})))
        if len(requests) == 2:
            raise httpx.ConnectError("network down")
        return httpx.Response(200, content=sse_body(("[8]", {"n": 8})))

    states: list[str] = []
    source = live_events(URL, "ua", states.append, httpx.MockTransport(handler))

    payloads = await collect(source, 2)

    assert [json.loads(p)["n"] for p in payloads] == [7, 8]
    assert [r.headers.get("Last-Event-ID") for r in requests] == [None, "[7]", "[7]"]
    assert states == ["connecting", "live", "reconnecting", "reconnecting", "live"]
    assert len(no_sleep) == 2


async def test_honours_retry_after_when_rate_limited(no_sleep: list[float]) -> None:
    calls = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        if calls == 1:
            return httpx.Response(429, headers={"Retry-After": "20"})
        return httpx.Response(200, content=sse_body(("[1]", {"n": 1})))

    source = live_events(URL, "ua", lambda state: None, httpx.MockTransport(handler))

    await collect(source, 1)

    assert no_sleep == [20.0]


def test_backoff_grows_exponentially_and_is_capped() -> None:
    assert 0.5 <= backoff_seconds(1) <= 1
    assert 4 <= backoff_seconds(4) <= 8
    assert 15 <= backoff_seconds(20) <= 30


async def test_stops_instead_of_retrying_when_the_client_is_refused(
    no_sleep: list[float],
) -> None:
    calls = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(403, text="Please respect our robot policy")

    states: list[str] = []
    source = live_events(URL, "ua", states.append, httpx.MockTransport(handler))

    assert [payload async for payload in source] == []
    assert calls == 1
    assert states == ["connecting", "stopped"]
    assert no_sleep == []
