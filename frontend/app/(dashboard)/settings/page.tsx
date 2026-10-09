'use client';
import React from 'react';
import Link from 'next/link';
import { User, Bell, Users, Shield, ArrowRight, Building2, Printer, MapPin } from 'lucide-react';

const settingsSections = [
  { title: 'Profile', description: 'Update your name, email, and account credentials', href: '/settings/profile', icon: User },
  { title: 'Company Details', description: 'Edit your business info, GSTIN, and legal verification', href: '/settings/company', icon: Building2 },
  { title: 'Pickup Addresses', description: 'Manage pickup hubs, warehouses, and fulfillment centers', href: '/settings/addresses', icon: MapPin },
  { title: 'Notifications', description: 'Choose how and when you receive alerts and updates', href: '/settings/notifications', icon: Bell },
  { title: 'Manage Label', description: 'Configure label format, courier logos, and barcode options', href: '/settings/label', icon: Printer },
  { title: 'Roles & Permissions', description: 'Manage staff roles, access privileges, and security', href: '/settings/roles', icon: Shield },
  { title: 'Team Members', description: 'Add sub-users and invite coworkers to your workspace', href: '/settings/team', icon: Users },
];

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="nano-page-title">Settings & configurations</h1>
        <p className="nano-page-subtitle">Manage your account profile, team privileges, shipping preferences, and pickup hubs.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {settingsSections.map(s => (
          <Link
            key={s.href}
            href={s.href}
            className="nano-card group block hover:border-[var(--brand)] transition-all"
          >
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-[var(--brand-soft)] text-[var(--brand)] mb-3">
              <s.icon className="w-5 h-5" />
            </div>
            <h3 className="text-[14px] font-bold text-[var(--ink)] mb-1 group-hover:text-[var(--brand)] transition-colors">
              {s.title}
            </h3>
            <p className="text-[12px] text-[var(--muted)] leading-relaxed">{s.description}</p>
            <div className="flex items-center gap-1 text-[var(--brand)] text-[12px] font-semibold mt-3">
              Configure <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
