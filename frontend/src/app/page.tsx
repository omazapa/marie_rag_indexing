'use client';

import React from 'react';
import { Row, Col, Card, Typography, Tag, Flex, Divider, Button, Space, Skeleton, Alert } from 'antd';
import {
  Database,
  FileText,
  Activity,
  CheckCircle2,
  AlertCircle,
  Play,
  TrendingUp,
  Layers,
  Zap,
  PlayCircle,
  Info,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { statsService } from '@/services/statsService';
import { useRouter } from 'next/navigation';
import { StatCard } from '@/components/StatCard';
import { ActionCard } from '@/components/ActionCard';
import { StatusIndicator } from '@/components/StatusIndicator';

const { Text, Title } = Typography;

const LoadingSkeleton = () => (
  <Row gutter={[16, 16]}>
    {[1, 2, 3, 4].map((i) => (
      <Col xs={24} sm={12} lg={6} key={i}>
        <Card variant="borderless" className="shadow-sm">
          <Skeleton active paragraph={{ rows: 1 }} />
        </Card>
      </Col>
    ))}
  </Row>
);

export default function Dashboard() {
  const router = useRouter();
  const { data: stats, isLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: statsService.getStats,
    refetchInterval: 30000,
  });

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl gradient-primary p-8 text-white fade-in">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
              <Activity size={32} />
            </div>
            <div>
              <Title level={2} className="!text-white !mb-1">
                RAG Indexing Dashboard
              </Title>
              <Text className="text-white/90 text-base">
                Monitor and manage your data indexing pipeline
              </Text>
            </div>
          </div>
        </div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32" />
        <div className="absolute bottom-0 right-20 w-40 h-40 bg-white/10 rounded-full -mb-20" />
      </div>

      {/* Stats Grid */}
      {isLoading ? (
        <LoadingSkeleton />
      ) : (
        <>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} lg={6}>
              <StatCard
                title="Active Sources"
                value={stats?.active_sources || 0}
                icon={Database}
                iconColor="text-blue-500"
                iconBg="bg-blue-50"
                onClick={() => router.push('/sources')}
              />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <StatCard
                title="Total Documents"
                value={stats?.total_documents || 0}
                icon={FileText}
                iconColor="text-green-500"
                iconBg="bg-green-50"
                progress={75}
                onClick={() => router.push('/indices')}
                trend="up"
                trendValue="+15%"
              />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <StatCard
                title="Vector Stores"
                value={stats?.active_sources || 0}
                icon={Layers}
                iconColor="text-purple-500"
                iconBg="bg-purple-50"
                onClick={() => router.push('/vector-stores')}
              />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <StatCard
                title="System Health"
                value="Healthy"
                icon={CheckCircle2}
                iconColor="text-emerald-500"
                iconBg="bg-emerald-50"
              />
            </Col>
          </Row>

          {/* Quick Actions */}
          <Card
            variant="borderless"
            className="shadow-sm"
            title={
              <Space>
                <Zap size={18} className="text-purple-600" />
                <span>Quick Actions</span>
              </Space>
            }
          >
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12} lg={6}>
                <ActionCard
                  icon={Database}
                  title="Add Data Source"
                  description="Connect new data sources"
                  onClick={() => router.push('/sources')}
                  iconColor="text-blue-600"
                  iconBg="bg-blue-50"
                />
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <ActionCard
                  icon={Layers}
                  title="Vector Stores"
                  description="Configure vector databases"
                  onClick={() => router.push('/vector-stores')}
                  iconColor="text-purple-600"
                  iconBg="bg-purple-50"
                />
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <ActionCard
                  icon={PlayCircle}
                  title="Start Ingestion"
                  description="Begin indexing job"
                  onClick={() => router.push('/jobs')}
                  iconColor="text-green-600"
                  iconBg="bg-green-50"
                />
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <ActionCard
                  icon={Zap}
                  title="AI Models"
                  description="Configure embeddings"
                  onClick={() => router.push('/models')}
                  iconColor="text-orange-600"
                  iconBg="bg-orange-50"
                />
              </Col>
            </Row>
          </Card>

          {/* Recent Activity & System Info */}
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={16}>
              <Card
                title={
                  <Space>
                    <TrendingUp size={18} className="text-green-600" />
                    <span>Recent Ingestion Jobs</span>
                  </Space>
                }
                variant="borderless"
                className="shadow-sm"
                extra={
                  <Button
                    type="link"
                    onClick={() => router.push('/jobs')}
                    icon={<Activity size={16} />}
                  >
                    View All
                  </Button>
                }
              >
                {(!stats?.recent_jobs || stats.recent_jobs.length === 0) ? (
                  <Alert
                    title="No recent jobs"
                    description="Start your first ingestion job to see activity here."
                    type="info"
                    showIcon
                    icon={<Info size={16} />}
                    action={
                      <Button size="small" type="primary" onClick={() => router.push('/jobs')}>
                        Start Now
                      </Button>
                    }
                  />
                ) : (
                  <Flex vertical>
                    {stats?.recent_jobs?.map((item: { id: string; source: string; status: 'completed' | 'failed' | 'running'; time: string }, index: number) => (
                      <React.Fragment key={item.id}>
                        <Flex
                          align="center"
                          justify="space-between"
                          style={{ padding: '12px 0' }}
                          className="hover:bg-gray-50 px-3 rounded-lg transition-colors cursor-pointer"
                          onClick={() => router.push('/jobs')}
                        >
                          <Flex gap="middle" align="center">
                            {item.status === 'completed' ?
                              <CheckCircle2 className="text-green-500" size={24} /> :
                              item.status === 'failed' ?
                              <AlertCircle className="text-red-500" size={24} /> :
                              <Play className="text-blue-500 animate-pulse" size={24} />
                            }
                            <div>
                              <div style={{ marginBottom: 4 }}>
                                <Text strong>{item.source}</Text>
                              </div>
                              <Text type="secondary" className="text-xs">
                                Job ID: {item.id} • <StatusIndicator
                                  status={item.status === 'completed' ? 'success' : item.status === 'failed' ? 'error' : 'processing'}
                                  text={item.status.toUpperCase()}
                                />
                              </Text>
                            </div>
                          </Flex>
                          <Text type="secondary" className="text-sm">{item.time}</Text>
                        </Flex>
                        {index < (stats?.recent_jobs?.length || 0) - 1 && <Divider style={{ margin: 0 }} />}
                      </React.Fragment>
                    ))}
                  </Flex>
                )}
              </Card>
            </Col>

            <Col xs={24} lg={8}>
              <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
                {/* System Status */}
                <Card
                  variant="borderless"
                  className="shadow-sm"
                  title={
                    <Space>
                      <CheckCircle2 size={18} className="text-green-600" />
                      <span>System Status</span>
                    </Space>
                  }
                >
                  <Space orientation="vertical" size="small" style={{ width: '100%' }}>
                    <Flex justify="space-between" align="center">
                      <Text type="secondary">Backend API</Text>
                      <Tag color="success" icon={<CheckCircle2 size={12} />}>Online</Tag>
                    </Flex>
                    <Flex justify="space-between" align="center">
                      <Text type="secondary">Vector Stores</Text>
                      <Tag color="processing">Ready</Tag>
                    </Flex>
                    <Flex justify="space-between" align="center">
                      <Text type="secondary">Last Check</Text>
                      <Text className="text-xs">Just now</Text>
                    </Flex>
                  </Space>
                </Card>

                {/* Getting Started */}
                <Card
                  variant="borderless"
                  className="shadow-sm border-2 border-purple-100"
                  title={
                    <Space>
                      <Info size={18} className="text-purple-600" />
                      <span>Getting Started</span>
                    </Space>
                  }
                >
                  <Space orientation="vertical" size="small" style={{ width: '100%' }}>
                    <Text type="secondary" className="text-sm">
                      Follow these steps to start indexing:
                    </Text>
                    <div className="space-y-2 mt-2">
                      <div className="flex items-start gap-2">
                        <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-semibold flex-shrink-0">1</div>
                        <Text className="text-sm">Add a data source</Text>
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-xs font-semibold flex-shrink-0">2</div>
                        <Text className="text-sm">Configure vector store</Text>
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs font-semibold flex-shrink-0">3</div>
                        <Text className="text-sm">Start ingestion job</Text>
                      </div>
                    </div>
                    <Button
                      type="primary"
                      block
                      className="mt-3"
                      icon={<Play size={16} />}
                      onClick={() => router.push('/sources')}
                    >
                      Get Started
                    </Button>
                  </Space>
                </Card>
              </Space>
            </Col>
          </Row>
        </>
      )}
    </div>
  );
}
