"""MCP Management API — list tools, reload servers, check status."""
from fastapi import APIRouter, Depends, HTTPException
from app.auth.dependencies import get_current_user
from app.models.user import User
from app.core.logging import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/mcp", tags=["mcp"])


@router.get("/tools")
async def list_mcp_tools(current_user: User = Depends(get_current_user)):
    """List all currently discovered MCP tools."""
    from app.services.mcp_service import get_mcp_service
    mcp = get_mcp_service()
    return {
        "tools": mcp.get_tools_info(),
        "total": len(mcp.get_tools()),
    }


@router.post("/reload")
async def reload_mcp(current_user: User = Depends(get_current_user)):
    """Hot-reload all MCP server connections and re-discover tools."""
    from app.services.mcp_service import get_mcp_service
    mcp = get_mcp_service()
    result = await mcp.reload()
    logger.info("mcp_api.reload", result=result)
    return result


@router.get("/status")
async def mcp_status(current_user: User = Depends(get_current_user)):
    """Get connection status for all configured MCP servers."""
    from app.services.mcp_service import get_mcp_service
    mcp = get_mcp_service()
    return mcp.get_status()
