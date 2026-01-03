import React from 'react';
import { Card, Table, Space, Typography } from 'antd';
import { LucideIcon } from 'lucide-react';
import type { TableProps } from 'antd';

const { Text } = Typography;

interface TableCardProps<T> extends Omit<TableProps<T>, 'title'> {
  cardTitle: string;
  icon?: LucideIcon;
  extra?: React.ReactNode;
  description?: string;
}

export function TableCard<T extends object>({
  cardTitle,
  icon: Icon,
  extra,
  description,
  ...tableProps
}: TableCardProps<T>) {
  return (
    <Card
      title={
        <Space>
          {Icon && <Icon size={18} />}
          <span>{cardTitle}</span>
        </Space>
      }
      extra={extra}
      variant="borderless"
      className="shadow-sm"
    >
      {description && (
        <Text type="secondary" className="block mb-4">
          {description}
        </Text>
      )}
      <Table {...tableProps} />
    </Card>
  );
}
