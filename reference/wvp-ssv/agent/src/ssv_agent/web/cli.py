"""SSV Web 只读展示的启动入口。"""

from __future__ import annotations

import argparse
import os

import uvicorn

from ssv_agent.config import load_config
from ssv_agent.runtime import resolve_agent_path
from ssv_agent.web.app import create_app


def main() -> None:
    parser = argparse.ArgumentParser(description="SSV read-only web viewer")
    parser.add_argument("--config", default=None, help="Agent YAML 配置路径")
    parser.add_argument("--host", default="127.0.0.1", help="监听地址")
    parser.add_argument("--port", type=int, default=8765, help="监听端口")
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error("--port must be between 1 and 65535")

    cfg = load_config(args.config or os.environ.get("SSV_CONFIG_PATH"))
    app = create_app(
        resolve_agent_path(cfg.agent.event_db_path),
        tuple(resolve_agent_path(root) for root in cfg.agent.evidence_roots),
    )
    uvicorn.run(app, host=args.host, port=args.port, log_level="info")


if __name__ == "__main__":
    main()
