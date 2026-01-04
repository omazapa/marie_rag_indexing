import React from 'react';
import { Tooltip, Space } from 'antd';
import { Info, HelpCircle } from 'lucide-react';

interface InfoTooltipProps {
  title: string;
  content: string | React.ReactNode;
  icon?: 'info' | 'help';
}

export const InfoTooltip: React.FC<InfoTooltipProps> = ({
  title,
  content,
  icon = 'info',
}) => {
  const Icon = icon === 'info' ? Info : HelpCircle;

  return (
    <Tooltip
      title={
        <div className="p-2">
          <div className="font-semibold mb-1">{title}</div>
          <div className="text-xs">{content}</div>
        </div>
      }
      styles={{ root: { maxWidth: 300 } }}
    >
      <Icon size={14} className="text-gray-400 cursor-help hover:text-purple-600 transition-colors" />
    </Tooltip>
  );
};

interface FormItemWithTooltipProps {
  label: string;
  tooltip?: string;
  children: React.ReactNode;
}

export const FormItemWithTooltip: React.FC<FormItemWithTooltipProps> = ({
  label,
  tooltip,
  children,
}) => {
  return (
    <>
      {tooltip ? (
        <Space size={4}>
          <span>{label}</span>
          <InfoTooltip title={label} content={tooltip} />
        </Space>
      ) : (
        label
      )}
      {children}
    </>
  );
};
