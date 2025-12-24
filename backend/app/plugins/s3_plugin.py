import boto3
import os
from typing import List, Dict, Any
from .base import BasePlugin, Document

class S3Plugin(BasePlugin):
    """
    Plugin to ingest documents from an S3 bucket or MinIO.
    """
    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.bucket_name = config.get("bucket_name")
        self.prefix = config.get("prefix", "")
        self.endpoint_url = config.get("endpoint_url")  # For MinIO
        self.aws_access_key_id = config.get("aws_access_key_id")
        self.aws_secret_access_key = config.get("aws_secret_access_key")
        self.region_name = config.get("region_name", "us-east-1")

        self.s3 = boto3.client(
            's3',
            endpoint_url=self.endpoint_url,
            aws_access_key_id=self.aws_access_key_id,
            aws_secret_access_key=self.aws_secret_access_key,
            region_name=self.region_name
        )

    def fetch_data(self) -> List[Document]:
        documents = []
        try:
            paginator = self.s3.get_paginator('list_objects_v2')
            pages = paginator.paginate(Bucket=self.bucket_name, Prefix=self.prefix)

            for page in pages:
                if 'Contents' not in page:
                    continue
                
                for obj in page['Contents']:
                    key = obj['Key']
                    if key.endswith('/'): # Skip directories
                        continue
                    
                    # Download object
                    response = self.s3.get_object(Bucket=self.bucket_name, Key=key)
                    content = response['Body'].read().decode('utf-8', errors='ignore')
                    
                    documents.append(Document(
                        content=content,
                        metadata={
                            "source": f"s3://{self.bucket_name}/{key}",
                            "bucket": self.bucket_name,
                            "key": key,
                            "size": obj['Size'],
                            "last_modified": str(obj['LastModified'])
                        }
                    ))
        except Exception as e:
            print(f"Error fetching data from S3: {e}")
            
        return documents

    def validate_config(self) -> bool:
        return all([self.bucket_name, self.aws_access_key_id, self.aws_secret_access_key])
