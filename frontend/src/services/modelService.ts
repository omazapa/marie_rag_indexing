import api from './api';

export interface EmbeddingModel {
  id: string;
  name: string;
  provider: 'huggingface' | 'ollama';
  model: string;
  status: string;
  config: Record<string, unknown>;
}

export const modelService = {
  getModels: async () => {
    const response = await api.get('/models');
    return response.data.models as EmbeddingModel[];
  },
  addModel: async (model: Partial<EmbeddingModel>) => {
    const response = await api.post('/models', model);
    return response.data;
  },
  deleteModel: async (id: string) => {
    const response = await api.delete(`/models/${id}`);
    return response.data;
  },
  searchModels: async (provider: string, query: string) => {
    const response = await api.get('/models/search', { params: { provider, query } });
    return response.data.results;
  }
};
