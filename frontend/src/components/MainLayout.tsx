'use client';

import React from 'react';
import { Layout, Menu, theme } from 'antd';
import { 
  LayoutDashboard, 
  Database, 
  Settings, 
  Activity,
  FileText
} from 'lucide-react';
import Link from 'next/link';

const { Header, Content, Sider } = Layout;

const items = [
  {
    key: 'dashboard',
    icon: <LayoutDashboard size={18} />,
    label: <Link href="/">Dashboard</Link>,
  },
  {
    key: 'sources',
    icon: <Database size={18} />,
    label: <Link href="/sources">Data Sources</Link>,
  },
  {
    key: 'indices',
    icon: <FileText size={18} />,
    label: <Link href="/indices">Indices</Link>,
  },
  {
    key: 'jobs',
    icon: <Activity size={18} />,
    label: <Link href="/jobs">Ingestion Jobs</Link>,
  },
  {
    key: 'settings',
    icon: <Settings size={18} />,
    label: <Link href="/settings">Settings</Link>,
  },
];

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider breakpoint="lg" collapsedWidth="0">
        <div className="p-4 text-white font-bold text-xl flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">M</div>
          Marie RAG Indexing
        </div>
        <Menu theme="dark" mode="inline" defaultSelectedKeys={['dashboard']} items={items} />
      </Sider>
      <Layout>
        <Header style={{ padding: 0, background: colorBgContainer }} />
        <Content style={{ margin: '24px 16px 0' }}>
          <div
            style={{
              padding: 24,
              minHeight: 360,
              background: colorBgContainer,
              borderRadius: borderRadiusLG,
            }}
          >
            {children}
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}
