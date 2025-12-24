import requests
from bs4 import BeautifulSoup
from typing import List, Dict, Any
from .base import BasePlugin, Document
import urllib.parse

class WebScraperPlugin(BasePlugin):
    """
    Plugin to scrape content from websites.
    """
    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.base_url = config.get("base_url")
        self.max_depth = config.get("max_depth", 1)
        self.visited = set()

    def load_data(self) -> List[Document]:
        if not self.base_url:
            return []
        
        documents = []
        self._scrape(self.base_url, 0, documents)
        return documents

    def _scrape(self, url: str, depth: int, documents: List[Document]):
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
            
            documents.append(Document(
                content=text,
                metadata={
                    "source": url,
                    "title": soup.title.string if soup.title else url,
                    "depth": depth
                }
            ))
            
            if depth < self.max_depth:
                for link in soup.find_all('a', href=True):
                    next_url = urllib.parse.urljoin(url, link['href'])
                    # Only follow links from the same domain
                    if urllib.parse.urlparse(next_url).netloc == urllib.parse.urlparse(self.base_url).netloc:
                        self._scrape(next_url, depth + 1, documents)
                        
        except Exception as e:
            print(f"Error scraping {url}: {e}")

    def validate_config(self) -> bool:
        return bool(self.base_url and self.base_url.startswith("http"))
