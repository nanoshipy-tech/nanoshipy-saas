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

// Module-level in-memory token storage with localStorage & sessionStorage session fallback
let inMemoryAccessToken: string | null = null;

export const setAccessToken = (token: string | null) => {
  inMemoryAccessToken = token;
  if (token) {
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('seller_access_token', token);
        sessionStorage.setItem('seller_access_token', token);
      } catch (e) {}
    }
  } else {
    delete apiClient.defaults.headers.common['Authorization'];
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('seller_access_token');
        sessionStorage.removeItem('seller_access_token');
      } catch (e) {}
    }
  }
};

export const getAccessToken = (): string | null => {
  if (inMemoryAccessToken) return inMemoryAccessToken;
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('seller_access_token') || sessionStorage.getItem('seller_access_token');
      if (stored) {
        inMemoryAccessToken = stored;
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${stored}`;
        return stored;
      }
    } catch (e) {}
  }
  return null;
};

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();
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

let refreshPromise: Promise<string | null> | null = null;

export const refreshAuthSession = async (explicitRefreshToken?: string | null): Promise<string | null> => {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const rToken = explicitRefreshToken || (typeof window !== 'undefined' ? localStorage.getItem('seller_refresh_token') : null);

      if (typeof window !== 'undefined') {
        const path = window.location.pathname;
        const isAuthPage = path.startsWith('/login') || path.startsWith('/register') || path.startsWith('/forgot-password') || path.startsWith('/reset-password');
        if (isAuthPage && !rToken) {
          return null;
        }
      }

      const reqBody: Record<string, any> = {};
      if (rToken) {
        reqBody.refresh_token = rToken;
      }

      // Browser automatically sends httpOnly refresh_token cookie with withCredentials: true,
      // and passes refresh_token body as reliable cross-domain fallback
      const { data } = await axios.post(
        `${baseURL}/auth/refresh`,
        reqBody,
        { withCredentials: true, headers: { 'Content-Type': 'application/json' } }
      );

      const token = data?.data?.access_token;
      const newRefreshToken = data?.data?.refresh_token;

      if (token) {
        setAccessToken(token);
        if (newRefreshToken && typeof window !== 'undefined') {
          try { localStorage.setItem('seller_refresh_token', newRefreshToken); } catch (e) {}
        }
        return token;
      }
      return null;
    } catch (err) {
      // Do not hard-redirect here; let callers handle unauthenticated states gracefully
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/login') &&
      !originalRequest.url?.includes('/auth/refresh')
    ) {
      originalRequest._retry = true;

      const token = await refreshAuthSession();
      if (token) {
        originalRequest.headers['Authorization'] = 'Bearer ' + token;
        return apiClient(originalRequest);
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
