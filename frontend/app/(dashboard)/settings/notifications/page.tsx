'use client';

import React from 'react';
import { NotificationPreferencesForm } from '@/components/notifications/NotificationPreferencesForm';
import { SettingsNav } from '@/components/settings/SettingsNav';
import { ShieldCheck } from 'lucide-react';

export default function NotificationSettingsPage() {
  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-[#14121F]">
          Notification Settings
        </h1>
        <p className="text-xs text-[#7E7994] dark:text-[#534F66] mt-1 font-normal">
          Configure notification preferences across Email, SMS, and WhatsApp channels
        </p>
      </div>

      <SettingsNav />

      <div className="space-y-6">
        <div className="flex items-center gap-2 p-3 rounded-xl bg-purple-50 dark:bg-[#8410DC]/10 border border-purple-200 dark:border-[#8410DC]/20 max-w-xl">
          <ShieldCheck className="w-4 h-4 text-[#8410DC] dark:text-[#D6A8FF] flex-shrink-0" />
          <span className="text-[10px] text-[#4D0582] dark:text-purple-300 font-medium">
            All preferences are processed instantly and secured with tenant row-level parameters.
          </span>
        </div>

        <NotificationPreferencesForm />
      </div>
    </div>
  );
}
