'use client';

import React, { useState, useEffect, useRef } from 'react';
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
  Alert,
  Button,
  Modal,
  Divider,
  App,
} from 'antd';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Play,
  Database,
  Layers,
  Eye,
  FileText,
  StopCircle,
  ChevronDown,
  ChevronUp,
  Trash2,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { jobService, IngestionJob } from '@/services/jobService';
import { EmptyState } from '@/components/EmptyState';
import { ingestionService } from '@/services/ingestionService';
import Link from 'next/link';

const { Title, Text } = Typography;
const { useApp } = App;

export default function JobsPage() {
  const [selectedJob, setSelectedJob] = useState<IngestionJob | null>(null);
  const [isLogsModalOpen, setIsLogsModalOpen] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false); // Collapsed by default
  const [, setCurrentTime] = useState(Date.now()); // Force re-render for live durations
  const logsEndRef = useRef<HTMLDivElement>(null);
  const { message, modal } = useApp();

  const { data: jobs, isLoading, refetch } = useQuery({
    queryKey: ['jobs'],
    queryFn: jobService.getJobs,
    refetchInterval: 1000, // Auto-refresh every 1 second for real-time updates
  });

  // Update current time every second to refresh durations
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Update selectedJob when jobs data changes (for real-time updates in modal)
  useEffect(() => {
    if (selectedJob && jobs) {
      const updatedJob = jobs.find((job: IngestionJob) => job.id === selectedJob.id);
      if (updatedJob) {
        setSelectedJob(updatedJob);
      }
    }
  }, [jobs, selectedJob?.id]); // Added selectedJob.id to dependencies

  // Connect to log streaming when modal is open
  useEffect(() => {
    if (!isLogsModalOpen) {
      // Don't clear logs when modal closes - keep them for when it reopens
      return;
    }

    // Clear old logs when opening modal
    setLogs([]);

    const eventSource = new EventSource(`${process.env.NEXT_PUBLIC_API_URL}/ingest/logs`);

    eventSource.onmessage = (event) => {
      try {
        const logData = JSON.parse(event.data);
        const timestamp = logData.timestamp ? new Date(logData.timestamp).toLocaleTimeString() : '';
        const logEntry = `${timestamp ? `[${timestamp}] ` : ''}[${logData.level.toUpperCase()}] ${logData.message}`;
        setLogs(prev => [...prev, logEntry].slice(-200)); // Keep last 200 logs
      } catch (e) {
        console.error('Error parsing log:', e);
      }
    };

    eventSource.onerror = (error) => {
      console.error('EventSource error:', error);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [isLogsModalOpen]);

  // Auto-scroll logs to bottom
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleRetryJob = async (job: IngestionJob) => {
    modal.confirm({
      title: 'Retry Ingestion Job?',
      content: `This will start a new ingestion job with the same configuration for "${job.data_source_id}".`,
      okText: 'Retry',
      okType: 'primary',
      onOk: async () => {
        try {
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/jobs/${job.id}/retry`, {
            method: 'POST',
          });

          if (!response.ok) {
            throw new Error('Failed to retry job');
          }

          const result = await response.json();
          message.success(`Job retry initiated! New Job ID: ${result.new_job_id.slice(0, 8)}...`);
          refetch();
        } catch (error) {
          message.error('Failed to retry job');
        }
      },
    });
  };

  const handleCancelJob = async (job: IngestionJob) => {
    modal.confirm({
      title: 'Cancel Running Job?',
      content: `Are you sure you want to cancel this job? This action cannot be undone.`,
      okText: 'Cancel Job',
      okType: 'danger',
      onOk: async () => {
        try {
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/jobs/${job.id}/cancel`, {
            method: 'POST',
          });

          if (!response.ok) {
            throw new Error('Failed to cancel job');
          }

          message.success('Job cancelled successfully');
          refetch();
        } catch (error) {
          message.error('Failed to cancel job');
        }
      },
    });
  };

  const handleDeleteJob = async (job: IngestionJob) => {
    modal.confirm({
      title: 'Delete Job?',
      content: `Are you sure you want to delete this job? This action cannot be undone.`,
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/jobs/${job.id}`, {
            method: 'DELETE',
          });

          if (!response.ok) {
            throw new Error('Failed to delete job');
          }

          message.success('Job deleted successfully');
          refetch();
        } catch (error) {
          message.error('Failed to delete job');
        }
      },
    });
  };

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
    if (!startedAt) return 'N/A';

    // Parse ISO 8601 datetime
    const start = new Date(startedAt).getTime();

    // If invalid date
    if (isNaN(start)) return 'N/A';

    const end = completedAt ? new Date(completedAt).getTime() : Date.now();
    const durationMs = end - start;

    // Prevent negative durations
    if (durationMs < 0) return 'In progress...';

    const seconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const isJobStuck = (job: IngestionJob): boolean => {
    if (job.status !== 'running') return false;

    // Check last_update, fallback to started_at if not available
    const updateTime = job.last_update || job.started_at;
    if (!updateTime) return false;

    try {
      const lastUpdate = new Date(updateTime).getTime();
      const now = Date.now();

      // If date is invalid
      if (isNaN(lastUpdate)) {
        console.warn('Invalid date for job', job.id, updateTime);
        return false;
      }

      const minutesSinceUpdate = (now - lastUpdate) / 1000 / 60;

      // Consider stuck if no update in 2 minutes (reduced threshold for faster detection)
      const isStuck = minutesSinceUpdate > 2;

      if (isStuck) {
        console.log(`Job ${job.id} is stuck - ${minutesSinceUpdate.toFixed(1)} minutes since last update`);
      }

      return isStuck;
    } catch (error) {
      console.error('Error checking if job is stuck:', error);
      return false;
    }
  };

  const getProcessingRate = (job: IngestionJob): number => {
    if (job.status !== 'running' || !job.started_at) return 0;

    try {
      const start = new Date(job.started_at).getTime();
      const now = Date.now();
      const elapsedSeconds = (now - start) / 1000;

      // Ensure positive elapsed time
      if (elapsedSeconds <= 0) {
        console.warn('Invalid elapsed time for job', job.id, 'elapsed:', elapsedSeconds);
        return 0;
      }

      const rate = job.documents_processed / elapsedSeconds;
      return rate > 0 ? rate : 0;
    } catch (error) {
      console.error('Error calculating processing rate:', error);
      return 0;
    }
  };

  const getChunksRate = (job: IngestionJob): number => {
    if (job.status !== 'running' || !job.started_at) return 0;

    try {
      const start = new Date(job.started_at).getTime();
      const now = Date.now();
      const elapsedSeconds = (now - start) / 1000;

      if (elapsedSeconds <= 0) return 0;

      const rate = job.chunks_created / elapsedSeconds;
      return rate > 0 ? rate : 0;
    } catch (error) {
      console.error('Error calculating chunks rate:', error);
      return 0;
    }
  };

  const formatRate = (rate: number): string => {
    if (rate === 0) return '0/s';
    if (rate < 1) return `${(rate * 60).toFixed(1)}/min`;
    return `${rate.toFixed(2)}/s`;
  };

  const columns = [
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 180,
      render: (_: unknown, record: IngestionJob) => (
        <Flex align="center" gap={8} wrap="wrap">
          {getStatusIcon(record.status)}
          {getStatusTag(record.status)}
          {isJobStuck(record) && (
            <Badge
              status="warning"
              text={
                <Text type="warning" className="text-xs font-semibold">
                  Possibly stuck
                </Text>
              }
            />
          )}
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
      dataIndex: 'data_source_id',
      key: 'data_source_id',
      render: (plugin: string) => (
        <Space>
          <Database size={16} className="text-blue-500" />
          <Text>{plugin?.replace('_', ' ').toUpperCase() || 'N/A'}</Text>
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
            {record.vector_store_id?.toUpperCase() || 'N/A'}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Progress',
      key: 'progress',
      width: 250,
      render: (_: unknown, record: IngestionJob) => {
        if (record.status === 'running') {
          const docsPerSec = getProcessingRate(record);
          const chunksPerSec = getChunksRate(record);
          let percent: number | undefined = undefined;

          if (record.total_documents && record.total_documents > 0) {
            const exactPercent = (record.documents_processed / record.total_documents) * 100;
            // Show at least 1% if processing has started, otherwise show exact percentage
            percent = record.documents_processed > 0 && exactPercent < 1
              ? 1
              : Math.floor(exactPercent);
          }

          return (
            <div style={{ minWidth: 230 }}>
              <div className="flex items-center gap-2 mb-2">
                <Progress
                  percent={percent}
                  status="active"
                  showInfo={true}
                  size="small"
                  className="flex-1"
                  format={(percent) => {
                    if (!record.total_documents || record.total_documents === 0) return '';
                    const exactPercent = (record.documents_processed / record.total_documents) * 100;
                    return exactPercent < 1 ? `${exactPercent.toFixed(2)}%` : `${Math.floor(exactPercent)}%`;
                  }}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Text strong className="text-sm">
                  📄 {record.documents_processed || 0}
                  {record.total_documents ? ` / ${record.total_documents}` : ''}
                </Text>
                <Text type="success" className="text-sm font-bold">
                  ⚡ {docsPerSec.toFixed(2)} docs/s
                </Text>
                <Text type="secondary" className="text-xs">
                  📦 {record.chunks_created || 0} chunks
                </Text>
              </div>
            </div>
          );
        }
        return (
          <Space orientation="vertical" size={0}>
            <Text strong>{record.documents_processed} docs</Text>
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
      render: (_: unknown, record: IngestionJob) => {
        // For running jobs, calculate duration in real-time
        if (record.status === 'running') {
          const duration = formatDuration(record.started_at, null);
          return <Text type="secondary" className="font-mono">{duration}</Text>;
        }
        // For completed/failed jobs, show final duration
        return (
          <Text type="secondary" className="font-mono">
            {formatDuration(record.started_at, record.completed_at)}
          </Text>
        );
      },
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
    {
      title: 'Actions',
      key: 'actions',
      width: 240,
      render: (_: unknown, record: IngestionJob) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<Eye size={16} />}
            onClick={() => {
              setSelectedJob(record);
              setIsLogsModalOpen(true);
            }}
          >
            Details
          </Button>
          {record.status === 'running' && (
            <Button
              type="link"
              size="small"
              danger
              icon={<StopCircle size={16} />}
              onClick={() => handleCancelJob(record)}
            >
              Stop
            </Button>
          )}
          {(record.status === 'failed' || record.status === 'completed') && (
            <>
              <Button
                type="link"
                size="small"
                icon={<Play size={16} />}
                onClick={() => handleRetryJob(record)}
              >
                Retry
              </Button>
              <Button
                type="link"
                size="small"
                danger
                icon={<Trash2 size={16} />}
                onClick={() => handleDeleteJob(record)}
              >
                Delete
              </Button>
            </>
          )}
        </Space>
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

      {/* Job Details Modal */}
      <Modal
        title={
          <Space>
            <FileText size={20} />
            <span>Job Details</span>
          </Space>
        }
        open={isLogsModalOpen}
        onCancel={() => {
          setIsLogsModalOpen(false);
          setSelectedJob(null);
        }}
        footer={[
          <Button key="close" onClick={() => setIsLogsModalOpen(false)}>
            Close
          </Button>
        ]}
        width={800}
      >
        {selectedJob && (
          <Space orientation="vertical" className="w-full" size="large">
            <Card size="small" title="Job Information">
              <Space orientation="vertical" className="w-full">
                <div className="flex justify-between">
                  <Text type="secondary">Job ID:</Text>
                  <Text code className="text-xs">{selectedJob.id}</Text>
                </div>
                <div className="flex justify-between">
                  <Text type="secondary">Status:</Text>
                  {getStatusTag(selectedJob.status)}
                </div>
                <div className="flex justify-between">
                  <Text type="secondary">Data Source:</Text>
                  <Text strong>{selectedJob.data_source_id}</Text>
                </div>
                <div className="flex justify-between">
                  <Text type="secondary">Vector Store:</Text>
                  <Text strong>{selectedJob.vector_store_id}</Text>
                </div>
                {selectedJob.config?.execution_mode && (
                  <div className="flex justify-between">
                    <Text type="secondary">Execution Mode:</Text>
                    <Text strong className="capitalize">
                      {selectedJob.config.execution_mode}
                      {selectedJob.config.execution_mode === 'parallel' && selectedJob.config.max_workers && (
                        <Text type="secondary" className="ml-2">
                          ({selectedJob.config.max_workers} workers)
                        </Text>
                      )}
                    </Text>
                  </div>
                )}
                <div className="flex justify-between">
                  <Text type="secondary">Started:</Text>
                  <Text>{new Date(selectedJob.started_at).toLocaleString()}</Text>
                </div>
                {selectedJob.completed_at && (
                  <div className="flex justify-between">
                    <Text type="secondary">Completed:</Text>
                    <Text>{new Date(selectedJob.completed_at).toLocaleString()}</Text>
                  </div>
                )}
                <div className="flex justify-between">
                  <Text type="secondary">Duration:</Text>
                  <Text>{formatDuration(selectedJob.started_at, selectedJob.completed_at)}</Text>
                </div>
              </Space>
            </Card>

            <Card size="small" title="Processing Stats">
              <Space orientation="vertical" className="w-full">
                {selectedJob.status === 'running' && !isJobStuck(selectedJob) && (
                  <Alert
                    message="Job in Progress"
                    description={
                      <Space direction="vertical" size="small">
                        <Text>Statistics update in real-time every second</Text>
                        {getProcessingRate(selectedJob) > 0 && (
                          <Space size="large">
                            <Text strong type="success">
                              📄 Docs: {formatRate(getProcessingRate(selectedJob))}
                            </Text>
                            <Text strong type="success">
                              📦 Chunks: {formatRate(getChunksRate(selectedJob))}
                            </Text>
                          </Space>
                        )}
                      </Space>
                    }
                    type="info"
                    showIcon
                    banner
                  />
                )}
                {isJobStuck(selectedJob) && (
                  <Alert
                    message="⚠️ Job Appears to be Stuck"
                    description={
                      <Space orientation="vertical" size="small">
                        <Text>
                          No progress detected for more than 2 minutes.
                          Last update: {selectedJob.last_update
                            ? new Date(selectedJob.last_update).toLocaleString()
                            : new Date(selectedJob.started_at).toLocaleString()}
                        </Text>
                        <Text strong className="text-sm">Possible causes:</Text>
                        <ul className="ml-4 text-xs">
                          <li>MongoDB connection timeout or cursor closed</li>
                          <li>OpenSearch indexing blocked or not responding</li>
                          <li>Network connectivity issues</li>
                          <li>Resource exhaustion (memory, disk space)</li>
                        </ul>
                        <Text strong type="danger">Recommendation: Cancel this job and retry.</Text>
                      </Space>
                    }
                    type="warning"
                    showIcon
                    action={
                      <Button size="small" danger onClick={() => handleCancelJob(selectedJob)}>
                        Cancel Job
                      </Button>
                    }
                  />
                )}
                <Progress
                  percent={
                    selectedJob.status === 'completed'
                      ? 100
                      : (selectedJob.total_documents && selectedJob.total_documents > 0
                          ? (() => {
                              const exactPercent = (selectedJob.documents_processed / selectedJob.total_documents) * 100;
                              return selectedJob.documents_processed > 0 && exactPercent < 1 ? 1 : Math.floor(exactPercent);
                            })()
                          : undefined)
                  }
                  status={selectedJob.status === 'failed' ? 'exception' : 'active'}
                  showInfo={true}
                  format={(percent) => {
                    if (selectedJob.status === 'completed') return '100%';
                    if (!selectedJob.total_documents || selectedJob.total_documents === 0) return '';
                    const exactPercent = (selectedJob.documents_processed / selectedJob.total_documents) * 100;
                    return exactPercent < 1 ? `${exactPercent.toFixed(2)}%` : `${Math.floor(exactPercent)}%`;
                  }}
                />
                {selectedJob.total_documents && selectedJob.total_documents > 0 && (
                  <div className="flex justify-between items-center">
                    <Text type="secondary">Total Documents:</Text>
                    <Text strong className="text-base">{selectedJob.total_documents}</Text>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <Text type="secondary">Documents Processed:</Text>
                  <div className="flex items-center gap-2">
                    <Text strong className="text-lg">{selectedJob.documents_processed || 0}</Text>
                    {selectedJob.status === 'running' && (
                      <Badge status="processing" />
                    )}
                  </div>
                </div>
                {selectedJob.total_documents && selectedJob.total_documents > 0 && selectedJob.status === 'running' && (
                  <div className="flex justify-between items-center">
                    <Text type="secondary">Remaining:</Text>
                    <Text type="warning" className="text-base">
                      {selectedJob.total_documents - selectedJob.documents_processed} docs
                    </Text>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <Text type="secondary">Chunks Created:</Text>
                  <div className="flex items-center gap-2">
                    <Text strong className="text-lg">{selectedJob.chunks_created || 0}</Text>
                    {selectedJob.status === 'running' && (
                      <Badge status="processing" />
                    )}
                  </div>
                </div>
                {selectedJob.status === 'running' && getProcessingRate(selectedJob) > 0 && (
                  <>
                    <div className="flex justify-between items-center">
                      <Text type="secondary">Current Doc Rate:</Text>
                      <Text strong type="success" className="text-lg">
                        📄 {formatRate(getProcessingRate(selectedJob))}
                      </Text>
                    </div>
                    <div className="flex justify-between items-center">
                      <Text type="secondary">Current Chunk Rate:</Text>
                      <Text strong type="success" className="text-lg">
                        📦 {formatRate(getChunksRate(selectedJob))}
                      </Text>
                    </div>
                    <div className="flex justify-between items-center">
                      <Text type="secondary">Average Chunks/Doc:</Text>
                      <Text strong className="text-base">
                        {selectedJob.documents_processed > 0
                          ? (selectedJob.chunks_created / selectedJob.documents_processed).toFixed(2)
                          : '0'}
                      </Text>
                    </div>
                  </>
                )}
                {selectedJob.status === 'completed' && (
                  <>
                    {selectedJob.avg_docs_per_second && (
                      <div className="flex justify-between items-center">
                        <Text type="secondary">Average Doc Speed:</Text>
                        <Text strong type="success" className="text-lg">
                          📄 {formatRate(selectedJob.avg_docs_per_second)}
                        </Text>
                      </div>
                    )}
                    {selectedJob.avg_chunks_per_second && (
                      <div className="flex justify-between items-center">
                        <Text type="secondary">Average Chunk Speed:</Text>
                        <Text strong type="success" className="text-lg">
                          📦 {formatRate(selectedJob.avg_chunks_per_second)}
                        </Text>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <Text type="secondary">Average Chunks/Doc:</Text>
                      <Text strong className="text-base">
                        {selectedJob.documents_processed > 0
                          ? (selectedJob.chunks_created / selectedJob.documents_processed).toFixed(2)
                          : '0'}
                      </Text>
                    </div>
                  </>
                )}
              </Space>
            </Card>

            {selectedJob.error && (
              <Alert
                title="Error Details"
                description={<pre className="text-xs overflow-auto">{selectedJob.error}</pre>}
                type="error"
                showIcon
              />
            )}

            {selectedJob.status === 'running' && (
              <Alert
                title="Job in Progress"
                description="This job is currently processing. Details will update automatically."
                type="info"
                showIcon
              />
            )}

            {/* Live Logs Console */}
            <Card
              size="small"
              title={
                <div className="flex justify-between items-center w-full">
                  <Space>
                    <FileText size={16} />
                    <span>Live Logs</span>
                    {logs.length > 0 && (
                      <Badge count={logs.length} showZero style={{ backgroundColor: '#52c41a' }} />
                    )}
                  </Space>
                  <Button
                    type="text"
                    size="small"
                    icon={showLogs ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    onClick={() => setShowLogs(!showLogs)}
                  />
                </div>
              }
            >
              {showLogs && (
                <div
                  className="bg-gray-900 text-green-400 font-mono text-xs p-4 rounded overflow-y-auto"
                  style={{ maxHeight: '300px', minHeight: '200px' }}
                >
                  {logs.length === 0 ? (
                    <div className="text-gray-500 text-center py-8">
                      Waiting for logs...
                    </div>
                  ) : (
                    <>
                      {logs.map((log, index) => (
                        <div key={index} className="mb-1">
                          {log}
                        </div>
                      ))}
                      <div ref={logsEndRef} />
                    </>
                  )}
                </div>
              )}
            </Card>
          </Space>
        )}
      </Modal>
    </div>
  );
}
