import axios, { AxiosError } from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 seconds
});

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response) {
      // Server responded with error status
      const status = error.response.status;
      const data = error.response.data as { error?: string; message?: string };

      switch (status) {
        case 401:
          // Unauthorized - clear token and redirect to login
          if (typeof window !== 'undefined') {
            localStorage.removeItem('auth_token');
            // window.location.href = '/login';
          }
          break;
        case 403:
          console.error('Access forbidden:', data.error || data.message);
          break;
        case 404:
          console.error('Resource not found');
          break;
        case 500:
          console.error('Server error:', data.error || data.message);
          break;
        default:
          console.error('API error:', data.error || data.message);
      }

      // Return a standardized error
      return Promise.reject(
        new Error(data.error || data.message || `Request failed with status ${status}`)
      );
    } else if (error.request) {
      // Request was made but no response received
      console.error('Network error - no response received');
      return Promise.reject(
        new Error('Network error. Please check your connection and try again.')
      );
    } else {
      // Something else happened
      console.error('Request error:', error.message);
      return Promise.reject(error);
    }
  }
);

// Legacy default export for backwards compatibility
export default apiClient;
