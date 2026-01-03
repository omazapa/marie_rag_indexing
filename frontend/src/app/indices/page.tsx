'use client';

import React, { useState } from 'react';
import {
  Table,
  Button,
  Space,
  Card,
  Typography,
  Tag,
  Select,
  App,
  Breadcrumb,
  Tooltip
} from 'antd';
import { FileText, Trash2, RefreshCw, Database, Search } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { indexService, IndexInfo } from '@/services/indexService';
import { vectorStoreService } from '@/services/vectorStoreService';
import { EmptyState } from '@/components/EmptyState';
import Link from 'next/link';

const { Title, Text } = Typography;

export default function IndicesPage() {
  const { message, modal } = App.useApp();
  const queryClient = useQueryClient();
  const [selectedVectorStore, setSelectedVectorStore] = useState('opensearch');

  const { data: vectorStores } = useQuery({
    queryKey: ['vector-stores'],
    queryFn: vectorStoreService.getVectorStores,
  });

  const { data: indices, isLoading, refetch } = useQuery({
    queryKey: ['indices', selectedVectorStore],
    queryFn: () => indexService.getIndices(selectedVectorStore),
  });

  const deleteIndexMutation = useMutation({
    mutationFn: (indexName: string) => indexService.deleteIndex(indexName, selectedVectorStore),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['indices', selectedVectorStore] });
      message.success('Index deleted successfully');
    },
    onError: (error: Error) => {
      message.error(`Failed to delete index: ${error.message}`);
    }
  });

  const confirmDelete = (indexName: string) => {
    modal.confirm({
      title: 'Are you sure you want to delete this index?',
      content: `This will permanently remove all documents in "${indexName}".`,
      okText: 'Yes, Delete',
      okType: 'danger',
      cancelText: 'No',
      onOk: () => deleteIndexMutation.mutate(indexName),
    });
  };

  const columns = [
    {
      title: 'Index Name',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => (
        <Space>
          <FileText size={16} className="text-blue-500" />
          <Text strong>{text}</Text>
        </Space>
      ),
    },
    {
      title: 'Documents',
      dataIndex: 'documents',
      key: 'documents',
      render: (count: number) => <Tag color="blue">{count.toLocaleString()}</Tag>,
    },
    {
      title: 'Size',
      dataIndex: 'size',
      key: 'size',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'active' ? 'green' : 'orange'}>
          {status.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, record: IndexInfo) => (
        <Space size="middle">
          <Tooltip title="Search Index">
            <Button type="text" icon={<Search size={16} />} />
          </Tooltip>
          <Tooltip title="Delete Index">
            <Button
              type="text"
              danger
              icon={<Trash2 size={16} />}
              onClick={() => confirmDelete(record.name)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { title: <Link href="/">Dashboard</Link> },
          { title: 'Indices' },
        ]}
      />

      <div className="flex justify-between items-center">
        <div>
          <Title level={2}>Vector Indices</Title>
          <Text type="secondary">Monitor and manage your vector indices across different providers.</Text>
        </div>
        <Space>
          <Select
            value={selectedVectorStore}
            onChange={setSelectedVectorStore}
            style={{ width: 200 }}
            options={vectorStores?.map(vs => ({ label: vs.name, value: vs.id }))}
            prefix={<Database size={14} className="mr-2" />}
          />
          <Button icon={<RefreshCw size={16} />} onClick={() => refetch()} loading={isLoading}>
            Refresh
          </Button>
        </Space>
      </div>

      <Card variant="borderless" className="shadow-sm">
        <Table
          columns={columns}
          dataSource={indices}
          loading={isLoading}
          rowKey="name"
          locale={{
            emptyText: (
              <EmptyState
                icon={FileText}
                title="No Indices Found"
                description={`No indices found in ${selectedVectorStore}. Create an index by running an ingestion job.`}
              />
            ),
          }}
        />
      </Card>
    </div>
  );
}
