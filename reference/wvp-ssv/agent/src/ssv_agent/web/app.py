"""同源只读 Web API。"""

from __future__ import annotations

import logging
import re
import sqlite3
from collections.abc import Iterator
from pathlib import Path

from starlette.applications import Starlette
from starlette.concurrency import run_in_threadpool
from starlette.exceptions import HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import FileResponse, JSONResponse, Response, StreamingResponse
from starlette.routing import Mount, Route
from starlette.staticfiles import StaticFiles

from ssv_agent.web.store import OpenedEvidence, ReadOnlyEventStore

logger = logging.getLogger(__name__)
_STATIC_ROOT = Path(__file__).with_name("static")


def _byte_range(value: str | None, size: int) -> tuple[int, int, bool]:
    """支持浏览器单段 Range；多段或其他单位按完整文件响应。"""
    if not value or not value.startswith("bytes=") or "," in value:
        return 0, size, False
    match = re.fullmatch(r"bytes=(\d*)-(\d*)", value)
    if match is None or not any(match.groups()):
        raise HTTPException(status_code=400, detail="invalid byte range")
    first, last = match.groups()
    if first:
        start = int(first)
        end = min(int(last) + 1, size) if last else size
    else:
        start = max(0, size - int(last))
        end = size
    if start >= end:
        raise HTTPException(
            status_code=416,
            detail="byte range is not satisfiable",
            headers={"Content-Range": f"bytes */{size}"},
        )
    return start, end, True


class _EvidenceResponse(StreamingResponse):
    """响应拥有已打开媒体，正常完成或断开连接都关闭文件。"""

    def __init__(self, evidence: OpenedEvidence, request: Request) -> None:
        self._evidence = evidence
        range_header = request.headers.get("range") if not request.headers.get("if-range") else None
        start, end, partial = _byte_range(range_header, evidence.size)
        headers = {"Content-Length": str(end - start), "Accept-Ranges": "bytes"}
        if partial:
            headers["Content-Range"] = f"bytes {start}-{end - 1}/{evidence.size}"
        chunks = () if request.method == "HEAD" else self._chunks(start, end)
        super().__init__(
            chunks,
            status_code=206 if partial else 200,
            media_type=evidence.mime_type,
            headers=headers,
        )

    def _chunks(self, start: int, end: int) -> Iterator[bytes]:
        self._evidence.file.seek(start)
        remaining = end - start
        while remaining > 0:
            chunk = self._evidence.file.read(min(64 * 1024, remaining))
            if not chunk:
                break
            remaining -= len(chunk)
            yield chunk

    async def __call__(self, scope, receive, send) -> None:
        try:
            await super().__call__(scope, receive, send)
        finally:
            self._evidence.file.close()


def create_app(
    db_path: str | Path,
    evidence_roots: tuple[str | Path, ...] | list[str | Path] = (),
) -> Starlette:
    event_store = ReadOnlyEventStore(db_path, evidence_roots)

    async def security_headers(request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Cache-Control"] = "no-store"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; img-src 'self' data:; media-src 'self'; "
            "object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
        )
        return response

    async def database_error(request: Request, exc: sqlite3.Error) -> JSONResponse:
        logger.exception("read-only event ledger query failed", exc_info=exc)
        return JSONResponse(status_code=503, content={"detail": "event ledger is unavailable"})

    async def http_error(request: Request, exc: HTTPException) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
            headers=exc.headers,
        )

    async def health(request: Request) -> JSONResponse:
        await run_in_threadpool(event_store.get_overview)
        return JSONResponse({"status": "ok"})

    async def overview(request: Request) -> JSONResponse:
        data = await run_in_threadpool(event_store.get_overview)
        return JSONResponse(data)

    def _int_query(request: Request, name: str, *, default: int | None = None) -> int | None:
        value = request.query_params.get(name)
        if value is None:
            return default
        try:
            parsed = int(value)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=f"{name} must be an integer") from exc
        if parsed < 0:
            raise HTTPException(status_code=422, detail=f"{name} must be non-negative")
        if parsed > 9_223_372_036_854_775_807:
            raise HTTPException(status_code=422, detail=f"{name} is too large")
        return parsed

    async def list_events(request: Request) -> JSONResponse:
        q = request.query_params.get("q")
        source = request.query_params.get("source")
        status = request.query_params.get("status")
        verdict = request.query_params.get("verdict")
        from_ms = _int_query(request, "from_ms")
        to_ms = _int_query(request, "to_ms")
        limit = _int_query(request, "limit", default=20)
        offset = _int_query(request, "offset", default=0)
        assert limit is not None and offset is not None
        if limit < 1 or limit > 100:
            raise HTTPException(status_code=422, detail="limit must be between 1 and 100")
        if from_ms is not None and to_ms is not None and from_ms > to_ms:
            raise HTTPException(
                status_code=422, detail="from_ms must be less than or equal to to_ms"
            )
        if any(value is not None and len(value) > 200 for value in (q, source, status, verdict)):
            raise HTTPException(status_code=422, detail="query parameter is too long")
        data = await run_in_threadpool(
            event_store.query_events,
            q=q,
            source=source,
            status=status,
            verdict=verdict,
            from_ms=from_ms,
            to_ms=to_ms,
            limit=limit,
            offset=offset,
        )
        return JSONResponse(data)

    async def event_detail(request: Request) -> JSONResponse:
        event_id = request.path_params["event_id"]
        detail = await run_in_threadpool(event_store.get_event_detail, event_id)
        if detail is None:
            raise HTTPException(status_code=404, detail="event not found")
        return JSONResponse(detail)

    async def event_evidence(request: Request) -> Response:
        event_id = request.path_params["event_id"]
        evidence_id = request.path_params["evidence_id"]
        evidence = await run_in_threadpool(event_store.open_evidence, event_id, evidence_id)
        if evidence is None:
            raise HTTPException(status_code=404, detail="evidence not found")
        try:
            return _EvidenceResponse(evidence, request)
        except Exception:
            evidence.file.close()
            raise

    async def homepage(request: Request) -> FileResponse:
        return FileResponse(_STATIC_ROOT / "index.html", media_type="text/html")

    app = Starlette(
        routes=[
            Route("/api/health", health, methods=["GET"]),
            Route("/api/overview", overview, methods=["GET"]),
            Route("/api/events", list_events, methods=["GET"]),
            Route(
                "/api/events/{event_id}/evidence/{evidence_id}",
                event_evidence,
                methods=["GET", "HEAD"],
            ),
            Route("/api/events/{event_id}", event_detail, methods=["GET"]),
            Route("/", homepage, methods=["GET"]),
            Mount("/", app=StaticFiles(directory=_STATIC_ROOT, html=True), name="static"),
        ],
        middleware=[],
        exception_handlers={sqlite3.Error: database_error, HTTPException: http_error},
    )
    app.state.event_store = event_store
    app.add_middleware(BaseHTTPMiddleware, dispatch=security_headers)
    return app
