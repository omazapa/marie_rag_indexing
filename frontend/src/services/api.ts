import axios, { AxiosError, AxiosRequestConfig } from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 seconds
});

// Helper function to implement retry logic with exponential backoff
const axiosRetry = async <T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000,
  shouldRetry?: (error: unknown) => boolean
): Promise<T> => {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Check if we should retry
      const isNetworkError = !error.response && error.request;
      const isServerError = error.response && error.response.status >= 500;
      const customCheck = shouldRetry ? shouldRetry(error) : true;

      const shouldAttemptRetry = (isNetworkError || isServerError) && customCheck && attempt < maxRetries;

      if (shouldAttemptRetry) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        break;
      }
    }
  }

  throw lastError;
};

// Wrapper for apiClient requests with retry logic
export const apiClientWithRetry = {
  get: <T = any>(url: string, config?: AxiosRequestConfig) =>
    axiosRetry(() => apiClient.get<T>(url, config).then(res => res.data)),

  post: <T = any>(url: string, data?: any, config?: AxiosRequestConfig) =>
    axiosRetry(() => apiClient.post<T>(url, data, config).then(res => res.data)),

  put: <T = any>(url: string, data?: any, config?: AxiosRequestConfig) =>
    axiosRetry(() => apiClient.put<T>(url, data, config).then(res => res.data)),

  delete: <T = any>(url: string, config?: AxiosRequestConfig) =>
    axiosRetry(() => apiClient.delete<T>(url, config).then(res => res.data)),

  patch: <T = any>(url: string, data?: any, config?: AxiosRequestConfig) =>
    axiosRetry(() => apiClient.patch<T>(url, data, config).then(res => res.data)),
};

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
