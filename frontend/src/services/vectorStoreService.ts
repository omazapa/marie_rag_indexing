import api from './api';

export interface VectorStore {
  id: string;
  name: string;
}

export interface ConfigSchema {
  type: string;
  properties: Record<string, any>;
  required?: string[];
}

export const vectorStoreService = {
  getVectorStores: async (): Promise<VectorStore[]> => {
    const response = await api.get('/vector_stores');
    return response.data.vector_stores;
  },

  getVectorStoreSchema: async (vsId: string): Promise<ConfigSchema> => {
    const response = await api.get(`/vector_stores/${vsId}/schema`);
    return response.data;
  },
};
