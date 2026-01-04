import React, { useState, useEffect, useCallback } from 'react';
import {
  Form,
  Input,
  Select,
  Button,
  App,
  Row,
  Col,
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
  Tree,
} from 'antd';
import type { TreeDataNode } from 'antd';
import { mongodbService } from '@/services/mongodbService';
import {
  Database,
  Table,
  Zap,
  CheckCircle2,
  AlertCircle,
  Layers,
  Filter,
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
  fieldRole?: 'content' | 'metadata'; // New: Role of the field
}

interface CollectionSchema {
  fields: SchemaField[];
  totalDocuments: number;
  sampledDocuments: number;
}

export const MongoDBConfigForm: React.FC<MongoDBConfigFormProps> = ({ form }) => {
  const { message } = App.useApp();
  const [databases, setDatabases] = useState<string[]>([]);
  const [collections, setCollections] = useState<string[]>([]);
  const [collectionsSchemas, setCollectionsSchemas] = useState<Record<string, CollectionSchema>>({});
  const [treeData, setTreeData] = useState<TreeDataNode[]>([]);
  const [checkedKeys, setCheckedKeys] = useState<React.Key[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [contentFields, setContentFields] = useState<Set<string>>(new Set()); // Fields to vectorize
  const [isLoadingDbs, setIsLoadingDbs] = useState(false);
  const [isLoadingCols, setIsLoadingCols] = useState(false);
  const [isLoadingSchemas, setIsLoadingSchemas] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const connectionString = Form.useWatch('connection_string', form);
  const selectedDb = Form.useWatch('database', form);
  const queryMode = Form.useWatch('query_mode', form) || 'all';
  const dataSourceMode = Form.useWatch('data_source_mode', form) || 'collections';

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

  const fetchAllSchemas = useCallback(async (db: string, cols: string[]) => {
    if (!connectionString || !db || cols.length === 0) return;

    setIsLoadingSchemas(true);
    try {
      const result = await mongodbService.getSchemasBatch(connectionString, db, cols);

      const schemasMap: Record<string, CollectionSchema> = {};
      const treeNodes: TreeDataNode[] = [];

      Object.entries(result.collections).forEach(([collectionName, collectionData]) => {
        if (collectionData.error) {
          message.warning(`Failed to load schema for ${collectionName}: ${collectionData.error}`);
          return;
        }

        // Convert schema to field array
        // Schema is now an array of entries, group by field name
        const schemaArray = Array.isArray(collectionData.schema)
          ? collectionData.schema as Array<{ field: string; percentage: number; type: string }>
          : [];

        // Group entries by field name
        const fieldMap = new Map<string, { types: Set<string>; percentages: number[]; maxPercentage: number }>();

        schemaArray.forEach(entry => {
          if (!fieldMap.has(entry.field)) {
            fieldMap.set(entry.field, { types: new Set(), percentages: [], maxPercentage: 0 });
          }
          const fieldData = fieldMap.get(entry.field)!;
          if (entry.type !== 'Undefined') {
            fieldData.types.add(entry.type);
          }
          fieldData.percentages.push(entry.percentage);
          fieldData.maxPercentage = Math.max(fieldData.maxPercentage, entry.percentage);
        });

        // Convert to field array
        const fields: SchemaField[] = Array.from(fieldMap.entries()).map(([fieldPath, fieldData]) => {
          const typesArray = Array.from(fieldData.types);
          const primaryType = typesArray[0] || 'unknown';

          return {
            name: fieldPath,
            type: primaryType.toLowerCase(),
            types: typesArray.map(t => t.toLowerCase()),
            presence: fieldData.maxPercentage,
            count: 0,
            isNested: fieldPath.includes('.'),
            isArray: primaryType === 'Array',
            arrayElementType: undefined,
          };
        });

        schemasMap[collectionName] = {
          fields,
          totalDocuments: collectionData.totalDocuments,
          sampledDocuments: collectionData.sampledDocuments,
        };

        // Build tree node for collection
        const collectionKey = `collection:${collectionName}`;
        // Don't auto-expand - let user expand manually
        // autoExpandKeys.push(collectionKey);

        // Auto-select high-quality text fields
        const fieldNodes: TreeDataNode[] = fields.map(field => {
          const fieldKey = `${collectionName}:${field.name}`;
          // Don't auto-select - let user select manually
          // const isTextField = field.type === 'string' && field.presence > 70 && !field.name.startsWith('_');
          // if (isTextField) {
          //   autoCheckedKeys.push(fieldKey);
          // }

          return {
            title: (
              <Space size="small" className="w-full items-center">
                <Text strong>{field.name}</Text>
                <Tag color={field.type === 'string' ? 'blue' : field.type === 'int' ? 'green' : 'default'} className="text-xs">
                  {field.type}
                </Tag>
                {field.types.length > 1 && (
                  <Tooltip title={`Multiple types: ${field.types.join(', ')}`}>
                    <Tag color="warning" className="text-xs">mixed</Tag>
                  </Tooltip>
                )}
                <Tag color={field.presence >= 90 ? 'success' : field.presence >= 50 ? 'warning' : 'default'} className="text-xs">
                  {field.presence.toFixed(0)}%
                </Tag>
                {field.isArray && <Tag color="cyan" className="text-xs">array</Tag>}
                {field.isNested && <Tag color="purple" className="text-xs">nested</Tag>}
              </Space>
            ),
            key: fieldKey,
            isLeaf: true,
            checkable: true,
          };
        });

        treeNodes.push({
          title: (
            <Space size="small">
              <Table size={16} className="text-blue-600" />
              <Text strong>{collectionName}</Text>
              <Tag color="default" className="text-xs">
                {collectionData.totalDocuments.toLocaleString()} docs
              </Tag>
              <Tag color="geekblue" className="text-xs">
                {fields.length} fields
              </Tag>
            </Space>
          ),
          key: collectionKey,
          children: fieldNodes,
        });
      });

      setCollectionsSchemas(schemasMap);
      setTreeData(treeNodes);
      setExpandedKeys([]); // Start collapsed
      setCheckedKeys([]); // Start with nothing selected

      message.success(`Loaded schemas for ${Object.keys(schemasMap).length} collections`);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      message.error(`Failed to load schemas: ${errMsg}`);
      setCollectionsSchemas({});
      setTreeData([]);
    } finally {
      setIsLoadingSchemas(false);
    }
  }, [connectionString, message]);

  useEffect(() => {
    if (selectedDb) {
      fetchCollections(selectedDb);
      setCollections([]);
      setCollectionsSchemas({});
      setTreeData([]);
      setCheckedKeys([]);
    }
  }, [selectedDb, fetchCollections]);

  useEffect(() => {
    if (selectedDb && collections.length > 0) {
      fetchAllSchemas(selectedDb, collections);
    }
  }, [selectedDb, collections, fetchAllSchemas]);

  // Sync checked keys and content fields with form
  useEffect(() => {
    // Extract selected collections and fields from checked keys
    const selectedData: Record<string, string[]> = {};
    const contentFieldsList: string[] = [];
    const metadataFieldsList: string[] = [];

    checkedKeys.forEach((key) => {
      const keyStr = key.toString();
      if (keyStr.includes(':')) {
        const [collection, field] = keyStr.split(':');
        if (!selectedData[collection]) {
          selectedData[collection] = [];
        }
        if (field) {
          selectedData[collection].push(field);

          // Categorize as content or metadata
          if (contentFields.has(keyStr)) {
            contentFieldsList.push(field);
          } else {
            metadataFieldsList.push(field);
          }
        }
      }
    });

    form.setFieldValue('selected_collections', selectedData);
    form.setFieldValue('content_fields', contentFieldsList);
    form.setFieldValue('metadata_fields', metadataFieldsList);
  }, [checkedKeys, contentFields, form]);

  // Load existing selected collections when editing
  useEffect(() => {
    const existingCollections = form.getFieldValue('selected_collections');
    if (existingCollections && typeof existingCollections === 'object' && Object.keys(existingCollections).length > 0) {
      const keysToCheck: React.Key[] = [];

      Object.entries(existingCollections).forEach(([collection, fields]) => {
        if (Array.isArray(fields)) {
          fields.forEach((field: string) => {
            keysToCheck.push(`${collection}:${field}`);
          });
        }
      });

      if (keysToCheck.length > 0) {
        setCheckedKeys(keysToCheck);
      }
    }
  }, [form, treeData]);

  return (
    <div className="space-y-4">
      {/* Hidden fields for MongoDB config */}
      <Form.Item name="selected_collections" hidden>
        <Input />
      </Form.Item>
      <Form.Item name="content_fields" hidden>
        <Input />
      </Form.Item>
      <Form.Item name="metadata_fields" hidden>
        <Input />
      </Form.Item>

      {/* Connection Section */}
      <Card size="small" className="border-purple-200">
        <Space orientation="vertical" className="w-full" size="middle">
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

      {/* Data Source Mode Selection */}
      {isConnected && (
        <Card size="small" className="border-blue-200">
          <Space orientation="vertical" className="w-full" size="middle">
            <Space className="w-full">
              <Layers size={18} className="text-blue-600" />
              <Text strong>Data Source Mode</Text>
            </Space>

            <Form.Item
              name="data_source_mode"
              label="How do you want to specify what data to index?"
              initialValue="collections"
              rules={[{ required: true }]}
            >
              <Radio.Group size="large">
                <Radio.Button value="collections">
                  <Space>
                    <Table size={14} />
                    <span>Select Collections & Fields</span>
                  </Space>
                </Radio.Button>
                <Radio.Button value="custom_query">
                  <Space>
                    <Filter size={14} />
                    <span>Custom Query/Pipeline</span>
                  </Space>
                </Radio.Button>
              </Radio.Group>
            </Form.Item>

            <Alert
              title={dataSourceMode === 'collections' ? 'Collection-Based Indexing' : 'Custom Query Mode'}
              description={
                dataSourceMode === 'collections'
                  ? 'Browse and select collections, then choose specific fields to index. Great for exploring your data schema.'
                  : 'Write a MongoDB aggregation pipeline or find query. Full control over what documents and fields to index.'
              }
              type="info"
              showIcon
            />
          </Space>
        </Card>
      )}

      {/* Database Selection & Schema Tree (only in collections mode) */}
      {isConnected && dataSourceMode === 'collections' && (
        <Card size="small" className="border-blue-200">
          <Space orientation="vertical" className="w-full" size="middle">
            <Space className="w-full">
              <Layers size={18} className="text-blue-600" />
              <Text strong>Select Collections & Fields for Indexing</Text>
            </Space>

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

            {isLoadingCols && (
              <div className="text-center py-4">
                <Spin tip="Loading collections...">
                  <div className="h-20" />
                </Spin>
              </div>
            )}

            {isLoadingSchemas && (
              <div className="text-center py-4">
                <Spin tip="Analyzing schemas from all collections...">
                  <div className="h-20" />
                </Spin>
              </div>
            )}

            {!isLoadingSchemas && treeData.length > 0 && (
              <div>
                <Alert
                  title="Select fields and choose how to use them"
                  description={
                    <div>
                      <Paragraph className="mb-2">
                        <strong>✓ Check fields</strong> to include in indexing.<br/>
                        <strong>Then choose for each field:</strong>
                      </Paragraph>
                      <Space size="small" direction="vertical" className="ml-4">
                        <div>🔍 <strong>Vectorize</strong> = Field content will be converted to embeddings for semantic search</div>
                        <div>📋 <strong>Metadata</strong> = Field stored as-is for filtering and display (not searchable)</div>
                      </Space>
                      <Paragraph className="mt-3 text-xs text-gray-500">
                        💡 <strong>Tip:</strong> Mark text-rich fields (abstracts, descriptions, content) as "Vectorize".
                        Use "Metadata" for IDs, dates, categories, authors.
                      </Paragraph>
                    </div>
                  }
                  type="info"
                  showIcon
                  className="mb-4"
                />

                <Tree
                  checkable
                  selectable={false}
                  expandedKeys={expandedKeys}
                  checkedKeys={checkedKeys}
                  onCheck={(checked) => {
                    setCheckedKeys(checked as React.Key[]);
                  }}
                  onExpand={(expanded) => {
                    setExpandedKeys(expanded);
                  }}
                  treeData={treeData}
                  className="bg-gray-50 p-4 rounded border"
                />

                <div className="mt-4">
                  {checkedKeys.length > 0 && (
                    <Card size="small" className="bg-gray-50">
                      <Space orientation="vertical" className="w-full" size="middle">
                        <Text strong>Configure how to use each selected field:</Text>
                        <div className="space-y-3">
                          {checkedKeys
                            .filter((key) => key.toString().includes(':'))
                            .map((key) => {
                              const keyStr = key.toString();
                              const fieldName = keyStr.split(':')[1];
                              const isVectorize = contentFields.has(keyStr);

                              return (
                                <div key={keyStr} className="flex items-center justify-between p-2 bg-white rounded border">
                                  <Text strong>{fieldName}</Text>
                                  <Radio.Group
                                    value={isVectorize ? 'vectorize' : 'metadata'}
                                    onChange={(e) => {
                                      const newContentFields = new Set(contentFields);
                                      if (e.target.value === 'vectorize') {
                                        newContentFields.add(keyStr);
                                      } else {
                                        newContentFields.delete(keyStr);
                                      }
                                      setContentFields(newContentFields);
                                    }}
                                    buttonStyle="solid"
                                    size="small"
                                  >
                                    <Radio.Button value="vectorize">🔍 Vectorize</Radio.Button>
                                    <Radio.Button value="metadata">📋 Metadata</Radio.Button>
                                  </Radio.Group>
                                </div>
                              );
                            })}
                        </div>
                        <Alert
                          title="Summary"
                          description={`${contentFields.size} field(s) will be vectorized, ${checkedKeys.length - contentFields.size} as metadata`}
                          type="info"
                          showIcon
                        />
                      </Space>
                    </Card>
                  )}
                </div>
              </div>
            )}
          </Space>
        </Card>
      )}

      {/* Filter Documents (only in collections mode, optional) */}
      {selectedDb && treeData.length > 0 && dataSourceMode === 'collections' && (
        <Card size="small" className="border-orange-200">
          <Space orientation="vertical" className="w-full" size="middle">
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
                  title="MongoDB Query Filter"
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

      {/* Custom Query/Pipeline Mode */}
      {isConnected && dataSourceMode === 'custom_query' && (
        <Card size="small" className="border-orange-200">
          <Space orientation="vertical" className="w-full" size="middle">
            <Space className="w-full">
              <Filter size={18} className="text-orange-600" />
              <Text strong>Custom MongoDB Query or Aggregation Pipeline</Text>
            </Space>

            <Form.Item
              name="database"
              label="Database"
              rules={[{ required: true, message: 'Please select a database' }]}
            >
              <Select
                placeholder="Select a database"
                options={databases.map((db) => ({
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

            <Form.Item
              name="collection"
              label="Collection"
              rules={[{ required: true, message: 'Please select a collection' }]}
            >
              <Select
                placeholder="Select a collection"
                options={collections.map((col) => ({
                  label: (
                    <Space>
                      <Table size={14} />
                      <span>{col}</span>
                    </Space>
                  ),
                  value: col,
                }))}
                showSearch
                size="large"
                loading={isLoadingCols}
                disabled={!selectedDb || isLoadingCols}
              />
            </Form.Item>

            <Alert
              title="Write your MongoDB query"
              description="You can use a find() query (JSON object) or an aggregation pipeline (JSON array). The system will automatically handle field extraction."
              type="info"
              showIcon
            />

            <Form.Item
              name="custom_query"
              label={
                <Space>
                  <span>Query or Pipeline (JSON)</span>
                  <InfoTooltip
                    title="MongoDB Query/Pipeline"
                    content="Find query: {} or {field: value}. Aggregation: [{$match: {}}, {$project: {}}]"
                  />
                </Space>
              }
              rules={[{ required: true, message: 'Query is required in custom mode' }]}
            >
              <TextArea
                rows={8}
                placeholder='Find query: {"status": "published", "year": {"$gte": 2020}}

Or aggregation pipeline:
[
  {"$match": {"status": "published"}},
  {"$project": {"title": 1, "content": 1}}
]'
                className="font-mono text-sm"
              />
            </Form.Item>

            <Alert
              title="Specify which fields to vectorize"
              description="Enter comma-separated field names. Fields to vectorize will be converted to embeddings for semantic search. All other fields become metadata."
              type="warning"
              showIcon
            />

            <Form.Item
              name="custom_content_fields"
              label={
                <Space>
                  <span>Fields to Vectorize</span>
                  <InfoTooltip
                    title="Content Fields"
                    content="Comma-separated field names to vectorize (e.g., 'abstract,title,description'). These will be combined and converted to embeddings."
                  />
                </Space>
              }
              rules={[{ required: true }]}
            >
              <Input placeholder="e.g. abstract, title, content" />
            </Form.Item>

            <Form.Item
              name="custom_metadata_fields"
              label={
                <Space>
                  <span>Metadata Fields (Optional)</span>
                  <InfoTooltip
                    title="Metadata Fields"
                    content="Comma-separated field names to store as metadata only (e.g., 'author,year,doi'). Used for filtering, not search."
                  />
                </Space>
              }
            >
              <Input placeholder="e.g. author, year, doi, category" />
            </Form.Item>

            <Form.Item
              name="limit"
              label={
                <Space>
                  <span>Document Limit (Optional)</span>
                  <InfoTooltip
                    title="Limit Documents"
                    content="Maximum number of documents to process. Leave empty for all."
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
          </Space>
        </Card>
      )}

      {/* Advanced Settings */}
      {selectedDb && treeData.length > 0 && dataSourceMode === 'collections' && (
        <Collapse
          items={[
            {
              key: 'advanced',
              label: 'Advanced Settings',
              children: (
                <Space orientation="vertical" className="w-full">
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
