import React from 'react';
import { Form, Input, InputNumber, Select, Switch, Space, Alert, Divider } from 'antd';
import { Database, Globe, Cloud, Info } from 'lucide-react';
import { InfoTooltip } from './InfoTooltip';

const { TextArea } = Input;

// SQL Configuration Form
export const SQLConfigForm: React.FC = () => {
  return (
    <div className="space-y-4">
      <Alert
        message="SQL Database Connection"
        description="Connect to PostgreSQL, MySQL, MariaDB, or other SQL databases. Supports batch queries and incremental updates."
        type="info"
        icon={<Database size={14} />}
        showIcon
        className="mb-4"
      />

      <Form.Item
        name="connection_string"
        label={
          <Space>
            <span>Connection String</span>
            <InfoTooltip
              title="Database Connection"
              content="Format: postgresql://user:password@host:5432/database or mysql://user:password@host:3306/database"
            />
          </Space>
        }
        rules={[{ required: true, message: 'Connection string is required' }]}
      >
        <Input.Password
          placeholder="postgresql://user:password@localhost:5432/mydb"
          prefix={<Database size={16} />}
        />
      </Form.Item>

      <Form.Item
        name="tables"
        label={
          <Space>
            <span>Tables to Index</span>
            <InfoTooltip
              title="Table Selection"
              content="Comma-separated list of tables to index. Leave empty to index all accessible tables."
            />
          </Space>
        }
      >
        <Select
          mode="tags"
          placeholder="articles, documents, posts (or leave empty for all)"
          style={{ width: '100%' }}
        />
      </Form.Item>

      <Form.Item
        name="text_fields"
        label={
          <Space>
            <span>Text Fields</span>
            <InfoTooltip
              title="Content Fields"
              content="Columns containing the main text content to be indexed. Multiple fields will be concatenated."
            />
          </Space>
        }
        rules={[{ required: true }]}
      >
        <Select
          mode="tags"
          placeholder="title, content, body, description"
          style={{ width: '100%' }}
        />
      </Form.Item>

      <Form.Item
        name="metadata_fields"
        label={
          <Space>
            <span>Metadata Fields</span>
            <InfoTooltip
              title="Additional Context"
              content="Columns to include as metadata (author, date, category, etc.). Helps with filtering and context."
            />
          </Space>
        }
      >
        <Select
          mode="tags"
          placeholder="author, created_at, category, tags"
          style={{ width: '100%' }}
        />
      </Form.Item>

      <Space className="w-full">
        <Form.Item
          name="id_field"
          label="ID Field"
          className="flex-1"
          initialValue="id"
        >
          <Input placeholder="id" />
        </Form.Item>

        <Form.Item
          name="batch_size"
          label="Batch Size"
          className="flex-1"
          initialValue={1000}
        >
          <InputNumber min={100} max={10000} style={{ width: '100%' }} />
        </Form.Item>
      </Space>

      <Form.Item
        name="where_clause"
        label={
          <Space>
            <span>WHERE Clause (Optional)</span>
            <InfoTooltip
              title="Query Filter"
              content="SQL WHERE clause to filter records. Example: status = 'published' AND created_at > '2024-01-01'"
            />
          </Space>
        }
      >
        <Input placeholder="status = 'published'" />
      </Form.Item>
    </div>
  );
};

