import api from './api';

export interface IngestionRequest {
  plugin_id: string;
  config: Record<string, unknown>;
  chunk_settings: {
    strategy: string;
    chunk_size: number;
    chunk_overlap: number;
    separators?: string[];
    encoding_name?: string;
  };
  vector_store: string;
  vector_store_config: Record<string, unknown>;
  index_name: string;
  embedding_model: string;
  embedding_provider: string;
  embedding_config: Record<string, unknown>;
  execution_mode: 'sequential' | 'parallel';
  max_workers: number;
}

export const ingestionService = {
  triggerIngestion: async (data: IngestionRequest) => {
    const response = await api.post('/ingest', data);
    return response.data;
  },
};
