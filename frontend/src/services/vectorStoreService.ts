import api from './api';

export interface VectorStore {
  id: string;
  name: string;
}

export const vectorStoreService = {
  getVectorStores: async (): Promise<VectorStore[]> => {
    const response = await api.get('/vector_stores');
    return response.data.vector_stores;
  },
};
