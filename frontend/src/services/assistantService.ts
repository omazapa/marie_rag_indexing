import { apiClientWithRetry } from './api';

export interface ConnectorSuggestion {
  plugin_id: string;
  config: Record<string, unknown>;
  explanation: string;
}

export const assistantService = {
  suggestConnector: async (prompt: string): Promise<ConnectorSuggestion> => {
    const response = await apiClientWithRetry.post('/assistant/connector', { prompt });
    return response.data;
  }
};
