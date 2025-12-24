import api from './api';

export interface Plugin {
  id: string;
  name: string;
}

export const pluginService = {
  getPlugins: async (): Promise<Plugin[]> => {
    const response = await api.get('/plugins');
    return response.data.plugins;
  },
};
