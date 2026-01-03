import api from './api';

export interface DataSource {
  id: string;
  name: string;
  type: string;
  status: 'active' | 'inactive' | 'error';
  lastRun: string;
  config: Record<string, unknown>;
}

export const sourceService = {
  getSources: async (): Promise<DataSource[]> => {
    const response = await api.get('/sources');
    return response.data.sources;
  },
  addSource: async (source: Partial<DataSource>): Promise<DataSource> => {
    const response = await api.post('/sources', source);
    return response.data;
  },
  testConnection: async (type: string, config: Record<string, unknown>): Promise<{ success: boolean; error?: string }> => {
    const response = await api.post('/sources/test-connection', { type, config });
    return response.data;
  },
};
