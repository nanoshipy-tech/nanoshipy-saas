'use client';

import React from 'react';
import Link from 'next/link';
import {
  Settings, Shield, Truck, MapPin, Key, MessageSquare,
  MessageCircle, CreditCard, Mail, Image, Layers, ChevronRight
} from 'lucide-react';
import PlatformSettingsForm from '@/components/settings/PlatformSettingsForm';

const CONFIG_MODULES = [
  {
    title: 'Courier Configuration',
    desc: 'API keys, credentials & active carrier routing (Delhivery, Bluedart, Xpressbees, etc.)',
    href: '/couriers',
    icon: Truck,
    badge: 'Logistics',
  },
  {
    title: 'Google Maps & Location',
    desc: 'Google Places API key, geocoding & automated pin code address validation',
    href: '/configuration/address-settings',
    icon: MapPin,
    badge: 'API Key',
  },
  {
    title: 'Google Login (OAuth)',
    desc: 'Google Sign-In OAuth credentials, Client ID, Secret & authorized callback URIs',
    href: '/configuration/google-auth',
    icon: Key,
    badge: 'Auth',
  },
  {
    title: 'SMS Gateway',
    desc: 'Fast2SMS, DLT Entity ID, Sender ID & SMS notification templates',
    href: '/configuration/sms',
    icon: MessageSquare,
    badge: 'Messaging',
  },
  {
    title: 'WhatsApp Bot',
    desc: 'Automated order dispatch & delivery tracking notifications via WhatsApp Cloud API',
    href: '/configuration/whatsapp',
    icon: MessageCircle,
    badge: 'Notifications',
  },
  {
    title: 'Payment Gateways',
    desc: 'Razorpay, Cashfree & manual banking payment collection credentials',
    href: '/configuration/payment-gateways',
    icon: CreditCard,
    badge: 'Payments',
  },
  {
    title: 'SMTP Email Delivery',
    desc: 'Outbound SMTP email host, credentials, TLS port & sender address',
    href: '/configuration/smtp',
    icon: Mail,
    badge: 'Email',
  },
  {
    title: 'Banner Manager',
    desc: 'Platform promotional banners, announcement popups & discount campaigns',
    href: '/settings/banner',
    icon: Image,
    badge: 'Marketing',
  },
];

export default function PlatformSettingsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
            <Settings className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[var(--ink)]">Platform Settings & Configuration</h1>
            <p className="text-xs sm:text-sm text-[var(--muted)] mt-0.5">
              Manage platform integrations, third-party API keys, system defaults, and global rules.
            </p>
          </div>
        </div>
      </div>

      {/* ── Direct Configuration & Integrations Hub ── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
            Integrations & Service Credentials
          </h2>
          <span className="text-[11.5px] font-semibold text-purple-400">8 Configuration Modules</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {CONFIG_MODULES.map((mod) => (
            <Link
              key={mod.href}
              href={mod.href}
              className="p-3.5 rounded-[12px] border border-[var(--line)] bg-[var(--surface)] hover:border-purple-500/60 hover:shadow-md transition-all group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div
                    className="w-8 h-8 rounded-[8px] flex items-center justify-center group-hover:scale-105 transition-transform"
                    style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}
                  >
                    <mod.icon className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    {mod.badge}
                  </span>
                </div>
                <h3 className="text-[13.5px] font-bold text-[var(--ink)] group-hover:text-purple-400 transition-colors">
                  {mod.title}
                </h3>
                <p className="text-[11.5px] text-[var(--muted)] mt-1 line-clamp-2 leading-relaxed">
                  {mod.desc}
                </p>
              </div>

              <div className="mt-3 pt-2 border-t border-[var(--line)]/50 flex items-center justify-between text-[11.5px] font-bold text-purple-400">
                <span>Configure</span>
                <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Security note */}
      <div className="flex items-start gap-3 p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl">
        <Shield className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-xs sm:text-sm font-semibold text-amber-300">Changes take effect immediately across all tenants</p>
          <p className="text-[11.5px] text-amber-300/80 mt-0.5">
            All platform setting changes are logged to the platform audit trail.
            Financial parameters (GST rate, COD fees, wallet thresholds) affect billing immediately upon saving.
          </p>
        </div>
      </div>

      {/* Resolution info */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: 'Tenant Override', desc: 'Tenant-specific setting configured by merchant', color: 'bg-violet-500/20 border-violet-500/30 text-violet-300' },
          { label: 'Platform Default', desc: 'Global value saved in platform database', color: 'bg-[#8410DC]/20 border-[#8410DC]/30 text-purple-300' },
          { label: 'System Default', desc: 'Hardcoded environment fallback', color: 'bg-slate-500/20 border-slate-500/30 text-[var(--muted)]' },
        ].map((item) => (
          <div key={item.label} className={`p-3 rounded-xl border ${item.color.split(' ').slice(0, 2).join(' ')}`}>
            <div className={`text-xs font-bold ${item.color.split(' ')[2]}`}>{item.label}</div>
            <div className="text-[11.5px] text-[var(--muted)] mt-0.5">{item.desc}</div>
          </div>
        ))}
      </div>

      {/* Settings table */}
      <section className="admin-card">
        <h2 className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider mb-3">
          Global Environment Key-Value Configuration
        </h2>
        <PlatformSettingsForm />
      </section>
    </div>
  );
}
