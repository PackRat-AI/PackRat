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

/**
 * Web version of the API client.
 * Uses localStorage for token persistence instead of expo-sqlite/kv-store.
 * Metro automatically picks this file over client.ts for web builds.
 */

export const API_URL = clientEnvs.EXPO_PUBLIC_API_URL;

const axiosInstance: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
  config: AxiosRequestConfig;
}> = [];

const processQueue = (error: Error | null, token: string | null = null) => {
  for (const request of failedQueue) {
    if (error) {
      request.reject(error);
    } else if (token && request.config.headers) {
      request.config.headers.Authorization = `Bearer ${token}`;
      request.resolve(axios(request.config));
    }
  }
  failedQueue = [];
};

axiosInstance.interceptors.request.use(
  async (config: InternalAxiosRequestConfig): Promise<InternalAxiosRequestConfig> => {
    try {
      const token = localStorage.getItem('access_token');
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    } catch (error) {
      console.error('Error attaching auth token:', error);
      return config;
    }
  },
  (error: AxiosError) => Promise.reject(error),
);

axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject, config: originalRequest });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = localStorage.getItem('refresh_token');

        const response = await axios.post(`${API_URL}/api/auth/refresh`, { refreshToken });

        if (response.data.success) {
          await store.set(tokenAtom, response.data.accessToken);
          await store.set(refreshTokenAtom, response.data.refreshToken);

          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${response.data.accessToken}`;
          }

          processQueue(null, response.data.accessToken);
          return axios(originalRequest);
        } else {
          store.set(needsReauthAtom, true);
          processQueue(new Error('Token refresh failed'));
          return Promise.reject(error);
        }
      } catch (refreshError) {
        if (axios.isAxiosError(refreshError) && refreshError.response?.status === 401) {
          store.set(needsReauthAtom, true);
        }
        processQueue(refreshError as Error);
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

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

export default axiosInstance;
