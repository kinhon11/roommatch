import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Request Interceptor: tự động đính kèm token vào mọi request
apiClient.interceptors.request.use(
  (config) => {
    const session = JSON.parse(localStorage.getItem('roommie-session') || '{}');
    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: xử lý lỗi 401 (session hết hạn)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('roommie-session');
      localStorage.removeItem('roommie-user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;
