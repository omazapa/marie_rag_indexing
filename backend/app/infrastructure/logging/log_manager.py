import json
import queue
from collections.abc import Generator


class LogManager:
    def __init__(self):
        self.listeners: list[queue.Queue[str]] = []

    def subscribe(self) -> queue.Queue[str]:
        q: queue.Queue[str] = queue.Queue(maxsize=100)
        self.listeners.append(q)
        return q

    def unsubscribe(self, q: queue.Queue[str]):
        if q in self.listeners:
            self.listeners.remove(q)

    def log(self, message: str, level: str = "info"):
        data = json.dumps({"message": message, "level": level})
        for q in self.listeners:
            try:
                q.put_nowait(f"data: {data}\n\n")
            except queue.Full:
                pass


log_manager = LogManager()


def stream_logs(q: queue.Queue) -> Generator[str, None, None]:
    while True:
        msg = q.get()
        yield msg
