'use client';

import React from 'react';
import PlatformSettingsForm from '@/components/settings/PlatformSettingsForm';

export default function PlatformGeneralSettingsPage() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold text-[#14121F]">Platform Settings & Defaults</h1>
        <p className="text-xs text-[#534F66] mt-0.5">Global configuration, platform maintenance mode, and default tenant options</p>
      </div>

      <PlatformSettingsForm />
    </div>
  );
}
