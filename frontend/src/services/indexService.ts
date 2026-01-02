import api from './api';

export interface IndexInfo {
  name: string;
  documents: number | string;
  size: string;
  status: string;
}

export const indexService = {
  getIndices: async (vectorStore: string = 'opensearch'): Promise<IndexInfo[]> => {
    const response = await api.get('/indices', { params: { vector_store: vectorStore } });
    return response.data.indices;
  },
  deleteIndex: async (indexName: string, vectorStore: string = 'opensearch') => {
    const response = await api.delete(`/indices/${indexName}`, { params: { vector_store: vectorStore } });
    return response.data;
  }
};
