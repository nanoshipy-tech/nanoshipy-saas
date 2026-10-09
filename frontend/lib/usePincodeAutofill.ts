import { useState, useEffect } from 'react';
import { apiClient } from './apiClient';

export interface PincodeLocationData {
  pincode: string;
  district: string;
  state: string;
  city: string;
  is_serviceable: boolean;
  source: 'pincode_master' | 'api' | 'google';
}

export function usePincodeAutofill(pincode: string, enabled: boolean = true) {
  const [locationData, setLocationData] = useState<PincodeLocationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);

  useEffect(() => {
    const cleanPincode = String(pincode || '').trim();

    if (!enabled || !/^\d{6}$/.test(cleanPincode)) {
      setLocationData(null);
      setError(null);
      setIsVerified(false);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    apiClient.get(`/location/pincode/${cleanPincode}`)
      .then(({ data }) => {
        if (isMounted && data.success && data.data) {
          setLocationData(data.data);
          setIsVerified(true);
          setError(null);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setLocationData(null);
          setIsVerified(false);
          setError(err.response?.data?.error?.message || 'Pincode not found in master database.');
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [pincode, enabled]);

  return { locationData, loading, error, isVerified };
}
