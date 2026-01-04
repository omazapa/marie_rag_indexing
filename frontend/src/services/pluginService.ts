import { apiClientWithRetry } from './api';

export interface Plugin {
  id: string;
  name: string;
}

export interface ConfigSchema {
  type: string;
  properties: Record<string, {
    type: string;
    title?: string;
    description?: string;
    default?: unknown;
    [key: string]: unknown;
  }>;
  required?: string[];
}

export const pluginService = {
  getPlugins: async (): Promise<Plugin[]> => {
    const data = await apiClientWithRetry.get<{ plugins: Plugin[] }>('/plugins');
    return data.plugins;
  },

  getPluginSchema: async (pluginId: string): Promise<ConfigSchema> => {
    return await apiClientWithRetry.get<ConfigSchema>(`/plugins/${pluginId}/schema`);
  },
};
