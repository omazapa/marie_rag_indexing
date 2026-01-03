import api from './api';

export interface MongoDatabasesResponse {
  databases: string[];
}

export interface MongoCollectionsResponse {
  collections: string[];
}

export interface MongoSchemaResponse {
  schema: string[];
  sample?: string;
}

export const mongodbService = {
  getDatabases: async (connectionString: string): Promise<MongoDatabasesResponse> => {
    const response = await api.post<MongoDatabasesResponse>('/plugins/mongodb/databases', {
      connection_string: connectionString
    });
    return response.data;
  },

  getCollections: async (connectionString: string, database: string): Promise<MongoCollectionsResponse> => {
    const response = await api.post<MongoCollectionsResponse>('/plugins/mongodb/collections', {
      connection_string: connectionString,
      database
    });
    return response.data;
  },

  getSchema: async (connectionString: string, database: string, collection: string): Promise<MongoSchemaResponse> => {
    const response = await api.get<MongoSchemaResponse>('/mongodb/schema', {
      params: { connection_string: connectionString, database, collection }
    });
    return response.data;
  }
};
