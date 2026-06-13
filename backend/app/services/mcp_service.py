"""
MCP (Model Context Protocol) Service — MultiServerMCPClient orchestration.
Provides dynamic tool discovery, registration, and hot-reload from MCP servers.

Supports:
- Local stdio MCP servers (Python scripts)
- Remote HTTP MCP servers (streamable_http transport)

MCP servers are configured in mcp_config.json:
{
  "servers": [
    {
      "name": "filesystem",
      "transport": "stdio",
      "command": "python",
      "args": ["mcp_servers/filesystem_server.py"]
    },
    {
      "name": "remote_tools",
      "transport": "streamable_http",
      "url": "https://api.example.com/mcp"
    }
  ]
}

Tools discovered from MCP are auto-registered and available to agents.
"""
import asyncio
import json
import time
from pathlib import Path
from typing import Any, Optional
from functools import lru_cache

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class MCPService:
    """
    Manages connections to one or more MCP servers.
    Uses langchain-mcp-adapters MultiServerMCPClient for unified interface.
    """

    def __init__(self) -> None:
        self._client = None
        self._tools: list[Any] = []
        self._server_configs: list[dict] = []
        self._last_loaded: float = 0.0
        self._status: dict[str, str] = {}  # server_name → "connected" | "error" | "disconnected"
        self._lock = asyncio.Lock()

    def _load_config(self) -> list[dict]:
        """Load MCP server configurations from JSON file."""
        config_path = Path(settings.MCP_CONFIG_PATH)
        if not config_path.exists():
            # Create default empty config
            default = {"servers": []}
            config_path.write_text(json.dumps(default, indent=2))
            logger.info("mcp_service.config_created", path=str(config_path))
            return []

        try:
            data = json.loads(config_path.read_text())
            return data.get("servers", [])
        except Exception as e:
            logger.error("mcp_service.config_load_error", error=str(e))
            return []

    async def initialize(self) -> None:
        """
        Initialize MCP client and discover tools from all configured servers.
        Called at application startup.
        """
        async with self._lock:
            await self._load_tools()

    async def _load_tools(self) -> None:
        """Internal: load/reload all MCP tools."""
        configs = self._load_config()
        self._server_configs = configs

        if not configs:
            logger.info("mcp_service.no_servers_configured")
            self._tools = []
            return

        try:
            from langchain_mcp_adapters.client import MultiServerMCPClient

            # Build server config dict for MultiServerMCPClient
            server_dict = {}
            for srv in configs:
                name = srv.get("name", f"server_{len(server_dict)}")
                transport = srv.get("transport", "stdio")

                if transport == "stdio":
                    server_dict[name] = {
                        "transport": "stdio",
                        "command": srv.get("command", "python"),
                        "args": srv.get("args", []),
                        "env": srv.get("env", {}),
                    }
                elif transport in ("streamable_http", "http"):
                    server_dict[name] = {
                        "transport": "streamable_http",
                        "url": srv.get("url", ""),
                        "headers": srv.get("headers", {}),
                    }

            if not server_dict:
                self._tools = []
                return

            # Connect and discover tools
            self._client = MultiServerMCPClient(server_dict)
            tools = await asyncio.wait_for(
                self._client.get_tools(),
                timeout=settings.MCP_TIMEOUT,
            )
            self._tools = tools
            self._last_loaded = time.time()

            # Update status
            for name in server_dict:
                self._status[name] = "connected"

            logger.info(
                "mcp_service.tools_loaded",
                count=len(tools),
                servers=list(server_dict.keys()),
                tool_names=[t.name for t in tools],
            )

        except ImportError:
            logger.warning("mcp_service.adapter_unavailable", note="langchain-mcp-adapters not installed")
            self._tools = []
        except asyncio.TimeoutError:
            logger.error("mcp_service.timeout", timeout=settings.MCP_TIMEOUT)
            for srv in configs:
                self._status[srv.get("name", "unknown")] = "error"
            self._tools = []
        except Exception as e:
            logger.error("mcp_service.init_error", error=str(e))
            for srv in configs:
                self._status[srv.get("name", "unknown")] = "error"
            self._tools = []

    async def reload(self) -> dict[str, Any]:
        """
        Hot-reload all MCP server connections and re-discover tools.
        Called via POST /api/v1/mcp/reload
        """
        async with self._lock:
            # Reset state
            self._tools = []
            self._status = {}
            self._client = None

            await self._load_tools()

        return {
            "status": "reloaded",
            "tools_count": len(self._tools),
            "server_status": self._status,
            "tool_names": [t.name for t in self._tools],
        }

    def get_tools(self) -> list[Any]:
        """Return currently loaded MCP tools as LangChain tools."""
        return list(self._tools)

    def get_tools_info(self) -> list[dict]:
        """Return tool metadata for API response."""
        return [
            {
                "name": t.name,
                "description": t.description[:200] if t.description else "",
                "args_schema": str(t.args_schema) if hasattr(t, "args_schema") else "",
            }
            for t in self._tools
        ]

    def get_status(self) -> dict[str, Any]:
        """Return server connection status."""
        return {
            "servers": [
                {
                    "name": srv.get("name", "unknown"),
                    "transport": srv.get("transport"),
                    "status": self._status.get(srv.get("name", "unknown"), "unknown"),
                }
                for srv in self._server_configs
            ],
            "total_tools": len(self._tools),
            "last_loaded": self._last_loaded,
        }

    async def call_tool(self, tool_name: str, args: dict) -> Any:
        """
        Execute an MCP tool by name with given arguments.
        Includes timeout and error handling.
        """
        tool = next((t for t in self._tools if t.name == tool_name), None)
        if not tool:
            raise ValueError(f"MCP tool '{tool_name}' not found")

        try:
            result = await asyncio.wait_for(
                tool.ainvoke(args),
                timeout=settings.MCP_TIMEOUT,
            )
            logger.info("mcp_service.tool_called", tool=tool_name)
            return result
        except asyncio.TimeoutError:
            raise TimeoutError(f"MCP tool '{tool_name}' timed out after {settings.MCP_TIMEOUT}s")
        except Exception as e:
            logger.error("mcp_service.tool_error", tool=tool_name, error=str(e))
            raise


@lru_cache(maxsize=1)
def get_mcp_service() -> MCPService:
    """Singleton MCP service instance."""
    return MCPService()
