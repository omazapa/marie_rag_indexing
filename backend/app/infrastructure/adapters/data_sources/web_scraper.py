import urllib.parse
from collections.abc import Generator
from typing import Any

import requests
from bs4 import BeautifulSoup

from ....application.ports.data_source import DataSourcePort
from ....domain.models import Document


class WebScraperAdapter(DataSourcePort):
    """
    Adapter to scrape content from websites.
    """

    def __init__(self, config: dict[str, Any]):
        super().__init__(config)
        self.base_url = config.get("base_url")
        self.max_depth = config.get("max_depth", 1)
        self.visited: set[str] = set()

    def validate_config(self) -> bool:
        return bool(self.base_url)

    def test_connection(self) -> bool:
        if not self.base_url:
            return False
        try:
            response = requests.get(self.base_url, timeout=5)
            return response.status_code == requests.codes.ok
        except Exception:
            return False

    def load_data(self) -> Generator[Document, None, None]:
        if not self.base_url:
            return

        yield from self._scrape(self.base_url, 0)

    def _scrape(self, url: str, depth: int) -> Generator[Document, None, None]:
        if depth > self.max_depth or url in self.visited:
            return

        self.visited.add(url)

        try:
            response = requests.get(url, timeout=10)
            if response.status_code != requests.codes.ok:
                return

            soup = BeautifulSoup(response.text, "html.parser")

            # Remove script and style elements
            for script in soup(["script", "style"]):
                script.decompose()

            text = soup.get_text(separator=" ", strip=True)

            yield Document(
                content=text,
                metadata={
                    "source": url,
                    "title": soup.title.string if soup.title else url,
                    "depth": depth,
                },
                source_id=self.config.get("id", "unknown"),
            )

            if depth < self.max_depth:
                for link in soup.find_all("a", href=True):
                    href = link["href"]
                    if not isinstance(href, str):
                        continue
                    next_url = urllib.parse.urljoin(url, href)
                    # Only follow links from the same domain
                    if (
                        self.base_url
                        and urllib.parse.urlparse(next_url).netloc
                        == urllib.parse.urlparse(self.base_url).netloc
                    ):
                        yield from self._scrape(next_url, depth + 1)

        except Exception as e:
            print(f"Error scraping {url}: {e}")

    @property
    def plugin_id(self) -> str:
        return "web_scraper"

    @property
    def display_name(self) -> str:
        return "Web Scraper"

    @staticmethod
    def get_config_schema() -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "base_url": {
                    "type": "string",
                    "title": "Website URL",
                    "description": "The starting URL for scraping (e.g., https://docs.example.com)",
                    "default": "https://example.com",
                },
                "max_depth": {
                    "type": "integer",
                    "title": "Crawl Depth",
                    "description": "How many levels of links to follow (0 = only the base URL)",
                    "default": 1,
                    "minimum": 0,
                    "maximum": 5,
                },
            },
            "required": ["base_url"],
        }
