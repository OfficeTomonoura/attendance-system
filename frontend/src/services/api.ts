import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

api.interceptors.response.use((response) => {
  return response;
}, (error) => {
  if (error.response && (error.response.status === 401 || error.response.status === 403)) {
    // ログイン画面以外で認証エラーが起きた場合はログアウト処理
    if (window.location.pathname !== '/login') {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
  }
  return Promise.reject(error);
});

export default api;
