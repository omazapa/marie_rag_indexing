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
  const [isLoadingDbs, setIsLoadingDbs] = useState(false);
  const [isLoadingCols, setIsLoadingCols] = useState(false);
  const [isLoadingSchemas, setIsLoadingSchemas] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const connectionString = Form.useWatch('connection_string', form);
  const selectedDb = Form.useWatch('database', form);
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
        const fields: SchemaField[] = Object.entries(collectionData.schema).map(([fieldPath, info]) => {
          const fieldInfo = info as unknown as Record<string, unknown>;
          return {
            name: fieldPath,
            type: (fieldInfo.type as string) || ((fieldInfo.types as string[]) && (fieldInfo.types as string[]).length > 0 ? (fieldInfo.types as string[])[0] : 'unknown'),
            types: (fieldInfo.types as string[]) || [],
            presence: (fieldInfo.percentage as number) || (fieldInfo.presence as number) || 0,
            count: (fieldInfo.count as number) || 0,
            isNested: (fieldInfo.isNested as boolean) || false,
            isArray: (fieldInfo.isArray as boolean) || false,
            arrayElementType: fieldInfo.arrayElementType as string | undefined,
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
              <Space size="small" className="w-full">
                <Text strong className="flex-1">{field.name}</Text>
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

  // Sync checked keys with form
  useEffect(() => {
    if (checkedKeys.length > 0) {
      // Extract selected collections and fields
      const selectedData: Record<string, string[]> = {};

      checkedKeys.forEach((key) => {
        const keyStr = key.toString();
        if (keyStr.includes(':')) {
          const [collection, field] = keyStr.split(':');
          if (!selectedData[collection]) {
            selectedData[collection] = [];
          }
          if (field) {
            selectedData[collection].push(field);
          }
        }
      });

      form.setFieldValue('selected_collections', selectedData);
    }
  }, [checkedKeys, form]);

  return (
    <div className="space-y-4">
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

      {/* Database Selection & Schema Tree */}
      {isConnected && (
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
                  title="Select what to index"
                  description={
                    <div>
                      <Paragraph className="mb-2">
                        Check collections (entire collection) or specific fields to include in RAG indexing.
                        Text fields with high presence are auto-selected.
                      </Paragraph>
                      <Space size="small">
                        <Tag color="blue">string</Tag> = Text field
                        <Tag color="success">90%+</Tag> = High presence
                        <Tag color="cyan">array</Tag> = Array type
                        <Tag color="purple">nested</Tag> = Nested object
                      </Space>
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
                  <Space size="small">
                    <Text type="secondary">
                      {checkedKeys.length} field(s) selected across {Object.keys(collectionsSchemas).length} collection(s)
                    </Text>
                  </Space>
                </div>
              </div>
            )}
          </Space>
        </Card>
      )}

      {/* Query Builder */}
      {selectedDb && treeData.length > 0 && (
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

      {/* Advanced Settings */}
      {selectedDb && treeData.length > 0 && (
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
