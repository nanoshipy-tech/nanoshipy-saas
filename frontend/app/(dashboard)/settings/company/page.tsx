'use client';

import React from 'react';
import { CompanyProfileForm } from '@/components/company/CompanyProfileForm';
import { DocumentUploadCard } from '@/components/company/DocumentUploadCard';
import { SettingsNav } from '@/components/settings/SettingsNav';

export default function CompanySettingsPage() {
  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-[#14121F]">Company Profile</h1>
        <p className="mt-1 text-xs text-[#7E7994] dark:text-[#534F66]">
          Manage your business information and KYC verification documents
        </p>
      </div>

      <SettingsNav />
      
      <CompanyProfileForm />
      <DocumentUploadCard />
    </div>
  );
}