// S3 Configuration Form
export const S3ConfigForm: React.FC = () => {
  return (
    <div className="space-y-4">
      <Alert
        message="S3 Cloud Storage"
        description="Connect to Amazon S3, MinIO, or S3-compatible storage. Supports PDF, DOCX, TXT, Markdown, and more."
        type="info"
        icon={<Cloud size={14} />}
        showIcon
        className="mb-4"
      />

      <Form.Item
        name="bucket_name"
        label="Bucket Name"
        rules={[{ required: true }]}
      >
        <Input placeholder="my-documents-bucket" prefix={<Cloud size={16} />} />
      </Form.Item>

      <Space className="w-full">
        <Form.Item
          name="aws_access_key_id"
          label="Access Key ID"
          className="flex-1"
          rules={[{ required: true }]}
        >
          <Input.Password placeholder="AKIAIOSFODNN7EXAMPLE" />
        </Form.Item>

        <Form.Item
          name="aws_secret_access_key"
          label="Secret Access Key"
          className="flex-1"
          rules={[{ required: true }]}
        >
          <Input.Password placeholder="wJalrXUtnFEMI/K7MDENG..." />
        </Form.Item>
      </Space>

      <Space className="w-full">
        <Form.Item
          name="region"
          label="Region"
          className="flex-1"
          initialValue="us-east-1"
        >
          <Select>
            <Select.Option value="us-east-1">US East (N. Virginia)</Select.Option>
            <Select.Option value="us-west-2">US West (Oregon)</Select.Option>
            <Select.Option value="eu-west-1">EU (Ireland)</Select.Option>
            <Select.Option value="eu-central-1">EU (Frankfurt)</Select.Option>
            <Select.Option value="ap-southeast-1">Asia Pacific (Singapore)</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item
          name="endpoint_url"
          label={
            <Space>
              <span>Custom Endpoint (Optional)</span>
              <InfoTooltip
                title="MinIO or S3-Compatible"
                content="For MinIO or other S3-compatible services, specify the endpoint URL. Leave empty for AWS S3."
              />
            </Space>
          }
          className="flex-1"
        >
          <Input placeholder="https://minio.example.com" />
        </Form.Item>
      </Space>

      <Form.Item
        name="prefix"
        label={
          <Space>
            <span>Prefix/Folder Path</span>
            <InfoTooltip
              title="S3 Prefix"
              content="Filter objects by prefix. For example: 'documents/' will only process files in the documents folder."
            />
          </Space>
        }
      >
        <Input placeholder="documents/" />
      </Form.Item>

      <Form.Item
        name="file_extensions"
        label="File Extensions"
        initialValue={['.pdf', '.docx', '.txt', '.md']}
      >
        <Select
          mode="tags"
          placeholder="Select or add extensions"
        >
          <Select.Option value=".pdf">PDF (.pdf)</Select.Option>
          <Select.Option value=".docx">Word (.docx)</Select.Option>
          <Select.Option value=".txt">Text (.txt)</Select.Option>
          <Select.Option value=".md">Markdown (.md)</Select.Option>
          <Select.Option value=".csv">CSV (.csv)</Select.Option>
          <Select.Option value=".json">JSON (.json)</Select.Option>
        </Select>
      </Form.Item>

      <Space className="w-full">
        <Form.Item
          name="recursive"
          label="Recursive (Subfolders)"
          valuePropName="checked"
          initialValue={true}
        >
          <Switch />
        </Form.Item>

        <Form.Item
          name="max_file_size_mb"
          label="Max File Size (MB)"
          initialValue={10}
        >
          <InputNumber min={1} max={100} />
        </Form.Item>
      </Space>
    </div>
  );
};

// Web Scraper Configuration Form
export const WebScraperConfigForm: React.FC = () => {
  return (
    <div className="space-y-4">
      <Alert
        message="Web Scraper Configuration"
        description="Extract content from websites, documentation, and knowledge bases. Respects robots.txt and includes rate limiting."
        type="info"
        icon={<Globe size={14} />}
        showIcon
        className="mb-4"
      />

      <Form.Item
        name="start_urls"
        label={
          <Space>
            <span>Start URLs</span>
            <InfoTooltip
              title="Entry Points"
              content="List of URLs to start scraping from. The scraper will follow links based on URL patterns and max depth."
            />
          </Space>
        }
        rules={[{ required: true }]}
      >
        <Select
          mode="tags"
          placeholder="https://docs.example.com, https://blog.example.com"
          style={{ width: '100%' }}
        />
      </Form.Item>

      <Form.Item
        name="url_patterns"
        label={
          <Space>
            <span>URL Patterns (Regex)</span>
            <InfoTooltip
              title="Include Patterns"
              content="Regular expressions to match URLs. Example: ^https://docs\\.example\\.com.* will only scrape docs subdomain."
            />
          </Space>
        }
      >
        <Select
          mode="tags"
          placeholder="^https://docs\.example\.com.*"
          style={{ width: '100%' }}
        />
      </Form.Item>

      <Form.Item
        name="exclude_patterns"
        label="Exclude Patterns (Optional)"
      >
        <Select
          mode="tags"
          placeholder="/api/, /admin/, /login"
          style={{ width: '100%' }}
        />
      </Form.Item>

      <Space className="w-full">
        <Form.Item
          name="max_depth"
          label={
            <Space>
              <span>Max Depth</span>
              <InfoTooltip
                title="Link Depth"
                content="Maximum number of links to follow from start URLs. Depth 1 = only start URLs, Depth 2 = start URLs + first level links, etc."
              />
            </Space>
          }
          initialValue={3}
        >
          <InputNumber min={1} max={10} />
        </Form.Item>

        <Form.Item
          name="wait_time"
          label={
            <Space>
              <span>Wait Time (seconds)</span>
              <InfoTooltip
                title="Rate Limiting"
                content="Delay between requests to avoid overwhelming the server. Recommended: 1-2 seconds."
              />
            </Space>
          }
          initialValue={1}
        >
          <InputNumber min={0.1} max={10} step={0.5} />
        </Form.Item>
      </Space>

      <Divider plain>Content Selectors</Divider>

      <Form.Item
        name="content_selector"
        label={
          <Space>
            <span>Content Selector</span>
            <InfoTooltip
              title="CSS Selector"
              content="CSS selector for main content. Examples: 'article', 'div.content', '#main-text'"
            />
          </Space>
        }
        initialValue="article"
      >
        <Input placeholder="article, div.content, #main" />
      </Form.Item>

      <Space className="w-full">
        <Form.Item
          name="title_selector"
          label="Title Selector"
          className="flex-1"
          initialValue="h1"
        >
          <Input placeholder="h1, h1.title" />
        </Form.Item>

        <Form.Item
          name="author_selector"
          label="Author Selector (Optional)"
          className="flex-1"
        >
          <Input placeholder="span.author, .byline" />
        </Form.Item>
      </Space>

      <Form.Item
        name="respect_robots_txt"
        label="Respect robots.txt"
        valuePropName="checked"
        initialValue={true}
      >
        <Switch />
      </Form.Item>
    </div>
  );
};

