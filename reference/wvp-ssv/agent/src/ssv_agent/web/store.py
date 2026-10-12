"""只读查询 SSV SQLite 事件账本，并受控解析已登记证据。"""

from __future__ import annotations

import json
import mimetypes
import os
import sqlite3
import stat
from dataclasses import dataclass
from pathlib import Path
from typing import Any, BinaryIO
from urllib.parse import quote

_EVENT_COLUMNS = (
    "event_id",
    "ingress_id",
    "source",
    "timestamp_ms",
    "frame_id",
    "stream_generation",
    "source_pts",
    "event_type",
    "event_phase",
    "severity",
    "rule_id",
    "rule_version",
    "rule_facts_json",
    "episode_id",
    "revision",
    "status",
    "verdict",
    "confidence",
)

_FRAME_MIME_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
}


@dataclass
class OpenedEvidence:
    """由媒体响应持有和关闭的已验证文件。"""

    file: BinaryIO
    mime_type: str
    size: int


def _json_value(value: str | None, fallback: Any) -> Any:
    if not value:
        return fallback
    try:
        return json.loads(value)
    except (TypeError, json.JSONDecodeError):
        return fallback


class ReadOnlyEventStore:
    """每次查询使用独立只读连接，不创建目录或迁移账本 schema。"""

    def __init__(
        self,
        db_path: str | Path,
        evidence_roots: tuple[str | Path, ...] | list[str | Path] = (),
    ) -> None:
        self.db_path = Path(db_path).expanduser().resolve(strict=False)
        self._database_uri = f"{self.db_path.as_uri()}?mode=ro"
        self._evidence_roots = tuple(
            Path(root).expanduser().resolve(strict=False) for root in evidence_roots
        )

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self._database_uri, uri=True, timeout=3.0)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA query_only = ON")
        connection.execute("PRAGMA busy_timeout = 3000")
        return connection

    @staticmethod
    def _event_projection(row: sqlite3.Row) -> dict[str, Any]:
        event = {key: row[key] for key in _EVENT_COLUMNS}
        event["rule_facts"] = _json_value(event.pop("rule_facts_json"), {})
        return event

    def get_overview(self) -> dict[str, Any]:
        connection = self._connect()
        try:
            connection.execute("BEGIN")
            row = connection.execute(
                """
                SELECT COUNT(*) AS total_events,
                       COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0)
                           AS pending_events,
                       COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0)
                           AS completed_events,
                       COALESCE(SUM(CASE WHEN status = 'manual_review' THEN 1 ELSE 0 END), 0)
                           AS needs_attention_events,
                       MAX(timestamp_ms) AS newest_timestamp_ms
                FROM events
                """
            ).fetchone()
            return dict(row)
        finally:
            connection.close()

    def query_events(
        self,
        *,
        q: str | None = None,
        source: str | None = None,
        status: str | None = None,
        verdict: str | None = None,
        from_ms: int | None = None,
        to_ms: int | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> dict[str, Any]:
        conditions: list[str] = []
        parameters: list[Any] = []
        if q and q.strip():
            escaped = q.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
            pattern = f"%{escaped}%"
            conditions.append(
                "(e.event_id LIKE ? ESCAPE '\\' OR e.source LIKE ? ESCAPE '\\' "
                "OR e.event_type LIKE ? ESCAPE '\\' OR e.rule_id LIKE ? ESCAPE '\\')"
            )
            parameters.extend((pattern, pattern, pattern, pattern))
        if source is not None:
            conditions.append("e.source = ?")
            parameters.append(source)
        if status is not None:
            conditions.append("e.status = ?")
            parameters.append(status)
        if verdict is not None:
            conditions.append("e.verdict = ?")
            parameters.append(verdict)
        if from_ms is not None:
            conditions.append("e.timestamp_ms >= ?")
            parameters.append(from_ms)
        if to_ms is not None:
            conditions.append("e.timestamp_ms <= ?")
            parameters.append(to_ms)

        where = f" WHERE {' AND '.join(conditions)}" if conditions else ""
        connection = self._connect()
        try:
            connection.execute("BEGIN")
            total = connection.execute(
                f"SELECT COUNT(*) FROM events e{where}", parameters
            ).fetchone()[0]
            fields = ", ".join(
                f"e.{column}" for column in _EVENT_COLUMNS if column != "rule_facts_json"
            )
            rows = connection.execute(
                f"""
                SELECT {fields},
                       (SELECT COUNT(*) FROM detections d WHERE d.event_id = e.event_id)
                           AS detection_count,
                       (SELECT COUNT(*) FROM evidence v
                        WHERE v.event_id = e.event_id AND v.available = 1
                          AND v.kind = 'frame') AS evidence_count
                FROM events e{where}
                ORDER BY e.timestamp_ms DESC, e.event_id DESC
                LIMIT ? OFFSET ?
                """,
                (*parameters, limit, offset),
            ).fetchall()
            items = []
            for row in rows:
                item = {  # sqlite3.Row iteration returns values, not column names.
                    key: row[key]
                    for key in row.keys()  # noqa: SIM118
                    if key not in {"ingress_id", "episode_id"}
                }
                items.append(item)
            return {"items": items, "total": total, "limit": limit, "offset": offset}
        finally:
            connection.close()

    def get_event_detail(self, event_id: str) -> dict[str, Any] | None:
        connection = self._connect()
        try:
            connection.execute("BEGIN")
            event_row = connection.execute(
                f"SELECT {', '.join(_EVENT_COLUMNS)} FROM events WHERE event_id = ?",
                (event_id,),
            ).fetchone()
            if event_row is None:
                return None

            detection_rows = connection.execute(
                """
                SELECT id, class_name, class_id, confidence, bbox_json, track_id,
                       track_state, occluded
                FROM detections WHERE event_id = ? ORDER BY id
                """,
                (event_id,),
            ).fetchall()
            evidence_columns = {
                row["name"] for row in connection.execute("PRAGMA table_info(evidence)")
            }
            coverage_column = "coverage" if "coverage" in evidence_columns else "'unknown' AS coverage"
            evidence_rows = connection.execute(
                f"""
                SELECT id, evidence_id, kind, path, mime_type, available, size,
                       source_pts_start, source_pts_end, stream_generation,
                       {coverage_column}
                FROM evidence WHERE event_id = ? ORDER BY id
                """,
                (event_id,),
            ).fetchall()
            review_rows = connection.execute(
                """
                SELECT review_id, revision, verdict, confidence, evidence_status,
                       explanation, evidence_ids_json, claims_json, rule_citations_json,
                       policy_id, model_id, created_ms
                FROM reviews WHERE event_id = ? ORDER BY revision
                """,
                (event_id,),
            ).fetchall()
            current_result = connection.execute(
                """
                SELECT verdict, confidence, evidence_status, explanation,
                       evidence_ids_json, claims_json, policy_id, model_id, parsed_at_ms
                FROM review_results WHERE event_id = ?
                """,
                (event_id,),
            ).fetchone()

            detections = []
            for row in detection_rows:
                detection = dict(row)
                detection["bbox"] = _json_value(detection.pop("bbox_json"), [])
                detection["occluded"] = bool(detection["occluded"])
                detections.append(detection)

            evidence = []
            for row in evidence_rows:
                evidence_id = row["evidence_id"] or f"legacy-{row['id']}"
                media = (
                    self._resolve_evidence(connection, event_id, evidence_id)
                    if row["kind"] == "frame"
                    else None
                )
                evidence.append(
                    {
                        "evidence_id": evidence_id,
                        "kind": row["kind"],
                        "coverage": row["coverage"],
                        "mime_type": media["mime_type"] if media else row["mime_type"],
                        "available": (
                            bool(row["available"])
                            if row["kind"] == "clip"
                            else bool(row["available"]) and media is not None
                        ),
                        "detection_overlay": (
                            row["kind"] == "frame"
                            and row["source_pts_start"] is None
                            and row["source_pts_end"] is None
                            and bool(row["available"])
                            and media is not None
                        ),
                        "size": row["size"],
                        "source_pts_start": row["source_pts_start"],
                        "source_pts_end": row["source_pts_end"],
                        "stream_generation": row["stream_generation"],
                        "media_url": (
                            f"/api/events/{quote(event_id, safe='')}/evidence/"
                            f"{quote(evidence_id, safe='')}"
                            if bool(row["available"]) and media is not None
                            else None
                        ),
                    }
                )

            review_history = []
            for row in review_rows:
                review_history.append(
                    {
                        "review_id": row["review_id"],
                        "revision": row["revision"],
                        "verdict": row["verdict"],
                        "confidence": row["confidence"],
                        "evidence_status": row["evidence_status"],
                        "explanation": row["explanation"],
                        "evidence_ids": _json_value(row["evidence_ids_json"], []),
                        "claims": _json_value(row["claims_json"], []),
                        "rule_citations": _json_value(row["rule_citations_json"], []),
                        "policy_id": row["policy_id"],
                        "model_id": row["model_id"],
                        "created_ms": row["created_ms"],
                    }
                )
            latest_review = None
            if current_result is not None:
                matching_history = next(
                    (
                        review
                        for review in reversed(review_history)
                        if review["revision"] == event_row["revision"]
                    ),
                    None,
                )
                latest_review = {
                    "review_id": matching_history["review_id"] if matching_history else None,
                    "revision": event_row["revision"],
                    "verdict": current_result["verdict"],
                    "confidence": current_result["confidence"],
                    "evidence_status": current_result["evidence_status"],
                    "explanation": current_result["explanation"],
                    "evidence_ids": _json_value(current_result["evidence_ids_json"], []),
                    "claims": _json_value(current_result["claims_json"], []),
                    "rule_citations": (
                        matching_history["rule_citations"] if matching_history else []
                    ),
                    "policy_id": current_result["policy_id"],
                    "model_id": current_result["model_id"],
                    "created_ms": current_result["parsed_at_ms"],
                }
            elif review_history:
                latest_review = review_history[-1]

            return {
                "event": self._event_projection(event_row),
                "detections": detections,
                "evidence": evidence,
                "latest_review": latest_review,
                "review_history": review_history,
            }
        finally:
            connection.close()

    def resolve_evidence(self, event_id: str, evidence_id: str) -> dict[str, Any] | None:
        """按已登记 ID 解析允许展示的文件；不接受客户端提供路径。"""
        connection = self._connect()
        try:
            connection.execute("BEGIN")
            return self._resolve_evidence(connection, event_id, evidence_id)
        finally:
            connection.close()

    def _resolve_evidence(
        self,
        connection: sqlite3.Connection,
        event_id: str,
        evidence_id: str,
    ) -> dict[str, Any] | None:
        row = connection.execute(
            """
            SELECT id, kind, path, mime_type, available
            FROM evidence
            WHERE event_id = ? AND (evidence_id = ? OR (evidence_id IS NULL AND ? = 'legacy-' || id))
            """,
            (event_id, evidence_id, evidence_id),
        ).fetchone()
        if row is None or not bool(row["available"]) or row["kind"] != "frame":
            return None

        try:
            path = Path(row["path"]).expanduser().resolve(strict=True)
        except (OSError, RuntimeError, TypeError, ValueError):
            return None
        if not path.is_file() or not self._is_allowed_path(path):
            return None

        suffix = path.suffix.lower()
        mime_type = _FRAME_MIME_TYPES.get(suffix)
        declared = row["mime_type"]
        guessed = mimetypes.guess_type(path.name)[0]
        if mime_type is None or (declared and declared not in {mime_type, guessed}):
            return None
        return {"path": path, "mime_type": mime_type}

    def _is_allowed_path(self, path: Path) -> bool:
        for root in self._evidence_roots:
            try:
                path.relative_to(root)
            except ValueError:
                continue
            return True
        return False

    def open_evidence(self, event_id: str, evidence_id: str) -> OpenedEvidence | None:
        """打开并固定文件；校验之后的 rename/unlink 不改变本次响应。"""
        evidence = self.resolve_evidence(event_id, evidence_id)
        if evidence is None:
            return None
        path = evidence["path"]
        directory_fd = -1
        file_fd = -1
        try:
            # 逐层 openat 拒绝路径被 symlink 替换，不通过原路径二次打开媒体。
            directory_flags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW
            directory_fd = os.open(path.anchor, directory_flags)
            for component in path.parts[1:-1]:
                next_fd = os.open(component, directory_flags, dir_fd=directory_fd)
                os.close(directory_fd)
                directory_fd = next_fd
            file_fd = os.open(
                path.name,
                os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK,
                dir_fd=directory_fd,
            )
            metadata = os.fstat(file_fd)
            if not stat.S_ISREG(metadata.st_mode):
                return None
            file = os.fdopen(file_fd, "rb")
            file_fd = -1
            return OpenedEvidence(file, evidence["mime_type"], metadata.st_size)
        except OSError:
            return None
        finally:
            if file_fd >= 0:
                os.close(file_fd)
            if directory_fd >= 0:
                os.close(directory_fd)
