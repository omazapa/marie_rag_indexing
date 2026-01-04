import React, { useState, useEffect, useCallback } from 'react';
import {
  Form,
  Input,
  Select,
  Button,
  App,
  Row,
  Col,
  Divider,
  FormInstance,
  Card,
  Typography,
  Space,
  Tag,
  Collapse,
  Alert,
  Checkbox,
  Radio,
  InputNumber,
  Tooltip,
  Spin,
} from 'antd';
import { mongodbService } from '@/services/mongodbService';
import {
  Database,
  Table,
  Zap,
  CheckCircle2,
  AlertCircle,
  FileText,
  Eye,
  Filter,
  Layers,
  Info,
} from 'lucide-react';
import { InfoTooltip } from './InfoTooltip';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

interface MongoDBConfigFormProps {
  form: FormInstance;
}

interface SchemaField {
  name: string;
  type: string;
  types: string[];
  presence: number;
  count: number;
  isNested: boolean;
  isArray: boolean;
  arrayElementType?: string;
}

export const MongoDBConfigForm: React.FC<MongoDBConfigFormProps> = ({ form }) => {
  const { message } = App.useApp();
  const [databases, setDatabases] = useState<string[]>([]);
  const [collections, setCollections] = useState<string[]>([]);
  const [schema, setSchema] = useState<SchemaField[]>([]);
  const [sampleDoc, setSampleDoc] = useState<Record<string, unknown> | null>(null);
  const [schemaStats, setSchemaStats] = useState<{ total: number; sampled: number } | null>(null);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [isLoadingDbs, setIsLoadingDbs] = useState(false);
  const [isLoadingCols, setIsLoadingCols] = useState(false);
  const [isLoadingSchema, setIsLoadingSchema] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const connectionString = Form.useWatch('connection_string', form);
  const selectedDb = Form.useWatch('database', form);
  const selectedCollection = Form.useWatch('collection', form);
  const queryMode = Form.useWatch('query_mode', form) || 'all';

  const testConnection = async () => {
    if (!connectionString) {
      message.warning('Please enter a connection string first');
      return;
    }

    setIsLoadingDbs(true);
    setConnectionStatus('idle');

    console.log('Testing MongoDB connection:', connectionString);

    try {
      const result = await mongodbService.getDatabases(connectionString);
      console.log('MongoDB connection successful:', result);

      setDatabases(result.databases);
      setIsConnected(true);
      setConnectionStatus('success');
      message.success({
        content: `Connected! Found ${result.databases.length} databases`,
        icon: <CheckCircle2 size={16} className="text-green-500" />,
      });
    } catch (error: unknown) {
      console.error('MongoDB Connection Error:', error);
      setIsConnected(false);
      setConnectionStatus('error');
      setDatabases([]);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const axiosError = error as any;
      let errMsg = 'Unknown error occurred';

      if (axiosError.response) {
        // Server responded with error
        console.error('Server error response:', axiosError.response);
        errMsg = axiosError.response.data?.error || `Server Error (${axiosError.response.status})`;
      } else if (axiosError.request) {
        // Request made but no response
        console.error('No response from server:', axiosError.request);
        errMsg = 'No response from backend. Check if the backend is running on port 5001.';
      } else if (axiosError.message) {
        // Error setting up request
        console.error('Request setup error:', axiosError.message);
        errMsg = axiosError.message;
      }

      message.error({
        content: `Connection failed: ${errMsg}`,
        icon: <AlertCircle size={16} className="text-red-500" />,
        duration: 8,
      });
    } finally {
      setIsLoadingDbs(false);
    }
  };

  const fetchCollections = useCallback(async (db: string) => {
    if (!connectionString || !db) return;
    setIsLoadingCols(true);
    try {
      const result = await mongodbService.getCollections(connectionString, db);
      setCollections(result.collections);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      message.error(`Failed to load collections: ${errMsg}`);
    } finally {
      setIsLoadingCols(false);
    }
  }, [connectionString, message]);

  const fetchSchema = useCallback(async (db: string, collection: string) => {
    if (!connectionString || !db || !collection) return;
    setIsLoadingSchema(true);
    try {
      const result = await mongodbService.getSchema(connectionString, db, collection);

      // Convert schema object to field array
      const fields: SchemaField[] = Object.entries(result.schema).map(([fieldPath, info]) => ({
        name: fieldPath,
        type: info.type,
        types: info.types,
        presence: info.presence,
        count: info.count,
        isNested: info.isNested,
        isArray: info.isArray,
        arrayElementType: info.arrayElementType,
      }));

      setSchema(fields);
      setSchemaStats({
        total: result.totalDocuments,
        sampled: result.sampledDocuments,
      });
      setSampleDoc(result.sampleDocument || null);

      // Auto-select text fields (string type with high presence)
      const autoSelectedFields = fields
        .filter(f => f.type === 'string' && f.presence > 80 && !f.name.startsWith('_'))
        .map(f => f.name);
      setSelectedFields(autoSelectedFields);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      message.error(`Failed to load schema: ${errMsg}`);
      setSchema([]);
      setSampleDoc(null);
      setSchemaStats(null);
    } finally {
      setIsLoadingSchema(false);
    }
  }, [connectionString, message]);

  useEffect(() => {
    if (selectedDb) {
      fetchCollections(selectedDb);
      setCollections([]);
      setSchema([]);
      setSampleDoc(null);
    }
  }, [selectedDb, fetchCollections]);

  useEffect(() => {
    if (selectedDb && selectedCollection) {
      fetchSchema(selectedDb, selectedCollection);
    } else {
      setSchema([]);
      setSampleDoc(null);
    }
  }, [selectedDb, selectedCollection, fetchSchema]);

  // Helper to detect text fields based on type and presence
  const textFields = schema.filter(f =>
    f.type === 'string' &&
    !f.name.startsWith('_') &&
    f.presence > 50
  );

  // Sync selected fields with form when they change
  useEffect(() => {
    if (selectedFields.length > 0) {
      form.setFieldValue('text_fields', selectedFields);
    }
  }, [selectedFields, form]);

  // Helper to detect metadata fields
  const metadataFields = schema.filter(f =>
    !textFields.includes(f) &&
    !f.name.startsWith('_') &&
    !f.isNested
  );

  return (
    <div className="space-y-4">
      {/* Connection Section */}
      <Card size="small" className="border-purple-200">
        <Space direction="vertical" className="w-full" size="middle">
          <Space className="w-full">
            <Database size={18} className="text-purple-600" />
            <Text strong>MongoDB Connection</Text>
          </Space>

          <Row gutter={8} align="top">
            <Col span={19}>
              <Form.Item
                name="connection_string"
                rules={[{ required: true, message: 'Connection URI is required' }]}
                className="mb-0"
                initialValue="mongodb://192.168.1.10:27017"
              >
                <Input.Password
                  placeholder="mongodb://user:pass@host:port or mongodb://host:port"
                  prefix={<Database size={14} />}
                  size="large"
                />
              </Form.Item>
            </Col>
            <Col span={5}>
              <Button
                icon={connectionStatus === 'success' ? <CheckCircle2 size={14} /> : <Zap size={14} />}
                onClick={testConnection}
                loading={isLoadingDbs}
                block
                size="large"
                type={connectionStatus === 'success' ? 'primary' : 'default'}
                className={connectionStatus === 'success' ? 'bg-green-500 hover:bg-green-600' : ''}
              >
                {connectionStatus === 'success' ? 'Connected' : 'Test'}
              </Button>
            </Col>
          </Row>

          {connectionStatus === 'success' && (
            <Alert
              title="Connection successful"
              description={`Found ${databases.length} database(s). Select one to continue.`}
              type="success"
              showIcon
              icon={<CheckCircle2 size={14} />}
              closable
            />
          )}

          {connectionStatus === 'error' && (
            <Alert
              title="Connection failed"
              description="Check your connection string, network, and MongoDB server status."
              type="error"
              showIcon
              icon={<AlertCircle size={14} />}
              closable
            />
          )}
        </Space>
      </Card>

      {/* Database & Collection Selection */}
      {isConnected && (
        <Card size="small" className="border-blue-200">
          <Space direction="vertical" className="w-full" size="middle">
            <Space className="w-full">
              <Layers size={18} className="text-blue-600" />
              <Text strong>Select Data Source</Text>
            </Space>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="database"
                  label="Database"
                  rules={[{ required: true, message: 'Select a database' }]}
                >
                  <Select
                    placeholder="Choose database"
                    loading={isLoadingDbs}
                    options={databases.map(db => ({
                      label: (
                        <Space>
                          <Database size={14} />
                          <span>{db}</span>
                        </Space>
                      ),
                      value: db,
                    }))}
                    showSearch
                    size="large"
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="collection"
                  label="Collection"
                  rules={[{ required: true, message: 'Select a collection' }]}
                >
                  <Select
                    placeholder="Choose collection"
                    loading={isLoadingCols}
                    options={collections.map(col => ({
                      label: (
                        <Space>
                          <Table size={14} />
                          <span>{col}</span>
                        </Space>
                      ),
                      value: col,
                    }))}
                    showSearch
                    disabled={!selectedDb}
                    size="large"
                  />
                </Form.Item>
              </Col>
            </Row>
          </Space>
        </Card>
      )}

      {/* Schema Preview & Field Selection */}
      {selectedDb && selectedCollection && schema.length > 0 && (
        <Card size="small" className="border-green-200">
          <Space direction="vertical" className="w-full" size="middle">
            <Space className="w-full justify-between">
              <Space>
                <FileText size={18} className="text-green-600" />
                <Text strong>Field Mapping for RAG</Text>
              </Space>
              {isLoadingSchema && <Spin size="small" />}
            </Space>

            <Collapse
              items={[
                {
                  key: 'schema',
                  label: (
                    <Space>
                      <Eye size={14} />
                      <span>
                        View Schema Analysis ({schema.length} fields from {schemaStats?.sampled} sampled documents)
                      </span>
                    </Space>
                  ),
                  children: (
                    <div className="space-y-4">
                      <Alert
                        title="Schema Analysis"
                        description={`Analyzed ${schemaStats?.sampled} of ${schemaStats?.total} total documents to understand the collection structure.`}
                        type="info"
                        showIcon
                        className="mb-4"
                      />

                      <div>
                        <div className="flex justify-between items-center mb-3">
                          <Text strong>Available Fields - Select for Indexing:</Text>
                          <Space>
                            <Button
                              size="small"
                              onClick={() => setSelectedFields(schema.filter(f => !f.name.startsWith('_')).map(f => f.name))}
                            >
                              Select All
                            </Button>
                            <Button size="small" onClick={() => setSelectedFields([])}>
                              Clear All
                            </Button>
                          </Space>
                        </div>

                        <div className="max-h-96 overflow-y-auto border rounded p-3 bg-gray-50">
                          <Checkbox.Group
                            value={selectedFields}
                            onChange={(checkedValues) => setSelectedFields(checkedValues as string[])}
                            className="w-full"
                          >
                            <Space direction="vertical" className="w-full" size="small">
                              {schema.map(field => (
                                <div
                                  key={field.name}
                                  className="flex items-center justify-between p-2 hover:bg-white rounded transition-colors"
                                >
                                  <Checkbox value={field.name} disabled={field.name === '_id'}>
                                    <Space size="small">
                                      <Text strong>{field.name}</Text>
                                      {field.isNested && (
                                        <Tag color="purple" className="text-xs">nested</Tag>
                                      )}
                                      {field.isArray && (
                                        <Tag color="cyan" className="text-xs">
                                          array{field.arrayElementType ? ` of ${field.arrayElementType}` : ''}
                                        </Tag>
                                      )}
                                    </Space>
                                  </Checkbox>
                                  <Space size="small">
                                    <Tag color={field.type === 'string' ? 'blue' : field.type === 'int' || field.type === 'double' ? 'green' : 'default'}>
                                      {field.type}
                                      {field.types.length > 1 && (
                                        <Tooltip title={`Multiple types: ${field.types.join(', ')}`}>
                                          <Text className="ml-1 text-xs">+{field.types.length - 1}</Text>
                                        </Tooltip>
                                      )}
                                    </Tag>
                                    <Tooltip title={`Present in ${field.count} of ${schemaStats?.sampled} sampled documents`}>
                                      <Tag color={field.presence >= 90 ? 'success' : field.presence >= 50 ? 'warning' : 'default'}>
                                        {field.presence.toFixed(1)}%
                                      </Tag>
                                    </Tooltip>
                                  </Space>
                                </div>
                              ))}
                            </Space>
                          </Checkbox.Group>
                        </div>
                      </div>

                      {sampleDoc && (
                        <div>
                          <Text type="secondary" className="block mb-2">Sample Document Preview:</Text>
                          <pre className="bg-gray-50 p-3 rounded text-xs overflow-auto max-h-64 border">
                            {JSON.stringify(sampleDoc, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  ),
                },
              ]}
            />

            <Alert
              title="Field Selection Tips"
              description="Text fields contain the main content for indexing. Metadata fields provide context and filtering options."
              type="info"
              showIcon
              icon={<Info size={14} />}
            />

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="text_fields"
                  label={
                    <Space>
                      <span>Text Fields (Content)</span>
                      <InfoTooltip
                        title="Content Fields"
                        content="Fields containing the main text to be indexed. Multiple fields will be concatenated. Choose fields like 'content', 'body', 'text', or 'description'."
                      />
                    </Space>
                  }
                  rules={[{ required: true, message: 'Select at least one text field' }]}
                  initialValue={textFields.length > 0 ? [textFields[0].name] : []}
                >
                  <Select
                    mode="multiple"
                    placeholder="Select text fields"
                    options={schema
                      .filter(f => !f.name.startsWith('_'))
                      .map(f => ({
                        label: (
                          <Space>
                            <FileText size={12} />
                            <span>{f.name}</span>
                            <Tag color="blue" className="text-xs">{f.type}</Tag>
                            {textFields.includes(f) && <Tag color="green" className="text-xs">Recommended</Tag>}
                          </Space>
                        ),
                        value: f.name,
                      }))}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="metadata_fields"
                  label={
                    <Space>
                      <span>Metadata Fields (Context)</span>
                      <InfoTooltip
                        title="Metadata Fields"
                        content="Additional fields to include as metadata for filtering and context. Examples: author, date, category, tags."
                      />
                    </Space>
                  }
                  initialValue={[]}
                >
                  <Select
                    mode="multiple"
                    placeholder="Select metadata fields"
                    options={schema
                      .filter(f => !f.name.startsWith('_') && !f.isNested)
                      .map(f => ({
                        label: (
                          <Space>
                            <span>{f.name}</span>
                            <Tag color="purple" className="text-xs">{f.type}</Tag>
                          </Space>
                        ),
                        value: f.name,
                      }))}
                  />
                </Form.Item>
              </Col>
            </Row>
          </Space>
        </Card>
      )}

      {/* Query Builder */}
      {selectedDb && selectedCollection && (
        <Card size="small" className="border-orange-200">
          <Space direction="vertical" className="w-full" size="middle">
            <Space className="w-full">
              <Filter size={18} className="text-orange-600" />
              <Text strong>Filter Documents (Optional)</Text>
            </Space>

            <Form.Item
              name="query_mode"
              label="Query Mode"
              initialValue="all"
            >
              <Radio.Group>
                <Radio.Button value="all">
                  <Space>
                    <Layers size={14} />
                    <span>Index All Documents</span>
                  </Space>
                </Radio.Button>
                <Radio.Button value="filter">
                  <Space>
                    <Filter size={14} />
                    <span>Apply Filter</span>
                  </Space>
                </Radio.Button>
              </Radio.Group>
            </Form.Item>

            {queryMode === 'filter' && (
              <div className="space-y-4">
                <Alert
                  message="MongoDB Query Filter"
                  description="Write a MongoDB query to filter documents. Example: status equals published and views greater than 100"
                  type="warning"
                  showIcon
                />

                <Form.Item
                  name="filter_query"
                  label={
                    <Space>
                      <span>MongoDB Filter (JSON)</span>
                      <InfoTooltip
                        title="Filter Query"
                        content="Valid MongoDB query in JSON format. Use operators like $gt, $lt, $in, $regex, etc."
                      />
                    </Space>
                  }
                >
                  <TextArea
                    rows={4}
                    placeholder='{"status": "published", "date": {"$gte": "2024-01-01"}}'
                    className="font-mono text-sm"
                  />
                </Form.Item>

                <Form.Item
                  name="limit"
                  label={
                    <Space>
                      <span>Document Limit (Optional)</span>
                      <InfoTooltip
                        title="Limit Documents"
                        content="Maximum number of documents to index. Leave empty to index all matching documents."
                      />
                    </Space>
                  }
                >
                  <InputNumber
                    min={1}
                    max={1000000}
                    placeholder="No limit"
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </div>
            )}
          </Space>
        </Card>
      )}

      {/* Advanced Settings */}
      {selectedDb && selectedCollection && (
        <Collapse
          items={[
            {
              key: 'advanced',
              label: 'Advanced Settings',
              children: (
                <Space direction="vertical" className="w-full">
                  <Form.Item
                    name="batch_size"
                    label={
                      <Space>
                        <span>Batch Size</span>
                        <InfoTooltip
                          title="Processing Batch Size"
                          content="Number of documents to process at once. Higher values = faster but more memory. Recommended: 500-1000."
                        />
                      </Space>
                    }
                    initialValue={500}
                  >
                    <InputNumber min={10} max={5000} style={{ width: '100%' }} />
                  </Form.Item>

                  <Form.Item
                    name="include_id"
                    valuePropName="checked"
                    initialValue={true}
                  >
                    <Checkbox>Include MongoDB _id in metadata</Checkbox>
                  </Form.Item>
                </Space>
              ),
            },
          ]}
        />
      )}
    </div>
  );
};
