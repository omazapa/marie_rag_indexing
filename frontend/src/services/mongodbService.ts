import api from './api';

export interface MongoDatabasesResponse {
  databases: string[];
}

export interface MongoCollectionsResponse {
  collections: string[];
}

export interface SchemaFieldInfo {
  type: string;
  types: string[];
  presence: number;
  count: number;
  isNested: boolean;
  isArray: boolean;
  arrayElementType?: string;
}

export interface MongoSchemaResponse {
  schema: Record<string, SchemaFieldInfo>;
  totalDocuments: number;
  sampledDocuments: number;
  sampleDocument?: Record<string, unknown>;
  message?: string;
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
