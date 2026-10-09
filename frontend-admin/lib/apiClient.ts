import axios from 'axios';

const getBaseUrl = () => {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host.includes('nanoshipy.com')) {
      return 'https://api.nanoshipy.com/api/v1';
    }
  }
  const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.nanoshipy.com/api/v1';
  return rawApiUrl.endsWith('/api/v1') ? rawApiUrl : `${rawApiUrl.replace(/\/$/, '')}/api/v1`;
};

const baseURL = getBaseUrl();

export const apiClient = axios.create({
  baseURL,
  withCredentials: true,
});

// Module-level in-memory platform access token storage with sessionStorage session fallback
let inMemoryPlatformToken: string | null = null;

export const setPlatformAccessToken = (token: string | null) => {
  inMemoryPlatformToken = token;
  if (token) {
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    if (typeof window !== 'undefined') {
      try { sessionStorage.setItem('platform_access_token', token); } catch (e) {}
    }
  } else {
    delete apiClient.defaults.headers.common['Authorization'];
    if (typeof window !== 'undefined') {
      try { sessionStorage.removeItem('platform_access_token'); } catch (e) {}
    }
  }
};

export const getPlatformAccessToken = (): string | null => {
  if (inMemoryPlatformToken) return inMemoryPlatformToken;
  if (typeof window !== 'undefined') {
    try {
      const stored = sessionStorage.getItem('platform_access_token');
      if (stored) {
        inMemoryPlatformToken = stored;
        return stored;
      }
    } catch (e) {}
  }
  return null;
};

apiClient.interceptors.request.use((config) => {
  const token = getPlatformAccessToken();
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    if (config.headers) {
      if (typeof (config.headers as any).delete === 'function') {
        (config.headers as any).delete('Content-Type');
        (config.headers as any).delete('content-type');
      }
      delete (config.headers as any)['Content-Type'];
      delete (config.headers as any)['content-type'];
    }
  }
  return config;
});

let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

export const refreshPlatformAuthSession = async (): Promise<string | null> => {
  try {
    // Browser automatically sends httpOnly platform_refresh_token cookie with withCredentials: true
    const { data } = await apiClient.post('/platform/auth/refresh', {});
    const token = data?.data?.access_token;

    if (token) {
      setPlatformAccessToken(token);
      return token;
    }
    return null;
  } catch (err) {
    setPlatformAccessToken(null);
    return null;
  }
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      originalRequest.url !== '/platform/auth/login' &&
      originalRequest.url !== '/platform/auth/refresh'
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers['Authorization'] = 'Bearer ' + token;
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const token = await refreshPlatformAuthSession();

        if (token) {
          originalRequest.headers['Authorization'] = 'Bearer ' + token;
          processQueue(null, token);
          return apiClient(originalRequest);
        } else {
          throw new Error('No access token returned from refresh');
        }
      } catch (err) {
        processQueue(err, null);
        if (typeof window !== 'undefined') {
          const currentPath = window.location.pathname;
          if (!currentPath.startsWith('/login')) {
            window.location.href = `/login?next=${encodeURIComponent(currentPath)}`;
          }
        }
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
