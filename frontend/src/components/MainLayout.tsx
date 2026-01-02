'use client';

import React from 'react';
import { Layout, Menu, theme } from 'antd';
import {
  LayoutDashboard,
  Database,
  Settings,
  Activity,
  FileText,
  Cpu,
  Menu as MenuIcon
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { BRAND_CONFIG } from '@/core/branding';

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
    key: 'models',
    icon: <Cpu size={18} />,
    label: <Link href="/models">Embedding Models</Link>,
  },
  {
    key: 'vector-stores',
    icon: <Database size={18} />,
    label: <Link href="/vector-stores">Vector Stores</Link>,
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
      <Sider
        breakpoint="lg"
        collapsedWidth="0"
        theme="light"
        className="border-r border-gray-100"
        width={260}
      >
        <div className="p-6 flex items-center gap-3">
          <Image
            src={BRAND_CONFIG.logoIcon}
            alt="Logo"
            width={32}
            height={32}
            className="rounded-lg"
          />
          <span className="font-bold text-lg tracking-tight text-gray-800">
            {BRAND_CONFIG.name.split(' ')[0]} <span style={{ color: BRAND_CONFIG.primaryColor }}>{BRAND_CONFIG.name.split(' ').slice(1).join(' ')}</span>
          </span>
        </div>
        <Menu
          mode="inline"
          defaultSelectedKeys={['dashboard']}
          items={items}
          className="border-none"
        />
      </Sider>
      <Layout>
        <Header style={{ padding: '0 24px', background: colorBgContainer, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }} className="border-b border-gray-100">
          <div className="flex items-center gap-2 text-gray-500">
            <MenuIcon size={20} />
            <span className="text-sm font-medium">Workspace / Default</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold text-xs">
              OZ
            </div>
          </div>
        </Header>
        <Content style={{ margin: '24px 24px 0' }}>
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
