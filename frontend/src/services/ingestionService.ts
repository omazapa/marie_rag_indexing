import api from './api';

export interface IngestionRequest {
  plugin_id: string;
  config: Record<string, any>;
  chunk_settings: {
    method: string;
    chunk_size: number;
    chunk_overlap: number;
  };
  index_name: string;
}

export const ingestionService = {
  triggerIngestion: async (data: IngestionRequest) => {
    const response = await api.post('/ingest', data);
    return response.data;
  },
};
