'use client';

import React, { useState, useEffect } from 'react';
import { usePincodeAutofill, PincodeLocationData } from '../../lib/usePincodeAutofill';
import { MapPin, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

interface AddressAutocompleteInputProps {
  pincodeValue: string;
  onPincodeChange: (value: string) => void;
  onLocationAutofill: (data: { city: string; state: string; district?: string; addressSource: string; isVerified: boolean }) => void;
  googleApiKey?: string;
  googleEnabled?: boolean;
  autofillEnabled?: boolean;
  disabled?: boolean;
}

export const AddressAutocompleteInput: React.FC<AddressAutocompleteInputProps> = ({
  pincodeValue,
  onPincodeChange,
  onLocationAutofill,
  googleApiKey,
  googleEnabled = false,
  autofillEnabled = true,
  disabled = false,
}) => {
  const { locationData, loading, error, isVerified } = usePincodeAutofill(pincodeValue, autofillEnabled);

  useEffect(() => {
    if (locationData && isVerified) {
      onLocationAutofill({
        city: locationData.city || locationData.district,
        state: locationData.state,
        district: locationData.district,
        addressSource: 'pincode_lookup',
        isVerified: true,
      });
    }
  }, [locationData, isVerified]);

  const safePincodeStr = String(pincodeValue || '');

  return (
    <div className="space-y-2">
      <div className="relative">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          Pincode
        </label>
        <div className="relative">
          <input
            type="text"
            maxLength={6}
            disabled={disabled}
            value={safePincodeStr}
            onChange={(e) => onPincodeChange(e.target.value.replace(/\D/g, ''))}
            placeholder="Enter 6-digit pincode"
            className="w-full rounded-md border border-slate-300 dark:border-white/[0.08] bg-white dark:bg-[#0f1117] text-slate-900 dark:text-white px-3 py-2 pr-10 text-sm outline-none focus:border-[#8410DC] focus:ring-1 focus:ring-purple-500"
          />
          <div className="absolute right-3 top-2.5 flex items-center">
            {loading && <Loader2 className="w-4 h-4 animate-spin text-[#8410DC]" />}
            {!loading && isVerified && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
            {!loading && error && <AlertTriangle className="w-4 h-4 text-amber-500" />}
          </div>
        </div>
      </div>

      {/* Inline Location Feedback Badge */}
      {locationData && isVerified && (
        <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-md text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
          <span>
            Auto-filled: <strong className="font-semibold">{locationData.city || locationData.district}, {locationData.state}</strong>
          </span>
        </div>
      )}

      {/* Warning Fallback */}
      {error && safePincodeStr.length === 6 && (
        <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-md text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{error} Please fill City and State manually.</span>
        </div>
      )}
    </div>
  );
};
