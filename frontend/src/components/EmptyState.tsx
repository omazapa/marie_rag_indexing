import React from 'react';
import { Empty, Button } from 'antd';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}) => {
  return (
    <Empty
      image={
        Icon ? (
          <div className="flex justify-center mb-4">
            <Icon size={64} className="text-gray-300" />
          </div>
        ) : (
          Empty.PRESENTED_IMAGE_SIMPLE
        )
      }
      imageStyle={{ height: Icon ? 'auto' : 60 }}
      description={
        <div className="space-y-2">
          <div className="text-lg font-semibold text-gray-700">{title}</div>
          <div className="text-sm text-gray-500">{description}</div>
        </div>
      }
    >
      {actionLabel && onAction && (
        <Button type="primary" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </Empty>
  );
};
