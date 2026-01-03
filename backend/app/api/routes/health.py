"""Health check endpoints."""

import socket

from flask import Blueprint, jsonify

health_bp = Blueprint("health", __name__)


@health_bp.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint for monitoring service status."""
    return jsonify({"status": "healthy", "service": "marie-rag-indexing-api"}), 200


@health_bp.route("/api/v1/debug/network", methods=["GET"])
def debug_network():
    """Debug network connectivity for Docker environments."""
    try:
        host_ip = socket.gethostbyname("host.docker.internal")
        return jsonify(
            {
                "host.docker.internal": host_ip,
                "message": "DNS resolution for host.docker.internal is working.",
            }
        ), 200
    except Exception as e:
        return jsonify(
            {
                "error": str(e),
                "tip": "DNS resolution failed. Ensure extra_hosts is set in docker-compose.yml",
            }
        ), 500
