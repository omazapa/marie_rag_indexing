'use client';

import React from 'react';
import {
  Table,
  Card,
  Typography,
  Tag,
  Spin,
  Breadcrumb,
  Progress,
  Flex,
  Space,
  Badge,
  Alert
} from 'antd';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Play,
  Database,
  Layers
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { jobService, IngestionJob } from '@/services/jobService';
import { EmptyState } from '@/components/EmptyState';
import Link from 'next/link';

const { Title, Text } = Typography;

export default function JobsPage() {
  const { data: jobs, isLoading } = useQuery({
    queryKey: ['jobs'],
    queryFn: jobService.getJobs,
    refetchInterval: 3000, // Auto-refresh every 3 seconds
  });

  const getStatusIcon = (status: IngestionJob['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="text-green-500" size={20} />;
      case 'failed':
        return <XCircle className="text-red-500" size={20} />;
      case 'running':
        return <Play className="text-blue-500 animate-pulse" size={20} />;
      default:
        return <Clock className="text-gray-400" size={20} />;
    }
  };

  const getStatusTag = (status: IngestionJob['status']) => {
    const colorMap = {
      completed: 'success',
      failed: 'error',
      running: 'processing',
    };
    return <Tag color={colorMap[status]}>{status.toUpperCase()}</Tag>;
  };

  const formatDuration = (startedAt: string, completedAt: string | null) => {
    const start = new Date(startedAt).getTime();
    const end = completedAt ? new Date(completedAt).getTime() : Date.now();
    const durationMs = end - start;
    const seconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const columns = [
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: IngestionJob['status']) => (
        <Flex align="center" gap={8}>
          {getStatusIcon(status)}
          {getStatusTag(status)}
        </Flex>
      ),
    },
    {
      title: 'Job ID',
      dataIndex: 'id',
      key: 'id',
      render: (id: string) => (
        <code className="bg-gray-100 px-2 py-1 rounded text-xs">{id.slice(0, 8)}</code>
      ),
    },
    {
      title: 'Data Source',
      dataIndex: 'plugin_id',
      key: 'plugin_id',
      render: (plugin: string) => (
        <Space>
          <Database size={16} className="text-blue-500" />
          <Text>{plugin.replace('_', ' ').toUpperCase()}</Text>
        </Space>
      ),
    },
    {
      title: 'Index',
      dataIndex: 'index_name',
      key: 'index_name',
      render: (index: string, record: IngestionJob) => (
        <Space orientation="vertical" size={0}>
          <Space>
            <Layers size={14} className="text-purple-500" />
            <Text strong>{index}</Text>
          </Space>
          <Text type="secondary" className="text-xs">
            {record.vector_store.toUpperCase()}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Progress',
      key: 'progress',
      render: (_: unknown, record: IngestionJob) => {
        if (record.status === 'running') {
          return (
            <div style={{ width: 200 }}>
              <Progress percent={undefined} status="active" showInfo={false} />
              <Text type="secondary" className="text-xs">Processing...</Text>
            </div>
          );
        }
        return (
          <Space orientation="vertical" size={0}>
            <Badge status={record.status === 'completed' ? 'success' : 'error'}
                   text={`${record.documents_processed} docs`} />
            <Text type="secondary" className="text-xs">
              {record.chunks_created} chunks
            </Text>
          </Space>
        );
      },
    },
    {
      title: 'Duration',
      key: 'duration',
      render: (_: unknown, record: IngestionJob) => (
        <Text type="secondary">
          {formatDuration(record.started_at, record.completed_at)}
        </Text>
      ),
    },
    {
      title: 'Started',
      dataIndex: 'started_at',
      key: 'started_at',
      render: (date: string) => (
        <Text type="secondary" className="text-xs">
          {new Date(date).toLocaleString()}
        </Text>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spin size="large" />
      </div>
    );
  }

  const runningJobs = jobs?.filter((j) => j.status === 'running') || [];
  const hasError = jobs?.some((j) => j.error);

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { title: <Link href="/">Dashboard</Link> },
          { title: 'Ingestion Jobs' },
        ]}
      />

      <div className="flex justify-between items-center">
        <div>
          <Title level={2}>Ingestion Jobs</Title>
          <Text type="secondary">
            Monitor data ingestion pipelines in real-time.
          </Text>
        </div>
        {runningJobs.length > 0 && (
          <Badge count={runningJobs.length} showZero={false}>
            <Tag color="processing" icon={<Play size={14} />} className="px-3 py-1">
              {runningJobs.length} Running
            </Tag>
          </Badge>
        )}
      </div>

      {hasError && (
        <Alert
          title="Some jobs have failed"
          description="Check the error details in the table below."
          type="error"
          showIcon
          closable
        />
      )}

      <Card variant="borderless" className="shadow-sm">
        <Table
          columns={columns}
          dataSource={jobs}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          locale={{
            emptyText: (
              <EmptyState
                icon={Clock}
                title="No Ingestion Jobs"
                description="No jobs have been run yet. Start by running a data source ingestion."
              />
            ),
          }}
          expandable={{
            expandedRowRender: (record) =>
              record.error ? (
                <Alert
                  title="Error Details"
                  description={record.error}
                  type="error"
                  showIcon
                />
              ) : (
                <div className="p-4 bg-gray-50 rounded">
                  <Space orientation="vertical">
                    <Text>
                      <strong>Full Job ID:</strong> <code>{record.id}</code>
                    </Text>
                    <Text>
                      <strong>Completed At:</strong>{' '}
                      {record.completed_at
                        ? new Date(record.completed_at).toLocaleString()
                        : 'N/A'}
                    </Text>
                  </Space>
                </div>
              ),
            rowExpandable: (record) => record.error !== null || record.status === 'completed',
          }}
        />
      </Card>
    </div>
  );
}
