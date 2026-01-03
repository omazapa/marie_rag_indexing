import React from 'react';
import { Typography, Space, Breadcrumb } from 'antd';
import { LucideIcon } from 'lucide-react';
import Link from 'next/link';

const { Title, Text } = Typography;

interface BreadcrumbItem {
  title: React.ReactNode;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  breadcrumbs?: BreadcrumbItem[];
  extra?: React.ReactNode;
  gradient?: boolean;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  icon: Icon,
  breadcrumbs,
  extra,
  gradient = false,
}) => {
  return (
    <div className="space-y-4 mb-6">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumb
          items={breadcrumbs.map((item) =>
            item.href
              ? { title: <Link href={item.href}>{item.title}</Link> }
              : { title: item.title }
          )}
        />
      )}

      <div className="flex justify-between items-start fade-in">
        <Space orientation="vertical" size={4}>
          <Space align="center" size="middle">
            {Icon && (
              <div
                className={`p-3 rounded-lg ${
                  gradient ? 'gradient-primary' : 'bg-purple-100'
                }`}
              >
                <Icon
                  size={24}
                  className={gradient ? 'text-white' : 'text-purple-600'}
                />
              </div>
            )}
            <Title level={2} style={{ margin: 0 }}>
              {title}
            </Title>
          </Space>
          {description && (
            <Text type="secondary" className="text-base">
              {description}
            </Text>
          )}
        </Space>
        {extra && <div className="slide-in-right">{extra}</div>}
      </div>
    </div>
  );
};
