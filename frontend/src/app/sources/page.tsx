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
  Divider,
  InputNumber,
  Flex,
  Breadcrumb
} from 'antd';
import { Plus, Play, Settings, Trash2, Search, Bot, Database as DbIcon, Globe, FileCode, Folder } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Welcome } from '@ant-design/x';
import { sourceService, DataSource } from '@/services/sourceService';
import { pluginService, ConfigSchema } from '@/services/pluginService';
import { ingestionService } from '@/services/ingestionService';
import { assistantService } from '@/services/assistantService';
import { LogViewer } from '@/components/LogViewer';
import { mongodbService } from '@/services/mongodbService';
import { modelService } from '@/services/modelService';
import { vectorStoreService } from '@/services/vectorStoreService';
import { BRAND_CONFIG } from '@/core/branding';
import { DynamicConfigForm } from '@/components/DynamicConfigForm';
import Link from 'next/link';

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
  const [isIngestModalOpen, setIsIngestModalOpen] = useState(false);
  const [isAssistantModalOpen, setIsAssistantModalOpen] = useState(false);
  const [assistantPrompt, setAssistantPrompt] = useState('');
  const [isAssistantLoading, setIsAssistantLoading] = useState(false);
  const [selectedSourceForIngest, setSelectedSourceForIngest] = useState<DataSource | null>(null);
  const [form] = Form.useForm();
  const [ingestForm] = Form.useForm();
  const selectedType = Form.useWatch('type', form);
  const chunkStrategy = Form.useWatch('strategy', ingestForm);
  const executionMode = Form.useWatch('execution_mode', ingestForm);
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

  const handleAssistant = async () => {
    if (!assistantPrompt) return;
    setIsAssistantLoading(true);
    try {
      const suggestion = await assistantService.suggestConnector(assistantPrompt);
      setIsAssistantModalOpen(false);
      setIsModalOpen(true);
      
      // Pre-fill the form with the suggestion
      form.setFieldsValue({
        name: `Suggested ${suggestion.plugin_id}`,
        type: suggestion.plugin_id,
        ...suggestion.config
      });
      
      message.success('Assistant suggested a configuration!');
      if (suggestion.explanation) {
        Modal.info({
          title: 'Assistant Explanation',
          content: suggestion.explanation,
        });
      }
    } catch (error) {
      message.error('Assistant failed to suggest a configuration');
    } finally {
      setIsAssistantLoading(false);
      setAssistantPrompt('');
    }
  };

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

  const [selectedPluginId, setSelectedPluginId] = useState<string | null>(null);
  const [pluginSchema, setPluginSchema] = useState<ConfigSchema | null>(null);
  const [selectedVsId, setSelectedVsId] = useState<string | null>(null);
  const [vsSchema, setVsSchema] = useState<ConfigSchema | null>(null);

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

  const { data: availableModels } = useQuery({
    queryKey: ['models'],
    queryFn: modelService.getModels,
  });

  const { data: vectorStores } = useQuery({
    queryKey: ['vector-stores'],
    queryFn: vectorStoreService.getVectorStores,
  });

  const fetchPluginSchema = async (pluginId: string) => {
    try {
      const schema = await pluginService.getPluginSchema(pluginId);
      setPluginSchema(schema);
    } catch (error) {
      message.error('Failed to fetch plugin schema');
      setPluginSchema(null);
    }
  };

  const fetchVsSchema = async (vsId: string) => {
    try {
      const schema = await vectorStoreService.getVectorStoreSchema(vsId);
      setVsSchema(schema);
    } catch (error) {
      message.error('Failed to fetch vector store schema');
      setVsSchema(null);
    }
  };

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
            loading={ingestMutation.isPending && selectedSourceForIngest?.id === record.id}
            onClick={() => {
              setSelectedSourceForIngest(record);
              setIsIngestModalOpen(true);
              ingestForm.setFieldsValue({
                strategy: 'recursive',
                chunk_size: 1000,
                chunk_overlap: 200,
                index_name: record.name.toLowerCase().replace(/\s+/g, '_'),
                embedding_model_id: availableModels?.[0]?.id,
                execution_mode: 'sequential',
                max_workers: 4
              });
            }} 
          />
          <Button type="text" icon={<Settings size={16} />} />
          <Button type="text" danger icon={<Trash2 size={16} />} />
        </Space>
      ),
    },
  ];

  const handleAddSource = (values: any) => {
    const { name, type, ...config } = values;
    
    // Handle special cases like JSON strings in config
    Object.keys(config).forEach(key => {
      if (typeof config[key] === 'string' && (config[key].startsWith('{') || config[key].startsWith('['))) {
        try {
          config[key] = JSON.parse(config[key]);
        } catch (e) {
          // Keep as string if not valid JSON
        }
      }
    });

    addSourceMutation.mutate({
      name,
      type,
      config,
      status: 'active'
    });
  };

  if (isLoadingSources) {
    return <div className="flex justify-center items-center h-64"><Spin size="large" /></div>;
  }

  return (
    <div className="space-y-8">
      <Breadcrumb
        items={[
          { title: <Link href="/">Dashboard</Link> },
          { title: 'Data Sources' },
        ]}
      />

      <div className="flex justify-between items-end">
        <div>
          <Title level={2}>Data Sources</Title>
          <Text type="secondary">Connect and manage your data origins for the RAG pipeline.</Text>
        </div>
        <Space>
          <Button 
            icon={<Bot size={16} />} 
            onClick={() => setIsAssistantModalOpen(true)}
            className="border-purple-200 text-purple-600 hover:text-purple-700 hover:border-purple-300"
          >
            AI Assistant
          </Button>
          <Button type="primary" icon={<Plus size={16} />} onClick={() => setIsModalOpen(true)}>
            Add Source
          </Button>
        </Space>
      </div>

      <div className="space-y-4">
        <Title level={4}>Quick Connect</Title>
        <Flex gap="middle" wrap="wrap">
          <Button 
            icon={<Folder size={16} className="text-blue-500" />} 
            onClick={() => {
              setIsModalOpen(true);
              form.setFieldsValue({ type: 'local_file' });
            }}
          >
            Local Files
          </Button>
          <Button 
            icon={<DbIcon size={16} className="text-green-500" />} 
            onClick={() => {
              setIsModalOpen(true);
              form.setFieldsValue({ type: 'mongodb' });
            }}
          >
            MongoDB
          </Button>
          <Button 
            icon={<Globe size={16} className="text-orange-500" />} 
            onClick={() => {
              setIsModalOpen(true);
              form.setFieldsValue({ type: 'web_scraper' });
            }}
          >
            Web Scraper
          </Button>
        </Flex>
      </div>

      <Card variant="borderless" className="shadow-sm">
        <Table columns={columns} dataSource={sources} rowKey="id" />
      </Card>

      <div style={{ marginTop: '24px' }}>
        <LogViewer />
      </div>

      <Modal 
        title="Add New Data Source" 
        open={isModalOpen} 
        onOk={() => form.submit()} 
        onCancel={() => {
          setIsModalOpen(false);
          setPluginSchema(null);
          setSelectedPluginId(null);
        }}
        confirmLoading={addSourceMutation.isPending}
      >
        <Form form={form} layout="vertical" onFinish={handleAddSource}>
          <Form.Item name="name" label="Source Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Documentation Folder" />
          </Form.Item>
          <Form.Item name="type" label="Source Type" rules={[{ required: true }]}>
            <Select 
              placeholder="Select a plugin"
              onChange={(value) => {
                setSelectedPluginId(value);
                fetchPluginSchema(value);
              }}
            >
              {plugins?.map(plugin => (
                <Select.Option key={plugin.id} value={plugin.id}>{plugin.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>

          {pluginSchema && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
              <Text strong className="block mb-4">Configuration</Text>
              <DynamicConfigForm schema={pluginSchema} />
            </div>
          )}
        </Form>
      </Modal>

      <Modal
        title={`Run Ingestion: ${selectedSourceForIngest?.name}`}
        open={isIngestModalOpen}
        onOk={() => ingestForm.submit()}
        onCancel={() => {
          setIsIngestModalOpen(false);
          setVsSchema(null);
          setSelectedVsId(null);
        }}
        confirmLoading={ingestMutation.isPending}
        width={600}
      >
        <Form
          form={ingestForm}
          layout="vertical"
          onFinish={(values) => {
            if (!selectedSourceForIngest) return;
            const selectedModel = availableModels?.find(m => m.id === values.embedding_model_id);
            
            // Extract vector store config
            const { vector_store, index_name, embedding_model_id, execution_mode, max_workers, strategy, chunk_size, chunk_overlap, separators, encoding_name, ...vs_config } = values;

            ingestMutation.mutate({
              plugin_id: selectedSourceForIngest.type,
              config: selectedSourceForIngest.config,
              chunk_settings: {
                strategy,
                chunk_size,
                chunk_overlap,
                separators,
                encoding_name
              },
              vector_store,
              vector_store_config: vs_config,
              index_name,
              embedding_model: selectedModel?.model || 'all-MiniLM-L6-v2',
              embedding_provider: selectedModel?.provider || 'huggingface',
              embedding_config: selectedModel?.config || {},
              execution_mode,
              max_workers
            }, {
              onSuccess: () => setIsIngestModalOpen(false)
            });
          }}
        >
          <Flex gap="middle">
            <Form.Item name="vector_store" label="Vector Store" rules={[{ required: true }]} className="flex-1" initialValue="opensearch">
              <Select 
                placeholder="Select vector store"
                onChange={(value) => {
                  setSelectedVsId(value);
                  fetchVsSchema(value);
                }}
              >
                {vectorStores?.map(vs => (
                  <Select.Option key={vs.id} value={vs.id}>{vs.name}</Select.Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="index_name" label="Index Name" rules={[{ required: true }]} className="flex-1">
              <Input placeholder="my_index" />
            </Form.Item>
          </Flex>

          {vsSchema && (
            <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
              <Text strong className="block mb-4">Vector Store Configuration</Text>
              <DynamicConfigForm schema={vsSchema} />
            </div>
          )}

          <Divider titlePlacement="left">Embedding & Execution</Divider>
          
          <Form.Item name="embedding_model_id" label="Embedding Model" rules={[{ required: true }]}>
            <Select placeholder="Select a configured model">
              {availableModels?.map(m => (
                <Select.Option key={m.id} value={m.id}>
                  {m.name} ({m.provider.toUpperCase()}: {m.model})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Flex gap="middle">
            <Form.Item name="execution_mode" label="Execution Mode" initialValue="sequential" className="flex-1">
              <Select>
                <Select.Option value="sequential">Sequential</Select.Option>
                <Select.Option value="parallel">Parallel</Select.Option>
              </Select>
            </Form.Item>
            {executionMode === 'parallel' && (
              <Form.Item name="max_workers" label="Max Workers (Jobs)" initialValue={4} className="flex-1">
                <InputNumber min={1} max={16} style={{ width: '100%' }} />
              </Form.Item>
            )}
          </Flex>

          <Divider titlePlacement="left">Chunking Configuration</Divider>
          
          <Form.Item name="strategy" label="Chunking Strategy" initialValue="recursive">
            <Select>
              <Select.Option value="recursive">Recursive Character (Recommended)</Select.Option>
              <Select.Option value="character">Simple Character</Select.Option>
              <Select.Option value="token">Token Based (OpenAI/Tiktoken)</Select.Option>
            </Select>
          </Form.Item>

          <Flex gap="middle">
            <Form.Item name="chunk_size" label="Chunk Size" initialValue={1000} className="flex-1">
              <InputNumber min={1} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="chunk_overlap" label="Chunk Overlap" initialValue={200} className="flex-1">
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </Flex>

          {chunkStrategy === 'recursive' || chunkStrategy === 'character' ? (
            <Form.Item name="separators" label="Custom Separators (Optional)">
              <Select mode="tags" placeholder="e.g. \n\n, \n, ' '" />
            </Form.Item>
          ) : chunkStrategy === 'token' ? (
            <Form.Item name="encoding_name" label="Token Encoding" initialValue="cl100k_base">
              <Select>
                <Select.Option value="cl100k_base">cl100k_base (GPT-4, GPT-3.5)</Select.Option>
                <Select.Option value="p50k_base">p50k_base (Codex)</Select.Option>
                <Select.Option value="r50k_base">r50k_base (GPT-3)</Select.Option>
              </Select>
            </Form.Item>
          ) : null}
        </Form>
      </Modal>

      <Modal
        title={
          <Space>
            <Bot size={20} className="text-blue-500" />
            <span>Connector Assistant</span>
          </Space>
        }
        open={isAssistantModalOpen}
        onOk={handleAssistant}
        onCancel={() => setIsAssistantModalOpen(false)}
        confirmLoading={isAssistantLoading}
        okText="Suggest Configuration"
      >
        <div className="space-y-4">
          <Text>
            Describe your data source in natural language, and the AI will suggest the best connector and configuration.
          </Text>
          <Input.TextArea 
            rows={4} 
            placeholder="e.g. I have a MongoDB database at localhost:27017 called 'my_app' and I want to index the 'articles' collection. The text is in the 'body' field."
            value={assistantPrompt}
            onChange={(e) => setAssistantPrompt(e.target.value)}
          />
          <Text type="secondary">
            Note: This uses the configured Ollama model to process your request.
          </Text>
        </div>
      </Modal>
    </div>
  );
}

