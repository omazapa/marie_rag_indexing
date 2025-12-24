'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Card, Typography, Empty } from 'antd';

const { Text } = Typography;

interface LogEntry {
  message: string;
  level: string;
  timestamp: string;
}

export const LogViewer: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const eventSource = new EventSource('http://localhost:5001/api/v1/ingest/logs');

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const newLog: LogEntry = {
        ...data,
        timestamp: new Date().toLocaleTimeString(),
      };
      setLogs((prev) => [...prev, newLog].slice(-100)); // Keep last 100 logs
    };

    eventSource.onerror = (err) => {
      console.error('EventSource failed:', err);
      // eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <Card 
      title="Ingestion Logs" 
      size="small" 
      styles={{ body: { padding: 0 } }}
      style={{ height: '300px', display: 'flex', flexDirection: 'column' }}
    >
      <div 
        ref={scrollRef}
        style={{ 
          backgroundColor: '#1e1e1e', 
          color: '#d4d4d4', 
          padding: '12px', 
          fontFamily: 'monospace', 
          fontSize: '12px',
          overflowY: 'auto',
          flex: 1
        }}
      >
        {logs.length === 0 ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <Text style={{ color: '#666' }}>Waiting for logs...</Text>
          </div>
        ) : (
          logs.map((log, index) => (
            <div key={index} style={{ marginBottom: '4px' }}>
              <span style={{ color: '#569cd6' }}>[{log.timestamp}]</span>{' '}
              <span style={{ color: log.level === 'error' ? '#f44747' : '#ce9178' }}>
                {log.level.toUpperCase()}:
              </span>{' '}
              <span>{log.message}</span>
            </div>
          ))
        )}
      </div>
    </Card>
  );
};
