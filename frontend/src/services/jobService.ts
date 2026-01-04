import { apiClientWithRetry } from './api';

export interface IngestionJob {
  id: string;
  status: 'running' | 'completed' | 'failed';
  plugin_id: string;
  index_name: string;
  vector_store: string;
  started_at: string;
  completed_at: string | null;
  documents_processed: number;
  chunks_created: number;
  error: string | null;
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
    return response.data;
  },
};
