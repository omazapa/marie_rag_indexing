from collections.abc import Generator
from typing import Any

import boto3

from ....application.ports.data_source import DataSourcePort
from ....domain.models import Document


class S3Adapter(DataSourcePort):
    """
    Adapter to ingest documents from an S3 bucket or MinIO.
    """

    @property
    def plugin_id(self) -> str:
        return "s3"

    @property
    def display_name(self) -> str:
        return "Amazon S3 / MinIO"

    def validate_config(self) -> bool:
        return all([self.bucket_name, self.aws_access_key_id, self.aws_secret_access_key])

    def test_connection(self) -> bool:
        try:
            self.s3.list_buckets()
            return True
        except Exception:
            return False

    def __init__(self, config: dict[str, Any]):
        super().__init__(config)
        self.bucket_name = config.get("bucket_name")
        self.prefix = config.get("prefix", "")
        self.endpoint_url = config.get("endpoint_url")  # For MinIO
        self.aws_access_key_id = config.get("aws_access_key_id")
        self.aws_secret_access_key = config.get("aws_secret_access_key")
        self.region_name = config.get("region_name", "us-east-1")

        self.s3 = boto3.client(
            "s3",
            endpoint_url=self.endpoint_url,
            aws_access_key_id=self.aws_access_key_id,
            aws_secret_access_key=self.aws_secret_access_key,
            region_name=self.region_name,
        )

    def load_data(self) -> Generator[Document, None, None]:
        try:
            paginator = self.s3.get_paginator("list_objects_v2")
            pages = paginator.paginate(Bucket=self.bucket_name, Prefix=self.prefix)

            for page in pages:
                if "Contents" not in page:
                    continue

                for obj in page["Contents"]:
                    key = obj["Key"]
                    if key.endswith("/"):  # Skip directories
                        continue

                    # Download object
                    response = self.s3.get_object(Bucket=self.bucket_name, Key=key)
                    content = response["Body"].read().decode("utf-8", errors="ignore")

                    yield Document(
                        content=content,
                        metadata={
                            "source": f"s3://{self.bucket_name}/{key}",
                            "bucket": self.bucket_name,
                            "key": key,
                            "size": obj["Size"],
                            "last_modified": str(obj["LastModified"]),
                        },
                        source_id=self.config.get("id", "unknown"),
                    )
        except Exception as e:
            print(f"Error fetching data from S3: {e}")

    @staticmethod
    def get_config_schema() -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "bucket_name": {
                    "type": "string",
                    "title": "Bucket Name",
                    "description": "The name of the S3 bucket to scan",
                },
                "prefix": {
                    "type": "string",
                    "title": "Folder Prefix",
                    "description": "Optional folder path to limit the scan (e.g., 'docs/')",
                    "default": "",
                },
                "endpoint_url": {
                    "type": "string",
                    "title": "Endpoint URL",
                    "description": "Custom S3 endpoint (required for MinIO, e.g., http://localhost:9000)",
                    "default": "",
                },
                "aws_access_key_id": {
                    "type": "string",
                    "title": "Access Key ID",
                    "description": "Your AWS or MinIO Access Key",
                },
                "aws_secret_access_key": {
                    "type": "string",
                    "title": "Secret Access Key",
                    "description": "Your AWS or MinIO Secret Key",
                },
                "region_name": {
                    "type": "string",
                    "title": "Region",
                    "description": "AWS Region (e.g., us-east-1)",
                    "default": "us-east-1",
                },
            },
            "required": ["bucket_name", "aws_access_key_id", "aws_secret_access_key"],
        }
