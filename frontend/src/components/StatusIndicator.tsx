import React from 'react';
import { Badge, Tag } from 'antd';
import { CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';

type Status = 'success' | 'error' | 'warning' | 'info' | 'processing';

interface StatusIndicatorProps {
  status: Status;
  text: string;
  showIcon?: boolean;
  pulse?: boolean;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  text,
  showIcon = true,
  pulse = false,
}) => {
  const getIcon = () => {
    switch (status) {
      case 'success':
        return <CheckCircle2 size={14} />;
      case 'error':
        return <XCircle size={14} />;
      case 'warning':
        return <AlertCircle size={14} />;
      case 'processing':
        return <Clock size={14} className={pulse ? 'animate-pulse' : ''} />;
      default:
        return <Clock size={14} />;
    }
  };

  const getColor = () => {
    switch (status) {
      case 'success':
        return 'success';
      case 'error':
        return 'error';
      case 'warning':
        return 'warning';
      case 'processing':
        return 'processing';
      default:
        return 'default';
    }
  };

  return (
    <Tag color={getColor()} icon={showIcon ? getIcon() : undefined}>
      {text}
    </Tag>
  );
};

interface StatusBadgeProps {
  status: Status;
  text: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, text }) => {
  const getStatus = () => {
    switch (status) {
      case 'success':
        return 'success';
      case 'error':
        return 'error';
      case 'warning':
        return 'warning';
      case 'processing':
        return 'processing';
      default:
        return 'default';
    }
  };

  return <Badge status={getStatus()} text={text} />;
};
