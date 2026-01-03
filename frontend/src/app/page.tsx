'use client';

import React from 'react';
import { Row, Col, Card, Statistic, Typography, Tag, Spin, Flex, Divider, Button, Space } from 'antd';
import {
  Database,
  FileText,
  Activity,
  CheckCircle2,
  AlertCircle,
  Clock,
  Plus,
  Search
} from 'lucide-react';
import { Welcome } from '@ant-design/x';
import { useQuery } from '@tanstack/react-query';
import { statsService } from '@/services/statsService';
import { BRAND_CONFIG } from '@/core/branding';

const { Text } = Typography;

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: statsService.getStats,
    refetchInterval: 5000,
  });

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><Spin size="large" /></div>;
  }

  return (
    <div className="space-y-8">
      <Welcome
        variant="borderless"
        title={`Welcome to ${BRAND_CONFIG.name}`}
        description="A modular system for indexing data from various sources into vector databases for RAG applications. Start by adding a data source or managing your indices."
        extra={
          <Space>
            <Button type="primary" icon={<Plus size={16} />}>New Source</Button>
            <Button icon={<Search size={16} />}>Search Indices</Button>
          </Space>
        }
      />

      <Divider />

      <Row gutter={[24, 24]}>
        <Col xs={24} sm={12} lg={6}>
          <Card variant="borderless" className="shadow-sm">
            <Statistic
              title="Active Sources"
              value={stats?.active_sources}
              prefix={<Database className="text-blue-500 mr-2" size={20} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card variant="borderless" className="shadow-sm">
            <Statistic
              title="Total Documents"
              value={stats?.total_documents}
              prefix={<FileText className="text-green-500 mr-2" size={20} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card variant="borderless" className="shadow-sm">
            <Statistic
              title="Last Ingestion"
              value={stats?.last_ingestion}
              prefix={<Clock className="text-orange-500 mr-2" size={20} />}
              styles={{ content: { fontSize: '14px' } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card variant="borderless" className="shadow-sm">
            <Statistic
              title="System Health"
              value="Healthy"
              prefix={<CheckCircle2 className="text-emerald-500 mr-2" size={20} />}
              styles={{ content: { fontSize: '18px' } }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card title="Recent Ingestion Jobs" variant="borderless" className="shadow-sm">
            <Flex vertical>
              {stats?.recent_jobs?.map((item: { id: string; source: string; status: 'completed' | 'failed' | 'running'; time: string }, index: number) => (
                <React.Fragment key={item.id}>
                  <Flex align="center" justify="space-between" style={{ padding: '12px 0' }}>
                    <Flex gap="middle" align="center">
                      {item.status === 'completed' ?
                        <CheckCircle2 className="text-green-500" size={24} /> :
                        item.status === 'failed' ?
                        <AlertCircle className="text-red-500" size={24} /> :
                        <Activity className="text-blue-500 animate-pulse" size={24} />
                      }
                      <div>
                        <div style={{ marginBottom: 4 }}>
                          <Text strong>{item.source}</Text>
                        </div>
                        <Text type="secondary">
                          Job ID: {item.id} •
                          <Tag className="ml-2" color={item.status === 'completed' ? 'green' : item.status === 'failed' ? 'red' : 'blue'}>
                            {item.status.toUpperCase()}
                          </Tag>
                        </Text>
                      </div>
                    </Flex>
                    <Text type="secondary">{item.time}</Text>
                  </Flex>
                  {index < stats.recent_jobs.length - 1 && <Divider style={{ margin: 0 }} />}
                </React.Fragment>
              ))}
            </Flex>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
