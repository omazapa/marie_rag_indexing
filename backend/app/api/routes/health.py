"""Health check endpoints."""

import socket

from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def health_check():
    """Health check endpoint for monitoring service status."""
    return {"status": "healthy", "service": "marie-rag-indexing-api"}


@router.get("/api/v1/debug/network")
async def debug_network():
    """Debug network connectivity for Docker environments."""
    try:
        host_ip = socket.gethostbyname("host.docker.internal")
        return {
            "host.docker.internal": host_ip,
            "message": "DNS resolution for host.docker.internal is working.",
        }
    except Exception as e:
        return {
            "error": str(e),
            "tip": "DNS resolution failed. Ensure extra_hosts is set in docker-compose.yml",
        }
