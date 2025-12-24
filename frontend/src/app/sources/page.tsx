'use client';

import React, { useState } from 'react';
import { 
  Table, 
  Button, 
  Space, 
  Card, 
  Typography, 
  Tag, 
  Modal, 
  Form, 
  Input, 
  Select, 
  Switch,
  App,
  Spin,
  Tree,
  Divider
} from 'antd';
import { Plus, Play, Settings, Trash2, Search } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sourceService, DataSource } from '@/services/sourceService';
import { pluginService } from '@/services/pluginService';
import { ingestionService } from '@/services/ingestionService';
import { LogViewer } from '@/components/LogViewer';
import { mongodbService } from '@/services/mongodbService';

const { Title, Text } = Typography;

// Helper to convert flat paths to Tree data
const buildTreeData = (paths: string[]) => {
  const root: any[] = [];
  paths.forEach(path => {
    const parts = path.split('.');
    let currentLevel = root;
    parts.forEach((part, index) => {
      const existingPath = parts.slice(0, index + 1).join('.');
      let node = currentLevel.find(n => n.key === existingPath);
      if (!node) {
        node = {
          title: part,
          key: existingPath,
          children: [],
        };
        currentLevel.push(node);
      }
      currentLevel = node.children;
    });
  });
  return root;
};

