'use client';

import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { ConfigProvider, theme, App } from 'antd';
import { BRAND_CONFIG } from '@/core/branding';

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        retry: 1,
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <AntdRegistry>
        <ConfigProvider
          theme={{
            algorithm: BRAND_CONFIG.theme === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
            token: {
              colorPrimary: BRAND_CONFIG.primaryColor,
              borderRadius: BRAND_CONFIG.borderRadius,
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
            },
            components: {
              Layout: {
                headerBg: '#fff',
                siderBg: '#fff',
              },
              Menu: {
                itemBg: '#fff',
                itemSelectedBg: '#f9f0ff',
                itemSelectedColor: BRAND_CONFIG.primaryColor,
              }
            }
          }}
        >
          <App>
            {children}
          </App>
        </ConfigProvider>
      </AntdRegistry>
    </QueryClientProvider>
  );
}
