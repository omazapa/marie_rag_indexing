import React from 'react';
import { Card, Statistic, Progress } from 'antd';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  suffix?: React.ReactNode;
  prefix?: React.ReactNode;
  progress?: number;
  trend?: 'up' | 'down';
  trendValue?: string;
  loading?: boolean;
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon: Icon,
  iconColor = 'text-blue-500',
  iconBg = 'bg-blue-50',
  suffix,
  prefix,
  progress,
  trend,
  trendValue,
  loading = false,
  onClick,
}) => {
  return (
    <Card
      variant="borderless"
      className={`shadow-sm transition-all duration-250 ${
        onClick ? 'cursor-pointer hover:shadow-md hover:-translate-y-1' : ''
      }`}
      onClick={onClick}
      loading={loading}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-lg ${iconBg}`}>
          <Icon size={20} className={iconColor} />
        </div>
        {trend && trendValue && (
          <div
            className={`text-sm font-medium ${
              trend === 'up' ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {trend === 'up' ? '↑' : '↓'} {trendValue}
          </div>
        )}
      </div>

      <Statistic
        title={title}
        value={value}
        prefix={prefix}
        suffix={suffix}
        styles={{ content: { fontSize: '24px', fontWeight: 600 } }}
      />

      {progress !== undefined && (
        <Progress
          percent={progress}
          showInfo={false}
          size="small"
          strokeColor="#722ed1"
          className="mt-2"
        />
      )}
    </Card>
  );
};
