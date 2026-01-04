import { apiClientWithRetry } from './api';

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
    const data = await apiClientWithRetry.get<{ sources: DataSource[] }>('/sources');
    return data.sources;
  },
  addSource: async (source: Partial<DataSource>): Promise<DataSource> => {
    return await apiClientWithRetry.post('/sources', source);
  },
  updateSource: async (id: string, data: Partial<DataSource>): Promise<DataSource> => {
    return await apiClientWithRetry.put(`/sources/${id}`, data);
  },
  deleteSource: async (id: string): Promise<void> => {
    await apiClientWithRetry.delete(`/sources/${id}`);
  },
  testConnection: async (type: string, config: Record<string, unknown>): Promise<{ success: boolean; error?: string }> => {
    return await apiClientWithRetry.post('/sources/test-connection', { type, config });
  },
};
