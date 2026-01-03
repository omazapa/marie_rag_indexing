import React from 'react';
import { Steps, Card, Space, Typography } from 'antd';
import { CheckCircle2, Circle, Loader } from 'lucide-react';

const { Text } = Typography;

interface StepItem {
  title: string;
  description?: string;
  icon?: React.ReactNode;
}

interface ProgressStepsProps {
  current: number;
  steps: StepItem[];
  status?: 'wait' | 'process' | 'finish' | 'error';
}

export const ProgressSteps: React.FC<ProgressStepsProps> = ({
  current,
  steps,
  status = 'process',
}) => {
  return (
    <Steps
      current={current}
      status={status}
      items={steps.map((step, index) => ({
        title: step.title,
        description: step.description,
        icon:
          index < current ? (
            <CheckCircle2 size={20} className="text-green-500" />
          ) : index === current ? (
            <Loader size={20} className="text-purple-600 animate-spin" />
          ) : (
            <Circle size={20} className="text-gray-300" />
          ),
      }))}
    />
  );
};

interface ProcessVisualizerProps {
  title: string;
  steps: StepItem[];
  currentStep: number;
  status?: 'wait' | 'process' | 'finish' | 'error';
  extra?: React.ReactNode;
}

export const ProcessVisualizer: React.FC<ProcessVisualizerProps> = ({
  title,
  steps,
  currentStep,
  status = 'process',
  extra,
}) => {
  return (
    <Card
      title={title}
      extra={extra}
      variant="borderless"
      className="shadow-sm"
    >
      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        <ProgressSteps current={currentStep} steps={steps} status={status} />
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <Text strong className="block mb-2">
            {steps[currentStep]?.title}
          </Text>
          <Text type="secondary" className="text-sm">
            {steps[currentStep]?.description}
          </Text>
        </div>
      </Space>
    </Card>
  );
};