// Google Drive Configuration Form
export const GoogleDriveConfigForm: React.FC = () => {
  return (
    <div className="space-y-4">
      <Alert
        message="Google Drive Integration"
        description="Access Google Docs, Sheets, and PDFs from your Drive. Requires OAuth credentials from Google Cloud Console."
        type="info"
        icon={<Cloud size={14} />}
        showIcon
        className="mb-4"
      />

      <Alert
        message="Setup Required"
        description={
          <div>
            <p className="mb-2">To connect Google Drive, you need to:</p>
            <ol className="list-decimal ml-4 space-y-1 text-sm">
              <li>Create a project in Google Cloud Console</li>
              <li>Enable the Google Drive API</li>
              <li>Create OAuth 2.0 credentials</li>
              <li>Download the credentials JSON file</li>
            </ol>
            <a
              href="https://developers.google.com/drive/api/quickstart/python"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-700 text-sm"
            >
              View Google Drive API Setup Guide →
            </a>
          </div>
        }
        type="warning"
        showIcon
        icon={<Info size={14} />}
        className="mb-4"
      />

      <Form.Item
        name="credentials_json"
        label={
          <Space>
            <span>Credentials JSON</span>
            <InfoTooltip
              title="OAuth Credentials"
              content="Paste the entire contents of your credentials.json file from Google Cloud Console."
            />
          </Space>
        }
        rules={[{ required: true, message: 'Credentials are required' }]}
      >
        <TextArea
          rows={6}
          placeholder='{"installed":{"client_id":"...","project_id":"...","auth_uri":"..."}}'
        />
      </Form.Item>

      <Form.Item
        name="folder_ids"
        label={
          <Space>
            <span>Folder IDs</span>
            <InfoTooltip
              title="Drive Folders"
              content="List of folder IDs to index. Find folder ID in the URL: https://drive.google.com/drive/folders/[FOLDER_ID]"
            />
          </Space>
        }
      >
        <Select
          mode="tags"
          placeholder="1abc...xyz, 2def...uvw (or leave empty for all files)"
          style={{ width: '100%' }}
        />
      </Form.Item>

      <Form.Item
        name="file_types"
        label="File Types"
        initialValue={['document', 'pdf']}
      >
        <Select mode="multiple">
          <Select.Option value="document">Google Docs</Select.Option>
          <Select.Option value="spreadsheet">Google Sheets</Select.Option>
          <Select.Option value="presentation">Google Slides</Select.Option>
          <Select.Option value="pdf">PDF Files</Select.Option>
          <Select.Option value="text">Text Files</Select.Option>
        </Select>
      </Form.Item>

      <Space className="w-full">
        <Form.Item
          name="shared_with_me"
          label="Include Shared Files"
          valuePropName="checked"
          initialValue={false}
        >
          <Switch />
        </Form.Item>

        <Form.Item
          name="recursive"
          label="Include Subfolders"
          valuePropName="checked"
          initialValue={true}
        >
          <Switch />
        </Form.Item>
      </Space>
    </div>
  );
};
