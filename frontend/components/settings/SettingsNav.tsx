'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function SettingsNav() {
  const pathname = usePathname();

  const tabs = [
    { name: 'Account Profile', href: '/settings/profile' },
    { name: 'Company Profile', href: '/settings/company' },
    { name: 'Pickup Addresses', href: '/settings/addresses' },
    { name: 'Notification Settings', href: '/settings/notifications' },
    { name: 'Manage Label', href: '/settings/label' },
    { name: 'Roles & Permissions', href: '/settings/roles' },
  ];

  return (
    <div className="border-b border-slate-200 dark:border-white/[0.06] mb-6">
      <nav className="-mb-px flex space-x-8 overflow-x-auto" aria-label="Tabs">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href || pathname.startsWith(tab.href + '/');
          return (
            <Link
              key={tab.name}
              href={tab.href}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-all duration-200 ${
                isActive
                  ? 'border-[#8410DC] text-[#8410DC] dark:text-[#D6A8FF]'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-white/[0.1]'
              }`}
            >
              {tab.name}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
