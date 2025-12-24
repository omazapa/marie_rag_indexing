import api from './api';

export interface DataSource {
  id: string;
  name: string;
  type: string;
  status: 'active' | 'inactive' | 'error';
  lastRun: string;
  config: Record<string, any>;
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
};
