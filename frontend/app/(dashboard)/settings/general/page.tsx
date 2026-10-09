'use client';

import React from 'react';
import {
  Settings, Building2, Bell, Users, Key, Webhook, ChevronRight, Sliders
} from 'lucide-react';
import Link from 'next/link';
import SettingsForm from '@/components/settings/SettingsForm';

const SettingsDirectory = [
  {
    href: '/settings/company',
    icon: Building2,
    label: 'Company Profile',
    desc: 'Business details, GST info, and company documents',
    color: 'text-[#D6A8FF]',
    bg: 'bg-[#8410DC]/10',
  },
  {
    href: '/settings/notifications',
    icon: Bell,
    label: 'Notification Preferences',
    desc: 'Email, SMS, and in-app notification channels',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
  },
  {
    href: '/settings/roles',
    icon: Users,
    label: 'Roles & Permissions',
    desc: 'Manage team access control and user roles',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
  },
  {
    href: '/settings/api-keys',
    icon: Key,
    label: 'API Keys',
    desc: 'Generate and manage developer API credentials',
    color: 'text-violet-400',
    bg: 'bg-violet-500/10',
  },
  {
    href: '/settings/webhooks',
    icon: Webhook,
    label: 'Webhooks',
    desc: 'Configure outbound event notifications',
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
  },
  {
    href: '/settings/activity-log',
    icon: Settings,
    label: 'Activity Log',
    desc: 'Full searchable audit trail of account actions',
    color: 'text-rose-400',
    bg: 'bg-rose-500/10',
  },
];

export default function GeneralSettingsPage() {
  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
            <Sliders className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#14121F]">General Settings</h1>
            <p className="text-sm text-[#534F66] mt-0.5">
              Customize your account preferences. Overrides apply only to your account and take precedence over platform defaults.
            </p>
          </div>
        </div>
      </div>

      {/* Business Preferences Form */}
      <section>
        <h2 className="text-sm font-semibold text-[#534F66] uppercase tracking-wider mb-4">
          Business Preferences
        </h2>
        <SettingsForm />
      </section>

      {/* Settings Directory */}
      <section>
        <h2 className="text-sm font-semibold text-[#534F66] uppercase tracking-wider mb-4">
          Other Settings
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {SettingsDirectory.map(item => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                id={`settings-dir-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                className="group flex items-start gap-4 p-4 bg-white/5 border border-[#E8DEF2] rounded-xl hover:bg-white/8 hover:border-white/20 transition"
              >
                <div className={`w-10 h-10 rounded-xl ${item.bg} flex items-center justify-center shrink-0`}>
                  <Icon className={`w-5 h-5 ${item.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-white">{item.label}</span>
                    <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-[#534F66] transition shrink-0" />
                  </div>
                  <p className="text-xs text-[#7E7994] mt-0.5">{item.desc}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