export default function SourcesPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();
  const selectedType = Form.useWatch('type', form);
  const mongoConnStr = Form.useWatch('connection_string', form);
  const mongoDb = Form.useWatch('database', form);
  const mongoColl = Form.useWatch('collection', form);
  const mongoQueryMode = Form.useWatch('query_mode', form);
  const metadataFields = Form.useWatch('metadata_fields', form);

  const [databases, setDatabases] = useState<string[]>([]);
  const [collections, setCollections] = useState<string[]>([]);
  const [schema, setSchema] = useState<string[]>([]);
  const [isTestingConn, setIsTestingConn] = useState(false);
  const [treeSearch, setTreeSearch] = useState('');

  const treeData = React.useMemo(() => {
    const data = buildTreeData(schema);
    if (!treeSearch) return data;
    
    const filterTree = (nodes: any[]): any[] => {
      return nodes
        .map(node => ({ ...node }))
        .filter(node => {
          if (node.key.toLowerCase().includes(treeSearch.toLowerCase())) return true;
          if (node.children) {
            node.children = filterTree(node.children);
            return node.children.length > 0;
          }
          return false;
        });
    };
    return filterTree(data);
  }, [schema, treeSearch]);

  const handleCheckConnection = async () => {
    if (!mongoConnStr || !mongoConnStr.includes('mongodb')) {
      message.warning('Please enter a valid MongoDB connection string');
      return;
    }
    
    setIsTestingConn(true);
    setDatabases([]);
    setCollections([]);
    setSchema([]);
    form.setFieldsValue({ database: undefined, collection: undefined, content_field: undefined, metadata_fields: [] });

    try {
      const res = await mongodbService.getDatabases(mongoConnStr);
      setDatabases(res.databases);
      message.success('Connected to MongoDB successfully');
    } catch (err) {
      message.error('Failed to connect to MongoDB');
    } finally {
      setIsTestingConn(false);
    }
  };

  // Reset dependent fields when database changes
  React.useEffect(() => {
    if (selectedType === 'mongodb') {
      setCollections([]);
      setSchema([]);
      form.setFieldsValue({ collection: undefined, content_field: undefined, metadata_fields: [] });
    }
  }, [mongoDb, form, selectedType]);

  // Fetch Collections when connection string and database are provided
  React.useEffect(() => {
    if (selectedType === 'mongodb' && mongoConnStr && mongoDb) {
      mongodbService.getCollections(mongoConnStr, mongoDb)
        .then(res => setCollections(res.collections))
        .catch(() => message.error('Failed to fetch MongoDB collections'));
    }
  }, [selectedType, mongoConnStr, mongoDb]);

  // Fetch Schema when collection is selected
  React.useEffect(() => {
    if (selectedType === 'mongodb' && mongoConnStr && mongoDb && mongoColl && !mongoQueryMode) {
      mongodbService.getSchema(mongoConnStr, mongoDb, mongoColl)
        .then(res => setSchema(res.schema))
        .catch(() => message.error('Failed to fetch collection schema'));
    }
  }, [selectedType, mongoConnStr, mongoDb, mongoColl, mongoQueryMode]);

  // Fetch Sources
  const { data: sources, isLoading: isLoadingSources } = useQuery({
    queryKey: ['sources'],
    queryFn: sourceService.getSources,
  });

  // Fetch Plugins
  const { data: plugins } = useQuery({
    queryKey: ['plugins'],
    queryFn: pluginService.getPlugins,
  });

  // Add Source Mutation
  const addSourceMutation = useMutation({
    mutationFn: sourceService.addSource,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources'] });
      setIsModalOpen(false);
      form.resetFields();
      message.success('Data source added successfully');
    },
    onError: () => {
      message.error('Failed to add data source');
    }
  });

  // Trigger Ingestion Mutation
  const ingestMutation = useMutation({
    mutationFn: ingestionService.triggerIngestion,
    onSuccess: () => {
      message.success('Ingestion started successfully');
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || 'Failed to start ingestion');
    }
  });

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <a>{text}</a>,
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => <Tag color="blue">{type.toUpperCase()}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'active' ? 'green' : status === 'error' ? 'red' : 'default'}>
          {status.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Last Run',
      dataIndex: 'lastRun',
      key: 'lastRun',
    },
    {
      title: 'Action',
      key: 'action',
      render: (_: any, record: DataSource) => (
        <Space size="middle">
          <Button 
            type="text" 
            icon={<Play size={16} />} 
            loading={ingestMutation.isPending}
            onClick={() => ingestMutation.mutate({
              plugin_id: record.type,
              config: record.config,
              chunk_settings: {
                method: 'recursive',
                chunk_size: 1000,
                chunk_overlap: 200
              },
              index_name: record.name.toLowerCase().replace(/\s+/g, '_')
            })} 
          />
          <Button type="text" icon={<Settings size={16} />} />
          <Button type="text" danger icon={<Trash2 size={16} />} />
        </Space>
      ),
    },
  ];

  const handleAddSource = (values: any) => {
    let config = {};
    
    if (values.type === 'local_file') {
      config = { path: values.path, recursive: values.recursive };
    } else if (values.type === 'mongodb') {
      let query = {};
      if (values.query_mode && values.query) {
        try {
          query = JSON.parse(values.query);
        } catch (e) {
          message.error('Invalid MongoDB Query JSON');
          return;
        }
      }
      config = {
        connection_string: values.connection_string,
        database: values.database,
        collection: values.collection,
        query_mode: values.query_mode,
        query: query,
        content_field: values.content_field,
        metadata_fields: values.metadata_fields
      };
    } else if (values.type === 's3') {
      config = {
        bucket_name: values.bucket_name,
        prefix: values.prefix,
        endpoint_url: values.endpoint_url,
        aws_access_key_id: values.aws_access_key_id,
        aws_secret_access_key: values.aws_secret_access_key,
        region_name: values.region_name
      };
    } else if (values.type === 'sql') {
      config = {
        connection_string: values.connection_string,
        query: values.query,
        content_column: values.content_column,
        metadata_columns: values.metadata_columns
      };
    } else if (values.type === 'web_scraper') {
      config = { base_url: values.base_url, max_depth: values.max_depth };
    } else if (values.type === 'local_file') {
      config = { path: values.path, recursive: values.recursive, extensions: values.extensions };
    }

    addSourceMutation.mutate({
      name: values.name,
      type: values.type,
      config: config
    });
  };

  if (isLoadingSources) {
    return <div className="flex justify-center items-center h-64"><Spin size="large" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Title level={2}>Data Sources</Title>
        <Button type="primary" icon={<Plus size={16} />} onClick={() => setIsModalOpen(true)}>
          Add Source
        </Button>
      </div>

      <Card>
        <Table columns={columns} dataSource={sources} rowKey="id" />
      </Card>

      <div style={{ marginTop: '24px' }}>
        <LogViewer />
      </div>

      <Modal 
        title="Add New Data Source" 
        open={isModalOpen} 
        onOk={() => form.submit()} 
        onCancel={() => setIsModalOpen(false)}
        confirmLoading={addSourceMutation.isPending}
      >
        <Form form={form} layout="vertical" onFinish={handleAddSource}>
          <Form.Item name="name" label="Source Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Documentation Folder" />
          </Form.Item>
          <Form.Item name="type" label="Source Type" rules={[{ required: true }]}>
            <Select placeholder="Select a plugin">
              {plugins?.map(plugin => (
                <Select.Option key={plugin.id} value={plugin.id}>{plugin.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>

          {selectedType === 'mongodb' ? (
            <>
              <Form.Item label="Connection String" required>
                <Space.Compact style={{ width: '100%' }}>
                  <Form.Item
                    name="connection_string"
                    noStyle
                    rules={[{ required: true, message: 'Connection string is required' }]}
                  >
                    <Input placeholder="mongodb://localhost:27017" />
                  </Form.Item>
                  <Button 
                    type="primary" 
                    onClick={handleCheckConnection}
                    loading={isTestingConn}
                  >
                    Check Connection
                  </Button>
                </Space.Compact>
              </Form.Item>
              <Form.Item name="database" label="Database" rules={[{ required: true }]}>
                <Select placeholder="Select database" loading={isTestingConn}>
                  {databases.map(db => <Select.Option key={db} value={db}>{db}</Select.Option>)}
                </Select>
              </Form.Item>
              <Form.Item name="query_mode" label="Query Mode" valuePropName="checked">
                <Switch unCheckedChildren="Collection" checkedChildren="Custom Query" />
              </Form.Item>
              
              <Form.Item name="collection" label="Collection" rules={[{ required: true }]}>
                <Select placeholder="Select collection">
                  {collections.map(c => <Select.Option key={c} value={c}>{c}</Select.Option>)}
                </Select>
              </Form.Item>

              {mongoQueryMode ? (
                <Form.Item name="query" label="MongoDB Query (JSON)" rules={[{ required: true }]}>
                  <Input.TextArea placeholder='{"status": "active"}' rows={4} />
                </Form.Item>
              ) : (
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <Title level={5}>Field Selection</Title>
                  <Text type="secondary" className="block mb-4">
                    Select which field contains the main text and which ones should be stored as metadata.
                  </Text>
                  
                  <Form.Item name="content_field" label="Content Field (Main Text)" rules={[{ required: true }]}>
                    <Select 
                      showSearch
                      placeholder="Select the primary text field"
                      options={schema.map(s => ({ label: s, value: s }))}
                    />
                  </Form.Item>

                  <Divider />

                  <Form.Item name="metadata_fields" label="Metadata Fields (Context)">
                    <div className="border rounded bg-white p-2 max-h-64 overflow-auto">
                      <Input 
                        placeholder="Search fields..." 
                        prefix={<Search size={14} />}
                        className="mb-2"
                        onChange={e => setTreeSearch(e.target.value)}
                      />
                      <Tree
                        checkable
                        selectable={false}
                        treeData={treeData}
                        checkedKeys={metadataFields || []}
                        onCheck={(checkedKeys: any) => {
                          form.setFieldsValue({ metadata_fields: checkedKeys });
                        }}
                        height={200}
                      />
                    </div>
                  </Form.Item>
                </div>
              )}
            </>
          ) : selectedType === 's3' ? (
            <>
              <Form.Item name="bucket_name" label="Bucket Name" rules={[{ required: true }]}>
                <Input placeholder="my-bucket" />
              </Form.Item>
              <Form.Item name="prefix" label="Prefix (Optional)">
                <Input placeholder="docs/" />
              </Form.Item>
              <Form.Item name="endpoint_url" label="Endpoint URL (Optional, for MinIO)">
                <Input placeholder="http://localhost:9000" />
              </Form.Item>
              <Form.Item name="aws_access_key_id" label="Access Key ID">
                <Input />
              </Form.Item>
              <Form.Item name="aws_secret_access_key" label="Secret Access Key">
                <Input.Password />
              </Form.Item>
              <Form.Item name="region_name" label="Region" initialValue="us-east-1">
                <Input />
              </Form.Item>
            </>
          ) : selectedType === 'sql' ? (
            <>
              <Form.Item name="connection_string" label="Connection String" rules={[{ required: true }]}>
                <Input placeholder="postgresql://user:pass@localhost/db" />
              </Form.Item>
              <Form.Item name="query" label="SQL Query" rules={[{ required: true }]}>
                <Input.TextArea placeholder="SELECT * FROM documents" rows={4} />
              </Form.Item>
              <Form.Item name="content_column" label="Content Column" initialValue="content">
                <Input />
              </Form.Item>
              <Form.Item name="metadata_columns" label="Metadata Columns (Comma separated)">
                <Select mode="tags" placeholder="Enter column names" />
              </Form.Item>
            </>
          ) : selectedType === 'web_scraper' ? (
            <>
              <Form.Item name="base_url" label="Base URL" rules={[{ required: true }]}>
                <Input placeholder="https://docs.example.com" />
              </Form.Item>
              <Form.Item name="max_depth" label="Max Depth" initialValue={1}>
                <Select>
                  <Select.Option value={0}>0 (Only this page)</Select.Option>
                  <Select.Option value={1}>1 (One level deep)</Select.Option>
                  <Select.Option value={2}>2 (Two levels deep)</Select.Option>
                </Select>
              </Form.Item>
            </>
          ) : selectedType === 'local_file' ? (
            <>
              <Form.Item name="path" label="Directory Path" rules={[{ required: true }]}>
                <Input placeholder="/home/user/documents" />
              </Form.Item>
              <Form.Item name="recursive" label="Recursive Scanning" valuePropName="checked" initialValue={true}>
                <Switch />
              </Form.Item>
              <Form.Item name="extensions" label="File Extensions" initialValue={['.txt', '.md', '.pdf']}>
                <Select mode="tags" placeholder="e.g. .txt, .md" />
              </Form.Item>
            </>
          ) : (
            <>
              <Form.Item name="path" label="Path / URL / Connection String" rules={[{ required: true }]}>
                <Input placeholder="/path/to/docs or https://example.com" />
              </Form.Item>
              <Form.Item name="recursive" label="Recursive Scanning" valuePropName="checked" initialValue={true}>
                <Switch />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>
    </div>
  );
}

