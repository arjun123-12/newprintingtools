import axios, {
  AxiosHeaders,
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  'http://127.0.0.1:8000/api/v1';

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    Accept: 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
  withCredentials: true,
});

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (!(config.headers instanceof AxiosHeaders)) {
      config.headers = new AxiosHeaders(config.headers);
    }

    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('auth_token');

      if (token) {
        config.headers.set('Authorization', `Bearer ${token}`);
      }
    }

    const isFormData =
      typeof FormData !== 'undefined' &&
      config.data instanceof FormData;

    if (isFormData) {
      // Important: never leave application/json on a FormData request.
      // The browser must generate multipart/form-data with its boundary.
      config.headers.delete('Content-Type');
    } else if (config.data !== undefined && config.data !== null) {
      // JSON content type is only for normal object/string requests.
      config.headers.set('Content-Type', 'application/json');
    }

    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error) => {
    if (
      error.response?.status === 401 &&
      typeof window !== 'undefined'
    ) {
      localStorage.removeItem('auth_token');
    }

    return Promise.reject(error);
  }
);

export default apiClient;
