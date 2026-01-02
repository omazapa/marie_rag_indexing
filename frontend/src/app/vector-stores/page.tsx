'use client';

import React from 'react';
import { 
  Table, 
  Card, 
  Typography, 
  Tag, 
  App,
  Space,
  Button,
  Breadcrumb
} from 'antd';
import { Database, Plus, ExternalLink } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { vectorStoreService } from '@/services/vectorStoreService';
import Link from 'next/link';

const { Title, Text } = Typography;

export default function VectorStoresPage() {
  const { data: vectorStores, isLoading } = useQuery({
    queryKey: ['vector-stores'],
    queryFn: vectorStoreService.getVectorStores,
  });

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => (
        <Space>
          <Database size={16} className="text-purple-500" />
          <Text strong>{text}</Text>
        </Space>
      ),
    },
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      render: (id: string) => <Tag color="blue">{id}</Tag>,
    },
    {
      title: 'Status',
      key: 'status',
      render: () => <Tag color="green">Available</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: () => (
        <Space size="middle">
          <Button type="link" icon={<ExternalLink size={14} />}>Configure</Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { title: <Link href="/">Dashboard</Link> },
          { title: 'Vector Stores' },
        ]}
      />
      
      <div className="flex justify-between items-center">
        <div>
          <Title level={2}>Vector Stores</Title>
          <Text type="secondary">Manage your vector database connections and configurations.</Text>
        </div>
        <Button type="primary" icon={<Plus size={16} />}>
          Add Vector Store
        </Button>
      </div>

      <Card variant="borderless" className="shadow-sm">
        <Table 
          columns={columns} 
          dataSource={vectorStores} 
          loading={isLoading}
          rowKey="id"
          pagination={false}
        />
      </Card>
    </div>
  );
}
