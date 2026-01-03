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
  App,
  Spin,
  Divider,
  InputNumber,
  Flex,
  Alert,
  Steps,
  Tooltip,
} from 'antd';
import {
  Plus,
  Play,
  Settings,
  Trash2,
  Bot,
  Database as DbIcon,
  Globe,
  Folder,
  Info,
  CheckCircle2,
  AlertCircle,
  Upload,
  Server,
  Cloud,
  FileText,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sourceService, DataSource } from '@/services/sourceService';
import { pluginService, ConfigSchema } from '@/services/pluginService';
import { ingestionService } from '@/services/ingestionService';
import { assistantService } from '@/services/assistantService';
import { LogViewer } from '@/components/LogViewer';
import { modelService } from '@/services/modelService';
import { vectorStoreService } from '@/services/vectorStoreService';
import { DynamicConfigForm } from '@/components/DynamicConfigForm';
import { MongoDBConfigForm } from '@/components/MongoDBConfigForm';
import { SQLConfigForm, S3ConfigForm, WebScraperConfigForm, GoogleDriveConfigForm } from '@/components/SourceConfigForms';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { StatusIndicator } from '@/components/StatusIndicator';
import { InfoTooltip } from '@/components/InfoTooltip';
import { Prompts } from '@ant-design/x';

const { Title, Text } = Typography;

