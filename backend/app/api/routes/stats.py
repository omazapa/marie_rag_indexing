"""Statistics and dashboard data endpoints."""

from flask import Blueprint, jsonify

stats_bp = Blueprint("stats", __name__)

# Mock data for stats (TODO: Calculate from actual data)
_active_sources_count = 1


@stats_bp.route("/stats", methods=["GET"])
def get_stats():
    """Get system statistics for the dashboard."""
    return (
        jsonify(
            {
                "total_documents": 1250,  # TODO: Get from vector store
                "active_sources": _active_sources_count,
                "last_ingestion": "2025-12-23 10:00",  # TODO: Get from jobs
                "recent_jobs": [
                    {
                        "id": "job_1",
                        "source": "Local Docs",
                        "status": "completed",
                        "time": "2 hours ago",
                    },
                    {
                        "id": "job_2",
                        "source": "Company Wiki",
                        "status": "failed",
                        "time": "5 hours ago",
                    },
                ],
            }
        ),
        200,
    )
