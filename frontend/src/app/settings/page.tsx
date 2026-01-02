'use client';

import React from 'react';
import { 
  Card, 
  Typography, 
  Form, 
  Input, 
  Button, 
  ColorPicker, 
  Space, 
  Divider, 
  App,
  Breadcrumb,
  Switch
} from 'antd';
import { Settings as SettingsIcon, Palette, Globe, Shield } from 'lucide-react';
import { BRAND_CONFIG } from '@/core/branding';
import Link from 'next/link';

const { Title, Text } = Typography;

export default function SettingsPage() {
  const { message } = App.useApp();
  const [form] = Form.useForm();

  const onFinish = (values: any) => {
    console.log('Settings saved:', values);
    message.success('Settings saved successfully (Simulated)');
  };

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { title: <Link href="/">Dashboard</Link> },
          { title: 'Settings' },
        ]}
      />
      
      <div>
        <Title level={2}>Settings</Title>
        <Text type="secondary">Configure your workspace and white-labeling options.</Text>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card 
            title={<Space><Palette size={18} /><span>Branding & White Label</span></Space>}
            variant="borderless"
            className="shadow-sm"
          >
            <Form
              form={form}
              layout="vertical"
              initialValues={{
                name: BRAND_CONFIG.name,
                company: BRAND_CONFIG.companyName,
                primaryColor: BRAND_CONFIG.primaryColor,
                borderRadius: BRAND_CONFIG.borderRadius,
              }}
              onFinish={onFinish}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Form.Item name="name" label="Application Name">
                  <Input />
                </Form.Item>
                <Form.Item name="company" label="Company Name">
                  <Input />
                </Form.Item>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Form.Item name="primaryColor" label="Primary Color">
                  <ColorPicker showText />
                </Form.Item>
                <Form.Item name="borderRadius" label="Border Radius (px)">
                  <Input type="number" />
                </Form.Item>
              </div>

              <Divider />

              <Form.Item label="Logo URL">
                <Input defaultValue={BRAND_CONFIG.logo} />
              </Form.Item>

              <Form.Item label="Icon URL">
                <Input defaultValue={BRAND_CONFIG.logoIcon} />
              </Form.Item>

              <Button type="primary" htmlType="submit">
                Save Branding
              </Button>
            </Form>
          </Card>

          <Card 
            title={<Space><Globe size={18} /><span>General Settings</span></Space>}
            variant="borderless"
            className="shadow-sm"
          >
            <Form layout="vertical">
              <Form.Item label="Default Language">
                <Input defaultValue="English" disabled />
              </Form.Item>
              <Form.Item label="Timezone">
                <Input defaultValue="UTC-5 (Bogota)" disabled />
              </Form.Item>
            </Form>
          </Card>
        </div>

        <div className="space-y-6">
          <Card 
            title={<Space><Shield size={18} /><span>Security</span></Space>}
            variant="borderless"
            className="shadow-sm"
          >
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Text>Enable RBAC</Text>
                <Switch defaultChecked />
              </div>
              <div className="flex justify-between items-center">
                <Text>Audit Logs</Text>
                <Switch defaultChecked />
              </div>
              <Divider />
              <Button block>Manage API Keys</Button>
            </div>
          </Card>

          <Card variant="borderless" className="shadow-sm bg-purple-50">
            <Title level={5} style={{ color: BRAND_CONFIG.primaryColor }}>Pro Tip</Title>
            <Text size="small">
              You can customize the entire look and feel of the platform to match your corporate identity. 
              Changes here will reflect across all user interfaces.
            </Text>
          </Card>
        </div>
      </div>
    </div>
  );
}
