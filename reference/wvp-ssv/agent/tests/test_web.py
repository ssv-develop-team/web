from __future__ import annotations

import json
import sqlite3
from pathlib import Path

import pytest
from starlette.testclient import TestClient

from ssv_agent.event_store.schema import migrate_schema
from ssv_agent.web.app import create_app
from ssv_agent.web.store import ReadOnlyEventStore


def _seed_database(tmp_path: Path) -> tuple[Path, Path, Path]:
    database_path = tmp_path / "events.db"
    evidence_root = tmp_path / "evidence"
    evidence_root.mkdir()
    frame_path = evidence_root / "frame-1.jpg"
    frame_path.write_bytes(b"\xff\xd8fake-jpeg\xff\xd9")
    clip_path = evidence_root / "context.mp4"
    clip_path.write_bytes(b"fake-mp4")

    connection = sqlite3.connect(database_path)
    try:
        migrate_schema(connection)
        connection.execute(
            """
            INSERT INTO events (
                event_id, ingress_id, source, timestamp_ms, frame_id, stream_generation,
                source_pts, event_type, event_phase, severity, rule_id, rule_version,
                rule_facts_json, revision, status, verdict, confidence, result_path, created_ms
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "evt-1",
                "ingress-1",
                "north-gate",
                1_789_000_000_000,
                42,
                3,
                90_000,
                "helmet_violation",
                "NEW",
                "high",
                "helmet.missing",
                "1",
                json.dumps({"track_id": 8}),
                2,
                "completed",
                "violation",
                0.93,
                str(tmp_path / "private-result.json"),
                1_789_000_000_000,
            ),
        )
        connection.execute(
            """
            INSERT INTO events (event_id, source, timestamp_ms, frame_id, status, created_ms)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            ("evt-pending", "loading-bay", 1_789_000_100_000, 43, "pending", 1_789_000_100_000),
        )
        connection.execute(
            """
            INSERT INTO detections (
                event_id, class_name, class_id, confidence, bbox_json, track_id, track_state, occluded
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            ("evt-1", "person", 0, 0.97, "[0.1,0.2,0.8,0.9]", 8, "ACTIVE", 0),
        )
        for evidence_id, kind, path, mime_type in (
            ("ev-frame-1", "frame", frame_path, "image/jpeg"),
            ("ev-clip-1", "clip", clip_path, "video/mp4"),
        ):
            stat = path.stat()
            connection.execute(
                """
                INSERT INTO evidence (
                    event_id, evidence_id, kind, path, mime_type, available, size, mtime,
                    source_pts_start, source_pts_end, stream_generation
                ) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
                """,
                (
                    "evt-1",
                    evidence_id,
                    kind,
                    str(path),
                    mime_type,
                    stat.st_size,
                    stat.st_mtime,
                    80_000,
                    100_000,
                    3,
                ),
            )
        for review_id, revision, explanation in (
            ("review-1", 1, "初次复核"),
            ("review-2", 2, "确认未佩戴安全帽"),
        ):
            connection.execute(
                """
                INSERT INTO reviews (
                    review_id, event_id, revision, policy_id, model_id, verdict, confidence,
                    evidence_status, explanation, evidence_ids_json, claims_json,
                    rule_citations_json, result_path, created_ms
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    review_id,
                    "evt-1",
                    revision,
                    "ssv-review.v1",
                    "test-model",
                    "violation",
                    0.93,
                    "available",
                    explanation,
                    json.dumps(["ev-frame-1"]),
                    json.dumps([{"text": "未检测到安全帽", "evidence_ids": ["ev-frame-1"]}]),
                    json.dumps(
                        [
                            {
                                "chunk_id": "helmet-rule-1",
                                "source": "helmet-policy.md",
                                "rule_id": "helmet.missing",
                                "rule_version": "1",
                                "section": "安全帽佩戴",
                            }
                        ]
                    ),
                    str(tmp_path / f"private-review-{revision}.json"),
                    1_789_000_000_000 + revision,
                ),
            )
        connection.execute(
            """
            INSERT INTO review_results (
                event_id, verdict, confidence, evidence_status, explanation,
                evidence_ids_json, claims_json, policy_id, model_id, parsed_at_ms
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "evt-1",
                "violation",
                0.93,
                "available",
                "确认未佩戴安全帽",
                json.dumps(["ev-frame-1"]),
                json.dumps([{"text": "未检测到安全帽", "evidence_ids": ["ev-frame-1"]}]),
                "ssv-review.v1",
                "test-model",
                1_789_000_000_002,
            ),
        )
        connection.commit()
    finally:
        connection.close()
    return database_path, evidence_root, frame_path


def _client(database_path: Path, evidence_roots: tuple[Path, ...]) -> TestClient:
    return TestClient(create_app(database_path, evidence_roots))


def test_overview_and_event_filters_are_read_only(tmp_path: Path) -> None:
    database_path, evidence_root, _ = _seed_database(tmp_path)
    client = _client(database_path, (evidence_root,))

    assert client.get("/api/health").json() == {"status": "ok"}
    assert client.get("/api/overview").json() == {
        "total_events": 2,
        "pending_events": 1,
        "completed_events": 1,
        "needs_attention_events": 0,
        "newest_timestamp_ms": 1_789_000_100_000,
    }
    response = client.get(
        "/api/events",
        params={
            "q": "helmet.missing",
            "source": "north-gate",
            "status": "completed",
            "verdict": "violation",
            "from_ms": 1_789_000_000_000,
            "to_ms": 1_789_000_000_000,
            "limit": 1,
        },
    )

    assert response.status_code == 200
    assert response.json()["total"] == 1
    item = response.json()["items"][0]
    assert item["event_id"] == "evt-1"
    assert item["detection_count"] == 1
    assert item["evidence_count"] == 1
    assert "result_path" not in item
    assert str(tmp_path) not in response.text


def test_event_detail_links_review_history_to_registered_evidence_ids(tmp_path: Path) -> None:
    database_path, evidence_root, _ = _seed_database(tmp_path)
    response = _client(database_path, (evidence_root,)).get("/api/events/evt-1")

    assert response.status_code == 200
    detail = response.json()
    assert detail["event"]["event_id"] == "evt-1"
    assert detail["event"]["rule_facts"] == {"track_id": 8}
    assert detail["detections"][0]["bbox"] == [0.1, 0.2, 0.8, 0.9]
    assert [review["revision"] for review in detail["review_history"]] == [1, 2]
    assert detail["latest_review"]["revision"] == 2
    assert detail["latest_review"]["explanation"] == "确认未佩戴安全帽"
    assert detail["latest_review"]["claims"] == [
        {"text": "未检测到安全帽", "evidence_ids": ["ev-frame-1"]}
    ]
    assert detail["evidence"][0]["media_url"] == "/api/events/evt-1/evidence/ev-frame-1"
    assert detail["evidence"][0]["detection_overlay"] is False
    assert detail["evidence"][0]["coverage"] == "unknown"
    assert detail["evidence"][1]["media_url"] is None
    assert detail["evidence"][1]["available"] is True
    assert str(tmp_path) not in response.text
    assert "private-review" not in response.text


def test_event_detail_exposes_anchor_only_image_and_media(tmp_path: Path) -> None:
    database_path, evidence_root, frame_path = _seed_database(tmp_path)
    with sqlite3.connect(database_path) as connection:
        connection.execute(
            "UPDATE evidence SET coverage = 'anchor_only' WHERE evidence_id = 'ev-frame-1'"
        )
        connection.execute(
            "UPDATE events SET status = 'manual_review' WHERE event_id = 'evt-1'"
        )
    client = _client(database_path, (evidence_root,))
    detail = client.get("/api/events/evt-1").json()
    frame = next(item for item in detail["evidence"] if item["kind"] == "frame")
    assert detail["event"]["status"] == "manual_review"
    assert frame["coverage"] == "anchor_only"
    assert frame["detection_overlay"] is False
    assert client.get(frame["media_url"]).content == frame_path.read_bytes()


def test_event_detail_reads_legacy_database_without_coverage_column(tmp_path: Path) -> None:
    database_path, evidence_root, _ = _seed_database(tmp_path)
    with sqlite3.connect(database_path) as connection:
        connection.execute("ALTER TABLE evidence DROP COLUMN coverage")
    detail = _client(database_path, (evidence_root,)).get("/api/events/evt-1").json()
    assert all(item["coverage"] == "unknown" for item in detail["evidence"])


def test_event_detail_allows_overlay_only_for_point_event_frames(tmp_path: Path) -> None:
    database_path, evidence_root, _ = _seed_database(tmp_path)
    connection = sqlite3.connect(database_path)
    try:
        connection.execute(
            "UPDATE evidence SET source_pts_start = NULL, source_pts_end = NULL "
            "WHERE event_id = 'evt-1' AND evidence_id = 'ev-frame-1'"
        )
        connection.commit()
    finally:
        connection.close()

    detail = _client(database_path, (evidence_root,)).get("/api/events/evt-1").json()
    frame = next(item for item in detail["evidence"] if item["kind"] == "frame")
    clip = next(item for item in detail["evidence"] if item["kind"] == "clip")
    assert frame["detection_overlay"] is True
    assert clip["detection_overlay"] is False


def test_event_detail_projects_current_result_without_fabricating_history(tmp_path: Path) -> None:
    database_path, evidence_root, _ = _seed_database(tmp_path)
    connection = sqlite3.connect(database_path)
    try:
        connection.execute("DELETE FROM reviews WHERE event_id = 'evt-1'")
        connection.commit()
    finally:
        connection.close()
    response = _client(database_path, (evidence_root,)).get("/api/events/evt-1")

    assert response.status_code == 200
    detail = response.json()
    assert detail["review_history"] == []
    assert detail["latest_review"]["review_id"] is None
    assert detail["latest_review"]["revision"] == 2
    assert detail["latest_review"]["verdict"] == "violation"


def test_evidence_route_serves_only_the_registered_event_evidence(tmp_path: Path) -> None:
    database_path, evidence_root, frame_path = _seed_database(tmp_path)
    client = _client(database_path, (evidence_root,))

    response = client.get("/api/events/evt-1/evidence/ev-frame-1")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("image/jpeg")
    assert response.content == frame_path.read_bytes()
    assert response.headers["x-content-type-options"] == "nosniff"
    assert client.get("/api/events/evt-pending/evidence/ev-frame-1").status_code == 404
    assert client.get("/api/events/evt-1/evidence/unregistered").status_code == 404
    assert client.get("/api/events/evt-1/evidence/ev-clip-1").status_code == 404


def test_evidence_route_supports_byte_ranges_and_head(tmp_path: Path) -> None:
    database_path, evidence_root, frame_path = _seed_database(tmp_path)
    client = _client(database_path, (evidence_root,))
    frame = frame_path.read_bytes()

    partial = client.get(
        "/api/events/evt-1/evidence/ev-frame-1",
        headers={"Range": "bytes=1-4"},
    )
    assert partial.status_code == 206
    assert partial.content == frame[1:5]
    assert partial.headers["content-range"] == f"bytes 1-4/{len(frame)}"
    assert partial.headers["accept-ranges"] == "bytes"

    head = client.head("/api/events/evt-1/evidence/ev-frame-1")
    assert head.status_code == 200
    assert head.content == b""
    assert int(head.headers["content-length"]) == len(frame)


def test_opened_evidence_survives_path_replacement(tmp_path: Path) -> None:
    database_path, evidence_root, frame_path = _seed_database(tmp_path)
    expected = frame_path.read_bytes()
    opened = ReadOnlyEventStore(database_path, (evidence_root,)).open_evidence(
        "evt-1", "ev-frame-1"
    )
    assert opened is not None
    frame_path.unlink()
    frame_path.symlink_to(tmp_path / "outside.jpg")

    try:
        assert opened.file.read() == expected
    finally:
        opened.file.close()


def test_evidence_outside_allowed_root_or_symlinked_outside_is_unavailable(
    tmp_path: Path,
) -> None:
    database_path, evidence_root, _ = _seed_database(tmp_path)
    outside_file = tmp_path / "outside.jpg"
    outside_file.write_bytes(b"outside")
    (evidence_root / "escape.jpg").symlink_to(outside_file)
    connection = sqlite3.connect(database_path)
    try:
        for evidence_id, path in (
            ("outside-id", outside_file),
            ("symlink-id", evidence_root / "escape.jpg"),
        ):
            connection.execute(
                """
                INSERT INTO evidence (event_id, evidence_id, kind, path, mime_type, available)
                VALUES (?, ?, 'frame', ?, 'image/jpeg', 1)
                """,
                ("evt-1", evidence_id, str(path)),
            )
        connection.commit()
    finally:
        connection.close()

    client = _client(database_path, (evidence_root,))
    assert client.get("/api/events/evt-1/evidence/outside-id").status_code == 404
    assert client.get("/api/events/evt-1/evidence/symlink-id").status_code == 404


def test_read_connection_rejects_writes_and_missing_database_stays_missing(tmp_path: Path) -> None:
    database_path, evidence_root, _ = _seed_database(tmp_path)
    store = ReadOnlyEventStore(database_path, (evidence_root,))
    connection = store._connect()
    try:
        with pytest.raises(sqlite3.OperationalError):
            connection.execute("UPDATE events SET status = 'changed' WHERE event_id = 'evt-1'")
    finally:
        connection.close()

    missing_path = tmp_path / "missing" / "events.db"
    response = _client(missing_path, (evidence_root,)).get("/api/health")
    assert response.status_code == 503
    assert not missing_path.exists()
    assert not missing_path.parent.exists()
    assert str(missing_path) not in response.text


def test_event_validation_and_unknown_event_errors(tmp_path: Path) -> None:
    database_path, evidence_root, _ = _seed_database(tmp_path)
    client = _client(database_path, (evidence_root,))

    assert client.get("/api/events/absent").status_code == 404
    assert client.get("/api/events?limit=101").status_code == 422
    assert client.get("/api/events?from_ms=20&to_ms=10").status_code == 422
    assert client.get("/api/events?offset=999999999999999999999").status_code == 422


def test_missing_evidence_and_empty_roots_fail_closed(tmp_path: Path) -> None:
    database_path, evidence_root, frame_path = _seed_database(tmp_path)
    assert (
        _client(database_path, ()).get("/api/events/evt-1/evidence/ev-frame-1").status_code == 404
    )
    frame_path.unlink()
    client = _client(database_path, (evidence_root,))
    assert client.get("/api/events/evt-1/evidence/ev-frame-1").status_code == 404
    detail = client.get("/api/events/evt-1").json()
    assert detail["evidence"][0]["available"] is False
    assert detail["evidence"][0]["media_url"] is None


@pytest.mark.parametrize(
    "range_header,expected_status",
    [
        ("bytes=999999-", 416),
        ("bytes=-0", 416),
        ("bytes=invalid", 400),
    ],
)
def test_invalid_media_ranges_return_stable_errors(
    tmp_path: Path, range_header: str, expected_status: int
) -> None:
    database_path, evidence_root, _ = _seed_database(tmp_path)
    response = _client(database_path, (evidence_root,)).get(
        "/api/events/evt-1/evidence/ev-frame-1", headers={"Range": range_header}
    )
    assert response.status_code == expected_status
    assert "detail" in response.json()


def test_pagination_reads_one_snapshot_during_a_wal_commit(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    database_path, evidence_root, _ = _seed_database(tmp_path)
    writer = sqlite3.connect(database_path)
    writer.execute("PRAGMA journal_mode = WAL")

    class CommitAfterCount(sqlite3.Connection):
        def execute(self, sql, parameters=()):
            cursor = super().execute(sql, parameters)
            if sql.startswith("SELECT COUNT(*) FROM events e"):
                writer.execute("DELETE FROM events WHERE event_id = 'evt-pending'")
                writer.commit()
            return cursor

    reader = sqlite3.connect(database_path, factory=CommitAfterCount)
    reader.row_factory = sqlite3.Row
    reader.execute("PRAGMA query_only = ON")
    store = ReadOnlyEventStore(database_path, (evidence_root,))
    monkeypatch.setattr(store, "_connect", lambda: reader)
    try:
        payload = store.query_events()
    finally:
        writer.close()
    assert payload["total"] == 2
    assert len(payload["items"]) == 2
