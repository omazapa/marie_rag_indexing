import { apiClient } from './api';

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
    const response = await apiClient.get('/plugins');
    return response.data.plugins;
  },

  getPluginSchema: async (pluginId: string): Promise<ConfigSchema> => {
    const response = await apiClient.get(`/plugins/${pluginId}/schema`);
    return response.data;
  },
};
