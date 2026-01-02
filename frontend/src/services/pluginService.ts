import api from './api';

export interface Plugin {
  id: string;
  name: string;
}

export interface ConfigSchema {
  type: string;
  properties: Record<string, any>;
  required?: string[];
}

export const pluginService = {
  getPlugins: async (): Promise<Plugin[]> => {
    const response = await api.get('/plugins');
    return response.data.plugins;
  },

  getPluginSchema: async (pluginId: string): Promise<ConfigSchema> => {
    const response = await api.get(`/plugins/${pluginId}/schema`);
    return response.data;
  },
};
