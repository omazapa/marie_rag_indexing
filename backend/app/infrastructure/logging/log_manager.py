import json
import logging
import queue
from collections.abc import Generator


class LogManager:
    def __init__(self):
        self.listeners: list[queue.Queue[str]] = []
        self.recent_logs: list[dict] = []  # Store recent logs for late subscribers
        self.max_recent = 50

    def subscribe(self) -> queue.Queue[str]:
        q: queue.Queue[str] = queue.Queue(maxsize=100)
        self.listeners.append(q)

        # Send recent logs to new subscriber
        for log in self.recent_logs:
            data = json.dumps(log)
            try:
                q.put_nowait(f"data: {data}\n\n")
            except queue.Full:
                pass

        return q

    def unsubscribe(self, q: queue.Queue[str]):
        if q in self.listeners:
            self.listeners.remove(q)

    def log(self, message: str, level: str = "info", timestamp: str | None = None):
        from datetime import datetime

        if timestamp is None:
            timestamp = datetime.utcnow().isoformat()

        log_data = {"message": message, "level": level, "timestamp": timestamp}

        # Store in recent logs
        self.recent_logs.append(log_data)
        if len(self.recent_logs) > self.max_recent:
            self.recent_logs.pop(0)

        # Send to all subscribers
        data = json.dumps(log_data)
        for q in self.listeners:
            try:
                q.put_nowait(f"data: {data}\n\n")
            except queue.Full:
                pass


log_manager = LogManager()


# Custom logging handler that sends logs to log_manager
class LogManagerHandler(logging.Handler):
    def emit(self, record):
        try:
            msg = self.format(record)
            log_manager.log(msg, level=record.levelname.lower())
        except Exception:
            self.handleError(record)


def stream_logs(q: queue.Queue) -> Generator[str, None, None]:
    while True:
        msg = q.get()
        yield msg
