import React from 'react';
import { Modal, ModalProps, Space } from 'antd';
import { LucideIcon } from 'lucide-react';

interface EnhancedModalProps extends ModalProps {
  icon?: LucideIcon;
  iconColor?: string;
  iconBg?: string;
}

export const EnhancedModal: React.FC<EnhancedModalProps> = ({
  icon: Icon,
  iconColor = 'text-purple-600',
  iconBg = 'bg-purple-50',
  title,
  children,
  ...props
}) => {
  return (
    <Modal
      {...props}
      title={
        Icon ? (
          <Space>
            <div className={`p-2 rounded-lg ${iconBg}`}>
              <Icon size={20} className={iconColor} />
            </div>
            <span>{title}</span>
          </Space>
        ) : (
          title
        )
      }
      className="enhanced-modal"
    >
      {children}
    </Modal>
  );
};
