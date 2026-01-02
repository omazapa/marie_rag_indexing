from googleapiclient.discovery import build
from google.oauth2 import service_account
from typing import List, Dict, Any, Generator
from ....application.ports.data_source import DataSourcePort
from ....domain.models import Document
import io
from googleapiclient.http import MediaIoBaseDownload

class GoogleDriveAdapter(DataSourcePort):
    """
    Adapter to ingest documents from Google Drive.
    """
    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.folder_id = config.get("folder_id")
        self.service_account_info = config.get("service_account_info") # Dict or path to JSON
        
        if isinstance(self.service_account_info, str):
            self.creds = service_account.Credentials.from_service_account_file(self.service_account_info)
        else:
            self.creds = service_account.Credentials.from_service_account_info(self.service_account_info)
            
        self.service = build('drive', 'v3', credentials=self.creds)

    def load_data(self) -> Generator[Document, None, None]:
        query = f"'{self.folder_id}' in parents and trashed = false"
        results = self.service.files().list(q=query, fields="files(id, name, mimeType)").execute()
        items = results.get('files', [])

        for item in items:
            file_id = item['id']
            file_name = item['name']
            mime_type = item['mimeType']
            
            if mime_type == 'application/vnd.google-apps.folder':
                # Recursive support could be added here
                continue
                
            content = self._download_file(file_id, mime_type)
            if content:
                yield Document(
                    content=content,
                    metadata={
                        "source": f"gdrive://{file_id}",
                        "file_name": file_name,
                        "mime_type": mime_type,
                        "file_id": file_id
                    },
                    source_id=self.config.get("id", "unknown")
                )

    def _download_file(self, file_id: str, mime_type: str) -> str:
        try:
            if mime_type.startswith('application/vnd.google-apps.'):
                # Export Google Docs/Sheets/etc. as PDF or Text
                request = self.service.files().export_media(fileId=file_id, mimeType='text/plain')
            else:
                request = self.service.files().get_media(fileId=file_id)
                
            fh = io.BytesIO()
            downloader = MediaIoBaseDownload(fh, request)
            done = False
            while done is False:
                status, done = downloader.next_chunk()
            
            return fh.getvalue().decode('utf-8', errors='ignore')
        except Exception as e:
            print(f"Error downloading file {file_id}: {e}")
            return ""

    @property
    def plugin_id(self) -> str:
        return "google_drive"

    @property
    def display_name(self) -> str:
        return "Google Drive"

    def test_connection(self) -> bool:
        try:
            self.service.files().list(pageSize=1).execute()
            return True
        except Exception:
            return False

    def validate_config(self) -> bool:
        return bool(self.folder_id and self.service_account_info)
