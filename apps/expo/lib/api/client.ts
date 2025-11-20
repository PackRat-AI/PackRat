import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import { store } from 'expo-app/atoms/store';
import { clientEnvs } from 'expo-app/env/clientEnvs';
import {
  needsReauthAtom,
  refreshTokenAtom,
  tokenAtom,
} from 'expo-app/features/auth/atoms/authAtoms';
import Storage from 'expo-sqlite/kv-store';

// Define base API URL based on environment
export const API_URL = clientEnvs.EXPO_PUBLIC_API_URL;

// Create axios instance with default config
const axiosInstance: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Flag to prevent multiple refresh requests
let isRefreshing = false;
// Queue of failed requests to retry after token refresh
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
  config: AxiosRequestConfig;
}> = [];

// Process the queue of failed requests
const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach((request) => {
    if (error) {
      request.reject(error);
    } else if (token && request.config.headers) {
      request.config.headers.Authorization = `Bearer ${token}`;
      request.resolve(axios(request.config));
    }
  });

  failedQueue = [];
};

// Request interceptor to attach auth token
axiosInstance.interceptors.request.use(
  async (config: InternalAxiosRequestConfig): Promise<InternalAxiosRequestConfig> => {
    try {
      const token = await Storage.getItem('access_token');

      // If token exists, attach it to the request
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      return config;
    } catch (error) {
      console.error('Error attaching auth token:', error);
      return config;
    }
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  },
);

// Response interceptor for error handling
axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & {
      _retry?: boolean;
    };

    // Handle 401 Unauthorized errors
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // If already refreshing, add request to queue
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject, config: originalRequest });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Get refresh token
        // const refreshToken = await store.get(refreshTokenAtom);
        const refreshToken = await Storage.getItem('refresh_token');

        // Call refresh token endpoint
        const response = await axios.post(`${API_URL}/api/auth/refresh`, {
          refreshToken,
        });

        if (response.data.success) {
          // Store new tokens
          await store.set(tokenAtom, response.data.accessToken);
          await store.set(refreshTokenAtom, response.data.refreshToken);

          // Update authorization header
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${response.data.accessToken}`;
          }

          // Process queue with new token
          processQueue(null, response.data.accessToken);

          // Retry original request
          return axios(originalRequest);
        } else {
          // Refresh failed, trigger re-authentication
          store.set(needsReauthAtom, true);
          processQueue(new Error('Token refresh failed'));
          return Promise.reject(error);
        }
      } catch (refreshError) {
        if (axios.isAxiosError(refreshError) && refreshError.response?.status === 401)
          // Refresh failed, trigger re-authentication
          store.set(needsReauthAtom, true);
        processQueue(refreshError as Error);
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

// Helper function to handle API errors
export const handleApiError = (error: unknown): { message: string; status?: number } => {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const message = error.response?.data?.error || error.message;
    return { message, status };
  }

  return {
    message: error instanceof Error ? error.message : 'An unknown error occurred',
  };
};

// Export the configured axios instance as default
export default axiosInstance;
