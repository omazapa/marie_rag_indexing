import React from 'react';
import { Form, Input, Select, Switch, InputNumber, Row, Col } from 'antd';

interface ConfigField {
  type: string;
  title?: string;
  description?: string;
  default?: unknown;
  minimum?: number;
  maximum?: number;
  [key: string]: unknown;
}

interface DynamicConfigFormProps {
  schema: {
    type: string;
    properties: Record<string, ConfigField>;
    required?: string[];
  };
  prefix?: string;
}

export const DynamicConfigForm: React.FC<DynamicConfigFormProps> = ({
  schema,
  prefix = "",
}) => {
  if (!schema || !schema.properties) return null;

  const renderField = (key: string, field: ConfigField) => {
    const name = prefix ? [prefix, key] : key;
    const label = field.title || key;
    const required = schema.required?.includes(key);

    switch (field.type) {
      case "string":
        const isPassword = key.toLowerCase().includes('password') || key.toLowerCase().includes('secret') || key.toLowerCase().includes('key');
        return (
          <Form.Item
            key={key}
            name={name}
            label={label}
            tooltip={field.description}
            rules={[{ required, message: `Please input ${label}!` }]}
            initialValue={field.default}
          >
            {isPassword ? (
              <Input.Password placeholder="••••••••" />
            ) : (
              <Input placeholder={(field.default as string) || ''} />
            )}
          </Form.Item>
        );
      case 'boolean':
        return (
          <Form.Item
            key={key}
            name={name}
            label={label}
            tooltip={field.description}
            valuePropName="checked"
            initialValue={field.default}
          >
            <Switch />
          </Form.Item>
        );
      case 'integer':
      case 'number':
        return (
          <Form.Item
            key={key}
            name={name}
            label={label}
            tooltip={field.description}
            rules={[{ required, message: `Please input ${label}!` }]}
            initialValue={field.default}
          >
            <InputNumber style={{ width: '100%' }} min={field.minimum} max={field.maximum} />
          </Form.Item>
        );
      case 'array':
        return (
          <Form.Item
            key={key}
            name={name}
            label={label}
            tooltip={field.description}
            initialValue={field.default}
          >
            <Select mode="tags" placeholder="Add items..." style={{ width: '100%' }} />
          </Form.Item>
        );
      case 'object':
        return (
          <Form.Item
            key={key}
            name={name}
            label={label}
            tooltip={field.description}
            initialValue={field.default}
          >
            <Input.TextArea rows={4} placeholder="JSON format..." />
          </Form.Item>
        );
      default:
        return null;
    }
  };

  return (
    <Row gutter={[16, 0]}>
      {Object.entries(schema.properties).map(([key, field]) => (
        <Col span={field.type === 'object' || field.type === 'array' ? 24 : 12} key={key}>
          {renderField(key, field)}
        </Col>
      ))}
    </Row>
  );
};
