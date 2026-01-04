import { apiClientWithRetry } from './api';

export interface IngestionJob {
  id: string;
  status: 'running' | 'completed' | 'failed';
  data_source_id: string;
  vector_store_id: string;
  index_name: string;
  vector_store: string;
  started_at: string;
  last_update?: string;
  completed_at: string | null;
  documents_processed: number;
  total_documents?: number;
  chunks_created: number;
  avg_docs_per_second?: number;
  avg_chunks_per_second?: number;
  error: string | null;
  config?: {
    execution_mode?: string;
    max_workers?: number;
  };
}

export interface JobsResponse {
  jobs: IngestionJob[];
}

export const jobService = {
  getJobs: async (): Promise<IngestionJob[]> => {
    const response = await apiClientWithRetry.get<JobsResponse>('/jobs');
    return response.jobs;
  },

  getJob: async (jobId: string): Promise<IngestionJob> => {
    const response = await apiClientWithRetry.get<IngestionJob>(`/jobs/${jobId}`);
    return response;
  },
};
