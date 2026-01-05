"""
Database Access Layer
Direct SQLite access for the Python backend
"""

import sqlite3
import json
import logging
from typing import List, Optional, Dict, Any
from contextlib import contextmanager
from datetime import datetime

from config.settings import DATABASE_PATH

logger = logging.getLogger(__name__)


@contextmanager
def get_db():
    """Get a database connection."""
    conn = sqlite3.connect(str(DATABASE_PATH))
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def get_all_logs(limit: int = 1000) -> List[Dict[str, Any]]:
    """Get all logs with their tags."""
    with get_db() as conn:
        cursor = conn.execute(
            """
            SELECT id, content, timestamp, tags_json, source, summary
            FROM logs
            ORDER BY timestamp DESC
            LIMIT ?
            """,
            (limit,)
        )
        rows = cursor.fetchall()
        return [
            {
                "id": row["id"],
                "content": row["content"],
                "timestamp": row["timestamp"],
                "tags": json.loads(row["tags_json"] or "[]"),
                "source": row["source"],
                "summary": row["summary"]
            }
            for row in rows
        ]


def get_logs_by_date_range(start_ts: int, end_ts: int) -> List[Dict[str, Any]]:
    """Get logs within a date range."""
    with get_db() as conn:
        cursor = conn.execute(
            """
            SELECT id, content, timestamp, tags_json, source, summary
            FROM logs
            WHERE timestamp >= ? AND timestamp <= ?
            ORDER BY timestamp DESC
            """,
            (start_ts, end_ts)
        )
        rows = cursor.fetchall()
        return [
            {
                "id": row["id"],
                "content": row["content"],
                "timestamp": row["timestamp"],
                "tags": json.loads(row["tags_json"] or "[]"),
                "source": row["source"],
                "summary": row["summary"]
            }
            for row in rows
        ]


def get_logs_by_tags(tag_names: List[str]) -> List[Dict[str, Any]]:
    """Get logs that contain any of the specified tags."""
    with get_db() as conn:
        # SQLite doesn't have native JSON array search, so we do it in Python
        cursor = conn.execute(
            """
            SELECT id, content, timestamp, tags_json, source, summary
            FROM logs
            ORDER BY timestamp DESC
            """
        )
        rows = cursor.fetchall()
        
        results = []
        tag_names_lower = [t.lower() for t in tag_names]
        
        for row in rows:
            tags = json.loads(row["tags_json"] or "[]")
            tag_names_in_log = [t.get("name", "").lower() for t in tags]
            
            # Check if any tag matches
            if any(t in tag_names_lower for t in tag_names_in_log):
                results.append({
                    "id": row["id"],
                    "content": row["content"],
                    "timestamp": row["timestamp"],
                    "tags": tags,
                    "source": row["source"],
                    "summary": row["summary"]
                })
        
        return results


def get_log_embeddings() -> List[Dict[str, Any]]:
    """Get all log embeddings for RAG."""
    with get_db() as conn:
        cursor = conn.execute(
            """
            SELECT le.log_id, le.embedding, l.content, l.timestamp, l.tags_json
            FROM log_embeddings le
            JOIN logs l ON le.log_id = l.id
            ORDER BY l.timestamp DESC
            """
        )
        rows = cursor.fetchall()
        return [
            {
                "id": row["log_id"],
                "embedding": json.loads(row["embedding"]),
                "content": row["content"],
                "timestamp": row["timestamp"],
                "tags": json.loads(row["tags_json"] or "[]")
            }
            for row in rows
        ]


def get_conversations(limit: int = 50) -> List[Dict[str, Any]]:
    """Get recent conversations."""
    with get_db() as conn:
        cursor = conn.execute(
            """
            SELECT id, title, created_at, updated_at
            FROM conversations
            WHERE is_archived = 0
            ORDER BY updated_at DESC
            LIMIT ?
            """,
            (limit,)
        )
        return [dict(row) for row in cursor.fetchall()]


def get_conversation_messages(conversation_id: str) -> List[Dict[str, Any]]:
    """Get messages for a conversation."""
    with get_db() as conn:
        cursor = conn.execute(
            """
            SELECT id, role, content, timestamp
            FROM conversation_messages
            WHERE conversation_id = ?
            ORDER BY timestamp ASC
            """,
            (conversation_id,)
        )
        return [dict(row) for row in cursor.fetchall()]
