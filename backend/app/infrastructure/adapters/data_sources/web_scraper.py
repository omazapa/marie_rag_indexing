import requests
from bs4 import BeautifulSoup
from typing import List, Dict, Any, Generator
from ....application.ports.data_source import DataSourcePort
from ....domain.models import Document
import urllib.parse

class WebScraperAdapter(DataSourcePort):
    """
    Adapter to scrape content from websites.
    """
    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.base_url = config.get("base_url")
        self.max_depth = config.get("max_depth", 1)
        self.visited = set()

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
            if response.status_code != 200:
                return
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Remove script and style elements
            for script in soup(["script", "style"]):
                script.decompose()
            
            text = soup.get_text(separator=' ', strip=True)
            
            yield Document(
                content=text,
                metadata={
                    "source": url,
                    "title": soup.title.string if soup.title else url,
                    "depth": depth
                },
                source_id=self.config.get("id", "unknown")
            )
            
            if depth < self.max_depth:
                for link in soup.find_all('a', href=True):
                    next_url = urllib.parse.urljoin(url, link['href'])
                    # Only follow links from the same domain
                    if urllib.parse.urlparse(next_url).netloc == urllib.parse.urlparse(self.base_url).netloc:
                        yield from self._scrape(next_url, depth + 1)
                        
        except Exception as e:
            print(f"Error scraping {url}: {e}")

    @property
    def plugin_id(self) -> str:
        return "web_scraper"

    @property
    def display_name(self) -> str:
        return "Web Scraper"

    def test_connection(self) -> bool:
        try:
            response = requests.get(self.base_url, timeout=5)
            return response.status_code == 200
        except Exception:
            return False

    def validate_config(self) -> bool:
        return bool(self.base_url and self.base_url.startswith("http"))
