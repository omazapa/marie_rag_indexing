import { apiClientWithRetry } from './api';

export interface DashboardStats {
  total_documents: number;
  active_sources: number;
  last_ingestion: string;
  recent_jobs: Array<{
    id: string;
    source: string;
    status: 'completed' | 'failed' | 'running';
    time: string;
  }>;
}

export const statsService = {
  getStats: async (): Promise<DashboardStats> => {
    return await apiClientWithRetry.get<DashboardStats>('/stats');
  },
};
