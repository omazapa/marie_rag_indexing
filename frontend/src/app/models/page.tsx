'use client';

import React, { useState, useEffect } from 'react';
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
  Flex,
  AutoComplete,
  Breadcrumb
} from 'antd';
import { Plus, Trash2, Cpu, Search } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { modelService, EmbeddingModel } from '@/services/modelService';
import Link from 'next/link';

const { Title, Text } = Typography;

export default function ModelsPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();
  const selectedProvider = Form.useWatch('provider', form);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const { data: models, isLoading } = useQuery({
    queryKey: ['models'],
    queryFn: modelService.getModels,
  });

  const handleSearch = async (value: string) => {
    if (!value || value.length < 3) {
      setSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    try {
      const results = await modelService.searchModels(selectedProvider, value);
      setSearchResults(results.map((r: any) => ({
        value: r.id,
        label: (
          <div className="flex justify-between items-center">
            <span>{r.name}</span>
            {r.downloads && <Tag color="blue">{r.downloads.toLocaleString()} downloads</Tag>}
            {r.installed && <Tag color="green">Installed</Tag>}
          </div>
        )
      })));
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const addModelMutation = useMutation({
    mutationFn: modelService.addModel,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['models'] });
      setIsModalOpen(false);
      form.resetFields();
      message.success('Embedding model added successfully');
    },
    onError: () => {
      message.error('Failed to add embedding model');
    }
  });

  const deleteModelMutation = useMutation({
    mutationFn: modelService.deleteModel,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['models'] });
      message.success('Model deleted');
    }
  });

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => (
        <Space>
          <Cpu size={16} className="text-blue-500" />
          <Text strong>{text}</Text>
        </Space>
      ),
    },
    {
      title: 'Provider',
      dataIndex: 'provider',
      key: 'provider',
      render: (provider: string) => (
        <Tag color={provider === 'huggingface' ? 'orange' : 'blue'}>
          {provider.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Model ID',
      dataIndex: 'model',
      key: 'model',
      render: (model: string) => <code className="bg-gray-100 px-1 rounded">{model}</code>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color="green">{status.toUpperCase()}</Tag>
      ),
    },
    {
      title: 'Action',
      key: 'action',
      render: (_: any, record: EmbeddingModel) => (
        <Button 
          type="text" 
          danger 
          icon={<Trash2 size={16} />} 
          onClick={() => deleteModelMutation.mutate(record.id)}
        />
      ),
    },
  ];

  const handleAddModel = (values: any) => {
    const config = values.provider === 'ollama' ? { base_url: values.base_url } : {};
    addModelMutation.mutate({
      name: values.name,
      provider: values.provider,
      model: values.model,
      config: config
    });
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><Spin size="large" /></div>;
  }

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { title: <Link href="/">Dashboard</Link> },
          { title: 'Embedding Models' },
        ]}
      />

      <div className="flex justify-between items-center">
        <div>
          <Title level={2}>Embedding Models</Title>
          <Text type="secondary">Manage local and remote embedding models for vectorization.</Text>
        </div>
        <Button type="primary" icon={<Plus size={16} />} onClick={() => setIsModalOpen(true)}>
          Add Model
        </Button>
      </div>

      <Card variant="borderless" className="shadow-sm">
        <Table columns={columns} dataSource={models} rowKey="id" />
      </Card>

      <Modal
        title="Add Embedding Model"
        open={isModalOpen}
        onOk={() => form.submit()}
        onCancel={() => setIsModalOpen(false)}
        confirmLoading={addModelMutation.isPending}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleAddModel}
          initialValues={{ provider: 'huggingface' }}
        >
          <Form.Item name="name" label="Display Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. My Local Llama" />
          </Form.Item>
          
          <Form.Item name="provider" label="Provider" rules={[{ required: true }]}>
            <Select onChange={() => setSearchResults([])}>
              <Select.Option value="huggingface">HuggingFace (Local)</Select.Option>
              <Select.Option value="ollama">Ollama</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item name="model" label="Model ID" rules={[{ required: true }]}>
            <AutoComplete
              options={searchResults}
              onSearch={handleSearch}
              placeholder={selectedProvider === 'ollama' ? 'Search Ollama models (e.g. llama3)' : 'Search HuggingFace models (e.g. all-MiniLM)'}
            >
              <Input suffix={isSearching ? <Spin size="small" /> : <Search size={16} className="text-gray-400" />} />
            </AutoComplete>
          </Form.Item>

          {selectedProvider === 'ollama' && (
            <Form.Item name="base_url" label="Ollama Base URL" initialValue="http://localhost:11434">
              <Input placeholder="http://localhost:11434" />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
}
