import React from 'react';
import { Card, Space, Typography } from 'antd';
import { LucideIcon, ArrowRight } from 'lucide-react';

const { Text } = Typography;

interface ActionCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  onClick: () => void;
  iconColor?: string;
  iconBg?: string;
}

export const ActionCard: React.FC<ActionCardProps> = ({
  icon: Icon,
  title,
  description,
  onClick,
  iconColor = 'text-purple-600',
  iconBg = 'bg-purple-50',
}) => {
  return (
    <Card
      variant="borderless"
      className="shadow-sm cursor-pointer transition-all duration-250 hover:shadow-md hover:-translate-y-1 border border-gray-100"
      onClick={onClick}
    >
      <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
        <div className="flex items-center justify-between">
          <div className={`p-3 rounded-lg ${iconBg}`}>
            <Icon size={24} className={iconColor} />
          </div>
          <ArrowRight size={20} className="text-gray-400" />
        </div>

        <div>
          <Text strong className="text-base block mb-1">
            {title}
          </Text>
          <Text type="secondary" className="text-sm">
            {description}
          </Text>
        </div>
      </Space>
    </Card>
  );
};
