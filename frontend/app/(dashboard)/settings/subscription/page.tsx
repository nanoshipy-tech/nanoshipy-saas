'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function TenantSubscriptionRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/settings');
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-8">
      <div className="w-8 h-8 border-3 border-[#8410DC] border-t-transparent rounded-full animate-spin mb-4" />
      <p className="text-sm font-bold text-slate-700">Redirecting to Settings...</p>
    </div>
  );
}
