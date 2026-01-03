import { apiClient } from './api';

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
    const response = await apiClient.get('/sources');
    return response.data.sources;
  },
  addSource: async (source: Partial<DataSource>): Promise<DataSource> => {
    const response = await apiClient.post('/sources', source);
    return response.data;
  },
  updateSource: async (id: string, data: Partial<DataSource>): Promise<DataSource> => {
    const response = await apiClient.put(`/sources/${id}`, data);
    return response.data;
  },
  deleteSource: async (id: string): Promise<void> => {
    await apiClient.delete(`/sources/${id}`);
  },
  testConnection: async (type: string, config: Record<string, unknown>): Promise<{ success: boolean; error?: string }> => {
    const response = await apiClient.post('/sources/test-connection', { type, config });
    return response.data;
  },
};
