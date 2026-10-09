const resolveApiUrl = (): string => {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host.includes('nanoshipy.com')) {
      return 'https://api.nanoshipy.com/api/v1';
    }
  }
  const raw = process.env.NEXT_PUBLIC_API_URL || 'https://api.nanoshipy.com/api/v1';
  if (raw.includes('localhost') && typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
    return 'https://api.nanoshipy.com/api/v1';
  }
  return raw.endsWith('/api/v1') ? raw : `${raw.replace(/\/$/, '')}/api/v1`;
};

export const API_URL = resolveApiUrl();
