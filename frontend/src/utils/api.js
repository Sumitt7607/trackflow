import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
});

// Attach JWT token to all requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('trackflow_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Handle 401 globally - clear token and redirect to login
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Handle 401 Unauthorized error and check if we are already retrying
    if (error.response?.status === 401 && !originalRequest._retry) {
      
      // If we are already refreshing, push this request to the queue
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem('trackflow_refresh');

      if (!refreshToken) {
        // No refresh token found, clear auth and force login
        localStorage.removeItem('trackflow_token');
        localStorage.removeItem('trackflow_refresh');
        localStorage.removeItem('trackflow_user');
        window.location.href = '/login';
        return Promise.reject(error);
      }

      try {
        // Direct call to axios.post to prevent infinite interceptor loops
        const { data } = await axios.post('/api/auth/refresh', { refreshToken });

        if (data.success) {
          localStorage.setItem('trackflow_token', data.token);
          localStorage.setItem('trackflow_refresh', data.refreshToken);

          api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
          originalRequest.headers.Authorization = `Bearer ${data.token}`;

          processQueue(null, data.token);
          isRefreshing = false;

          return api(originalRequest);
        }
      } catch (refreshError) {
        processQueue(refreshError, null);
        isRefreshing = false;

        // Session expired completely, clear tokens and redirect
        localStorage.removeItem('trackflow_token');
        localStorage.removeItem('trackflow_refresh');
        localStorage.removeItem('trackflow_user');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
