import api from './api';

export interface ConnectorSuggestion {
  plugin_id: string;
  config: Record<string, any>;
  explanation: string;
}

export const assistantService = {
  suggestConnector: async (prompt: string): Promise<ConnectorSuggestion> => {
    const response = await api.post('/assistant/connector', { prompt });
    return response.data;
  }
};