export default function SourcesPage() {
  const { message, modal } = App.useApp();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [configStep, setConfigStep] = useState(0);
  const [isIngestModalOpen, setIsIngestModalOpen] = useState(false);
  const [isAssistantModalOpen, setIsAssistantModalOpen] = useState(false);
  const [assistantPrompt, setAssistantPrompt] = useState('');
  const [isAssistantLoading, setIsAssistantLoading] = useState(false);
  const [selectedSourceForIngest, setSelectedSourceForIngest] = useState<DataSource | null>(null);
  const [form] = Form.useForm();
  const [ingestForm] = Form.useForm();
  const chunkStrategy = Form.useWatch('strategy', ingestForm);
  const executionMode = Form.useWatch('execution_mode', ingestForm);
  const sourceType = Form.useWatch('type', form);

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
        modal.info({
          title: 'Assistant Explanation',
          content: suggestion.explanation,
        });
      }
    } catch {
      message.error('Assistant failed to suggest a configuration');
    } finally {
      setIsAssistantLoading(false);
      setAssistantPrompt('');
    }
  };

  const [isTestingConnection, setIsTestingConnection] = useState(false);

  const handleTestConnection = async () => {
    const values = form.getFieldsValue();
    if (!values.type) {
      message.warning('Please select a source type first');
      return;
    }

    setIsTestingConnection(true);
    try {
      // Extract config fields (everything except name and type)
      const { type, ...config } = values;
      const result = await sourceService.testConnection(type, config);
      if (result.success) {
        message.success('Connection successful!');
      } else {
        message.error(`Connection failed: ${result.error || 'Unknown error'}`);
      }
    } catch {
      message.error('Failed to test connection');
    } finally {
      setIsTestingConnection(false);
    }
  };

  const [pluginSchema, setPluginSchema] = useState<ConfigSchema | null>(null);
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
    } catch {
      message.error('Failed to fetch plugin schema');
      setPluginSchema(null);
    }
  };

  const fetchVsSchema = async (vsId: string) => {
    try {
      const schema = await vectorStoreService.getVectorStoreSchema(vsId);
      setVsSchema(schema);
    } catch {
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
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start ingestion';
      message.error(errorMessage);
    }
  });

  // Helper function to get icon for source type
  const getSourceIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'mongodb':
      case 'sql':
        return <DbIcon size={16} className="text-blue-500" />;
      case 'web_scraper':
        return <Globe size={16} className="text-green-500" />;
      case 's3':
      case 'google_drive':
        return <Cloud size={16} className="text-purple-500" />;
      default:
        return <FileText size={16} className="text-gray-500" />;
    }
  };

  // Helper function to get description for source type
  const getSourceDescription = (type: string): string => {
    switch (type.toLowerCase()) {
      case 'sql':
        return 'Connect to PostgreSQL, MySQL, or other SQL databases. Extract data from tables with customizable queries. Best for structured content with rich metadata.';
      case 'mongodb':
        return 'Connect to MongoDB collections. Handle nested documents and arrays. Ideal for semi-structured content with flexible schemas.';
      case 's3':
        return 'Access documents from Amazon S3 or compatible storage. Supports multiple file formats (PDF, DOCX, TXT, MD). Perfect for document repositories.';
      case 'web_scraper':
        return 'Scrape content from websites and documentation. Configure URL patterns, depth, and content selectors. Great for online knowledge bases.';
      case 'google_drive':
        return 'Access Google Drive documents, spreadsheets, and PDFs. Includes metadata like owner and sharing info. Perfect for collaborative team documents.';
      default:
        return 'Configure your data source with the appropriate connection settings.';
    }
  };

  const columns = [
    {
      title: 'Source',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: DataSource) => (
        <Space>
          {getSourceIcon(record.type)}
          <Text strong>{text}</Text>
        </Space>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => <Tag color="blue">{type.toUpperCase().replace('_', ' ')}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <StatusIndicator
          status={status === 'active' ? 'success' : status === 'error' ? 'error' : 'warning'}
          text={status.toUpperCase()}
        />
      ),
    },
    {
      title: 'Last Run',
      dataIndex: 'lastRun',
      key: 'lastRun',
      render: (date: string) => <Text type="secondary" className="text-xs">{date || 'Never'}</Text>
    },
    {
      title: 'Action',
      key: 'action',
      align: 'right' as const,
      render: (_: unknown, record: DataSource) => (
        <Space size="small">
          <Button
            type="primary"
            size="small"
            icon={<Play size={14} />}
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
          >
            Run
          </Button>
          <Button type="text" size="small" icon={<Settings size={14} />} />
          <Button type="text" size="small" danger icon={<Trash2 size={14} />} />
        </Space>
      ),
    },
  ];

  const handleAddSource = (values: Record<string, unknown>) => {
    const { name, type, ...config } = values;

    const typedConfig = config as Record<string, unknown>;

    // Handle special cases like JSON strings in config
    Object.keys(typedConfig).forEach(key => {
      const val = typedConfig[key];
      if (typeof val === 'string' && (val.startsWith('{') || val.startsWith('['))) {
        try {
          typedConfig[key] = JSON.parse(val);
        } catch {
          // Keep as string if not valid JSON
        }
      }
    });

    addSourceMutation.mutate({
      name: name as string,
      type: type as string,
      config: typedConfig,
      status: 'active'
    });
  };

  if (isLoadingSources) {
    return <div className="flex justify-center items-center h-64"><Spin size="large" /></div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Data Sources"
        description="Connect and manage your data origins for the RAG pipeline"
        icon={DbIcon}
        breadcrumbs={[
          { title: 'Dashboard', href: '/' },
          { title: 'Data Sources' },
        ]}
        extra={
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
        }
      />

      <Alert
        message="RAG Data Sources"
        description={
          <div>
            Configure your data origins to extract, chunk, and index content for retrieval-augmented generation.
            Each source type has optimized settings for best RAG performance.
            <a href="/docs/DATA_SOURCES_RAG_REQUIREMENTS.md" target="_blank" className="ml-2 text-blue-600 hover:text-blue-700">
              View detailed requirements →
            </a>
          </div>
        }
        type="info"
        icon={<Info size={16} />}
        className="mb-6"
        closable
      />

      <Prompts
        title="Configuration Guide"
        onItemClick={(info) => {
          if (info.data.key === 'add') setIsModalOpen(true);
          if (info.data.key === 'assistant') setIsAssistantModalOpen(true);
        }}
        items={[
          {
            key: 'add',
            icon: <Plus size={16} />,
            label: 'Add a new data source manually',
            description: 'Configure SQL, NoSQL, or Cloud storage connectors.',
          },
          {
            key: 'assistant',
            icon: <Bot size={16} />,
            label: 'Use AI Assistant to configure',
            description: 'Describe your data source and let Marie help you.',
          },
          {
            key: 'help',
            icon: <Info size={16} />,
            label: 'Learn about supported sources',
            description: 'View documentation for all available plugins.',
          },
        ]}
      />

      <Card variant="borderless" className="shadow-sm">
        <Table
          columns={columns}
          dataSource={sources}
          rowKey="id"
          locale={{
            emptyText: (
              <EmptyState
                icon={DbIcon}
                title="No Data Sources"
                description="Start by adding your first data source to begin indexing."
                actionLabel="Add First Source"
                onAction={() => setIsModalOpen(true)}
              />
            ),
          }}
        />
      </Card>

      <div style={{ marginTop: '24px' }}>
        <LogViewer />
      </div>

      <Modal
        title={
          <Space>
            <DbIcon size={20} className="text-purple-600" />
            <span>Add New Data Source</span>
          </Space>
        }
        open={isModalOpen}
        onCancel={() => {
          setIsModalOpen(false);
          setPluginSchema(null);
          setConfigStep(0);
          form.resetFields();
        }}
        width={700}
        footer={[
          <Button key="cancel" onClick={() => setIsModalOpen(false)}>
            Cancel
          </Button>,
          configStep > 0 && (
            <Button
              key="back"
              onClick={() => setConfigStep(configStep - 1)}
            >
              Back
            </Button>
          ),
          configStep === 0 && (
            <Button
              key="next"
              type="primary"
              onClick={() => {
                if (!sourceType) {
                  message.warning('Please select a source type');
                  return;
                }
                setConfigStep(1);
              }}
            >
              Next: Configuration
            </Button>
          ),
          configStep === 1 && (
            <>
              <Button
                key="test"
                loading={isTestingConnection}
                onClick={handleTestConnection}
                disabled={!pluginSchema || sourceType === 'mongodb'}
                style={sourceType === 'mongodb' ? { display: 'none' } : {}}
              >
                Test Connection
              </Button>
              <Button
                key="submit"
                type="primary"
                loading={addSourceMutation.isPending}
                onClick={() => form.submit()}
                icon={<CheckCircle2 size={14} />}
              >
                Add Source
              </Button>
            </>
          )
        ]}
      >
        <Steps
          current={configStep}
          className="mb-6"
          items={[
            {
              title: 'Source Type',
              icon: <DbIcon size={16} />,
            },
            {
              title: 'Configuration',
              icon: <Settings size={16} />,
            },
          ]}
        />

        <Form form={form} layout="vertical" onFinish={handleAddSource}>
          {configStep === 0 && (
            <>
              <Form.Item name="name" label="Source Name" rules={[{ required: true }]}>
                <Input placeholder="e.g. Documentation Database" prefix={<FileText size={16} />} />
              </Form.Item>
              <Form.Item
                name="type"
                label={
                  <Space>
                    <span>Source Type</span>
                    <InfoTooltip
                      title="Source Type"
                      content="Choose the type of data source you want to connect. Each type has specific requirements and optimizations for RAG."
                    />
                  </Space>
                }
                rules={[{ required: true }]}
              >
                <Select
                  placeholder="Select a plugin"
                  onChange={(value) => {
                    fetchPluginSchema(value);
                  }}
                  size="large"
                >
                  {plugins
                    ?.filter(plugin => plugin.id !== 'local_file')
                    .map(plugin => (
                      <Select.Option key={plugin.id} value={plugin.id}>
                        <Space>
                          {getSourceIcon(plugin.id)}
                          <span>{plugin.name}</span>
                        </Space>
                      </Select.Option>
                    ))}
                </Select>
              </Form.Item>

              {sourceType && (
                <Alert
                  message={`${sourceType.toUpperCase().replace('_', ' ')} Configuration`}
                  description={getSourceDescription(sourceType)}
                  type="info"
                  showIcon
                  icon={getSourceIcon(sourceType)}
                />
              )}
            </>
          )}

          {configStep === 1 && pluginSchema && (
            <div className="space-y-4">
              {sourceType === 'mongodb' ? (
                <MongoDBConfigForm form={form} />
              ) : sourceType === 'sql' ? (
                <SQLConfigForm />
              ) : sourceType === 's3' ? (
                <S3ConfigForm />
              ) : sourceType === 'web_scraper' ? (
                <WebScraperConfigForm />
              ) : sourceType === 'google_drive' ? (
                <GoogleDriveConfigForm />
              ) : (
                <>
                  <Alert
                    message="Connection Configuration"
                    description="Provide the necessary credentials and settings to connect to your data source."
                    type="info"
                    showIcon
                    className="mb-4"
                  />
                  <DynamicConfigForm schema={pluginSchema} />
                </>
              )}
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
            const { vector_store, index_name, execution_mode, max_workers, strategy, chunk_size, chunk_overlap, separators, encoding_name, ...vs_config } = values;

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
