import React, { useState, useEffect, useCallback } from 'react';
import { Form, Input, Select, Button, App, Row, Col, Divider, FormInstance } from 'antd';
import { mongodbService } from '@/services/mongodbService';
import { Database, Table, Zap } from 'lucide-react';

interface MongoDBConfigFormProps {
  form: FormInstance;
}

export const MongoDBConfigForm: React.FC<MongoDBConfigFormProps> = ({ form }) => {
  const { message } = App.useApp();
  const [databases, setDatabases] = useState<string[]>([]);
  const [collections, setCollections] = useState<string[]>([]);
  const [isLoadingDbs, setIsLoadingDbs] = useState(false);
  const [isLoadingCols, setIsLoadingCols] = useState(false);

  const connectionString = Form.useWatch('connection_string', form);
  const selectedDb = Form.useWatch('database', form);

  const fetchDatabases = async () => {
    if (!connectionString) {
      message.warning('Please enter a connection string first');
      return;
    }

    setIsLoadingDbs(true);
    try {
      const result = await mongodbService.getDatabases(connectionString);
      setDatabases(result.databases);
      message.success('Databases loaded successfully');
    } catch (error: unknown) {
      console.error('MongoDB Error:', error);
      let errMsg = 'Network Error or Backend Unreachable';

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const axiosError = error as any;
      if (axiosError.response) {
        // The request was made and the server responded with a status code
        errMsg = axiosError.response.data?.error || `Server Error (${axiosError.response.status})`;
      } else if (axiosError.request) {
        // The request was made but no response was received
        errMsg = 'No response from backend. Check if the backend container is running.';
      } else {
        errMsg = axiosError.message || 'Unknown error';
      }

      message.error(`Failed to load databases: ${errMsg}`, 5);
    } finally {
      setIsLoadingDbs(false);
    }
  };

  const fetchCollections = useCallback(async (db: string) => {
    if (!connectionString || !db) return;
    setIsLoadingCols(true);
    try {
      const result = await mongodbService.getCollections(connectionString, db);
      setCollections(result.collections);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      message.error(`Failed to load collections: ${errMsg}`);
    } finally {
      setIsLoadingCols(false);
    }
  }, [connectionString, message]);

  useEffect(() => {
    if (selectedDb) {
      fetchCollections(selectedDb);
    } else {
      setCollections([]);
    }
  }, [selectedDb, fetchCollections]);

  return (
    <div className="space-y-4">
      <Row gutter={16} align="bottom">
        <Col span={18}>
          <Form.Item
            name="connection_string"
            label="Connection URI"
            rules={[{ required: true, message: 'Connection URI is required' }]}
            initialValue="mongodb://192.168.1.10:27017"
            tooltip="Enter your MongoDB connection string"
          >
            <Input.Password placeholder="mongodb://user:pass@host:port" />
          </Form.Item>
        </Col>
        <Col span={6}>
          <Form.Item>
            <Button
              icon={<Zap size={14} />}
              onClick={fetchDatabases}
              loading={isLoadingDbs}
              block
            >
              Connect
            </Button>
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            name="database"
            label="Database"
            rules={[{ required: true, message: 'Please select a database' }]}
          >
            <Select
              placeholder="Select database"
              loading={isLoadingDbs}
              options={databases.map(db => ({ label: db, value: db }))}
              showSearch
              suffixIcon={<Database size={14} />}
            />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            name="collection"
            label="Collection"
            rules={[{ required: true, message: 'Please select a collection' }]}
          >
            <Select
              placeholder="Select collection"
              loading={isLoadingCols}
              options={collections.map(col => ({ label: col, value: col }))}
              showSearch
              disabled={!selectedDb}
              suffixIcon={<Table size={14} />}
            />
          </Form.Item>
        </Col>
      </Row>

      <Divider style={{ margin: '12px 0' }} />

      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            name="content_field"
            label="Content Field"
            initialValue="text"
            rules={[{ required: true }]}
            tooltip="The field containing the text to be indexed"
          >
            <Input placeholder="e.g. text, body" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            name="metadata_fields"
            label="Metadata Fields"
            initialValue={[]}
            tooltip="Additional fields to include as metadata"
          >
            <Select mode="tags" placeholder="e.g. author, date" />
          </Form.Item>
        </Col>
      </Row>
    </div>
  );
};
