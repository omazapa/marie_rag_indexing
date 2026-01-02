import React from 'react';
import { Form, Input, Select, Switch, InputNumber, Space, Typography } from 'antd';

const { Text } = Typography;

interface DynamicConfigFormProps {
  schema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
  prefix?: string;
}

export const DynamicConfigForm: React.FC<DynamicConfigFormProps> = ({ schema, prefix = '' }) => {
  if (!schema || !schema.properties) return null;

  const renderField = (key: string, field: any) => {
    const name = prefix ? [prefix, key] : key;
    const label = field.title || key;
    const required = schema.required?.includes(key);

    switch (field.type) {
      case 'string':
        return (
          <Form.Item
            key={key}
            name={name}
            label={label}
            tooltip={field.description}
            rules={[{ required, message: `Please input ${label}!` }]}
            initialValue={field.default}
          >
            <Input placeholder={field.default || ''} />
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
    <div className="space-y-2">
      {Object.entries(schema.properties).map(([key, field]) => renderField(key, field))}
    </div>
  );
};
