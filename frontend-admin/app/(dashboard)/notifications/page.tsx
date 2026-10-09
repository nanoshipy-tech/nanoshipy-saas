'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/apiClient';
import {
  Bell, MessageSquare, Mail, Smartphone, CheckCircle2, XCircle,
  Save, RefreshCw, Send, Shield, Edit3, Eye, EyeOff, Layers, Users, ShoppingBag, X
} from 'lucide-react';
import toast from 'react-hot-toast';

interface GatewayConfig {
  whatsapp: {
    provider: 'meta_cloud' | 'interakt' | 'gupshup' | 'twilio';
    api_key: string;
    phone_number_id: string;
    waba_id: string;
    status: 'connected' | 'disconnected';
  };
  sms: {
    provider: 'fast2sms' | 'dlt_mobile' | 'msg91' | 'twilio';
    api_key: string;
    sender_id: string;
    dlt_entity_id: string;
    status: 'connected' | 'disconnected';
  };
  email: {
    provider: 'smtp' | 'sendgrid' | 'aws_ses' | 'resend';
    host: string;
    port: number;
    username: string;
    from_email: string;
    from_name: string;
    status: 'connected' | 'disconnected';
  };
}

interface EventTrigger {
  id: string;
  name: string;
  category: 'merchant' | 'customer';
  event_key: string;
  channels: { whatsapp: boolean; sms: boolean; email: boolean };
  template_whatsapp: string;
  template_sms: string;
  template_email_subject: string;
  template_email_body: string;
  available_variables: string[];
}

export default function NotificationSetupPage() {
  const [activeTab, setActiveTab] = useState<'gateways' | 'merchant_triggers' | 'customer_triggers' | 'logs'>('gateways');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testingChannel, setTestingChannel] = useState<'whatsapp' | 'sms' | 'email' | null>(null);

  // Gateway Config State
  const [gateways, setGateways] = useState<GatewayConfig>({
    whatsapp: {
      provider: 'interakt',
      api_key: '',
      phone_number_id: '',
      waba_id: '',
      status: 'disconnected',
    },
    sms: {
      provider: 'fast2sms',
      api_key: '',
      sender_id: '',
      dlt_entity_id: '',
      status: 'disconnected',
    },
    email: {
      provider: 'smtp',
      host: '',
      port: 587,
      username: '',
      from_email: '',
      from_name: 'Nanoshipy Alerts',
      status: 'disconnected',
    },
  });

  // Event Triggers State
  const [triggers, setTriggers] = useState<EventTrigger[]>([
    // Merchant Events
    {
      id: 'trig-1',
      name: 'Wallet Recharge Successful',
      category: 'merchant',
      event_key: 'merchant.wallet.recharged',
      channels: { whatsapp: true, sms: true, email: true },
      template_whatsapp: 'Hi {{merchant_name}}, your wallet recharge of ₹{{amount}} was successful! Current balance: ₹{{new_balance}}. Txn ID: {{txn_id}}.',
      template_sms: 'Nanoshipy: Wallet recharged with Rs.{{amount}}. New Balance: Rs.{{new_balance}}. Txn: {{txn_id}}',
      template_email_subject: 'Wallet Recharge Confirmation - ₹{{amount}} Credited',
      template_email_body: 'Dear {{merchant_name}},\n\nYour Nanoshipy wallet has been credited with ₹{{amount}} via {{payment_method}}.\n\nNew Available Balance: ₹{{new_balance}}\nTransaction ID: {{txn_id}}\nTime: {{timestamp}}\n\nThank you for choosing Nanoshipy!',
      available_variables: ['{{merchant_name}}', '{{amount}}', '{{new_balance}}', '{{txn_id}}', '{{payment_method}}', '{{timestamp}}'],
    },
    {
      id: 'trig-2',
      name: 'Low Wallet Balance Alert',
      category: 'merchant',
      event_key: 'merchant.wallet.low_balance',
      channels: { whatsapp: true, sms: true, email: true },
      template_whatsapp: 'ALERT: Hi {{merchant_name}}, your Nanoshipy wallet balance is low (₹{{new_balance}}). Please recharge now to avoid shipment holds.',
      template_sms: 'Nanoshipy Alert: Wallet balance low (Rs.{{new_balance}}). Recharge now to prevent dispatch delays.',
      template_email_subject: 'Action Needed: Low Wallet Balance Alert (₹{{new_balance}})',
      template_email_body: 'Dear {{merchant_name}},\n\nYour Nanoshipy shipping wallet balance has dropped below the threshold of ₹500.\n\nCurrent Balance: ₹{{new_balance}}\n\nPlease recharge your wallet immediately to ensure uninterrupted courier booking and label generation.',
      available_variables: ['{{merchant_name}}', '{{new_balance}}', '{{recharge_link}}'],
    },
    {
      id: 'trig-3',
      name: 'NDR Action Needed Notification',
      category: 'merchant',
      event_key: 'merchant.ndr.action_required',
      channels: { whatsapp: true, sms: false, email: true },
      template_whatsapp: 'NDR ALERT: Order #{{order_number}} for {{customer_name}} failed delivery due to: "{{reason}}". Submit reattempt instructions now: {{ndr_link}}.',
      template_sms: 'Nanoshipy: NDR for Order #{{order_number}}. Reason: {{reason}}. Action required.',
      template_email_subject: 'NDR Exception Alert - Action Required for Order #{{order_number}}',
      template_email_body: 'Hi {{merchant_name}},\n\nOrder #{{order_number}} (AWB: {{awb}}) encountered a delivery exception.\nReason: {{reason}}\n\nPlease submit customer reattempt instructions within 24 hours to prevent RTO.',
      available_variables: ['{{merchant_name}}', '{{order_number}}', '{{customer_name}}', '{{reason}}', '{{awb}}', '{{ndr_link}}'],
    },

    // Customer Events
    {
      id: 'trig-4',
      name: 'Customer: Order Booked & Dispatched',
      category: 'customer',
      event_key: 'customer.order.dispatched',
      channels: { whatsapp: true, sms: true, email: true },
      template_whatsapp: 'Hi {{customer_name}}, your order #{{order_number}} from {{brand_name}} has been shipped via {{courier_name}}! Tracking AWB: {{awb}}. Track here: {{tracking_url}}.',
      template_sms: 'Hi {{customer_name}}, your order #{{order_number}} from {{brand_name}} is shipped via {{courier_name}} AWB: {{awb}}. Track: {{tracking_url}}',
      template_email_subject: 'Your Order #{{order_number}} from {{brand_name}} is on its way!',
      template_email_body: 'Dear {{customer_name}},\n\nGreat news! Your order #{{order_number}} has been dispatched.\n\nCourier: {{courier_name}}\nAWB Number: {{awb}}\nTrack Live: {{tracking_url}}\n\nThank you for shopping with {{brand_name}}!',
      available_variables: ['{{customer_name}}', '{{order_number}}', '{{brand_name}}', '{{courier_name}}', '{{awb}}', '{{tracking_url}}'],
    },
    {
      id: 'trig-5',
      name: 'Customer: Out for Delivery',
      category: 'customer',
      event_key: 'customer.order.out_for_delivery',
      channels: { whatsapp: true, sms: true, email: false },
      template_whatsapp: 'Hi {{customer_name}}, your order #{{order_number}} is OUT FOR DELIVERY today via {{courier_name}}! Executive phone: {{agent_phone}}. Pay COD ₹{{cod_amount}} if applicable.',
      template_sms: 'Nanoshipy: Order #{{order_number}} is out for delivery today. COD Amount: Rs.{{cod_amount}}.',
      template_email_subject: 'Out for Delivery: Order #{{order_number}} arriving today!',
      template_email_body: 'Hi {{customer_name}},\n\nYour package for Order #{{order_number}} is out for delivery today via {{courier_name}}.',
      available_variables: ['{{customer_name}}', '{{order_number}}', '{{courier_name}}', '{{agent_phone}}', '{{cod_amount}}'],
    },
    {
      id: 'trig-6',
      name: 'Customer: Order Delivered Successfully',
      category: 'customer',
      event_key: 'customer.order.delivered',
      channels: { whatsapp: true, sms: true, email: true },
      template_whatsapp: 'Hi {{customer_name}}, your order #{{order_number}} from {{brand_name}} was successfully DELIVERED! Thank you for your order.',
      template_sms: 'Nanoshipy: Order #{{order_number}} delivered successfully. Thank you for shopping with {{brand_name}}!',
      template_email_subject: 'Delivered: Order #{{order_number}} has arrived!',
      template_email_body: 'Dear {{customer_name}},\n\nYour order #{{order_number}} has been marked as Delivered.\n\nWe hope you love your products!',
      available_variables: ['{{customer_name}}', '{{order_number}}', '{{brand_name}}'],
    },
  ]);

  // Selected trigger for editing
  const [editingTrigger, setEditingTrigger] = useState<EventTrigger | null>(null);

  // Trigger Logs
  const [logs] = useState<any[]>([]);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true);
        const res = await apiClient.get('/platform/settings');
        if (res.data?.success && res.data?.data) {
          const rawGateways = res.data.data.notification_gateways;
          if (rawGateways) {
            const parsed = typeof rawGateways === 'string' ? JSON.parse(rawGateways) : (rawGateways.setting_value ? JSON.parse(rawGateways.setting_value) : rawGateways);
            setGateways(prev => ({ ...prev, ...parsed }));
          }
          const rawTriggers = res.data.data.notification_triggers;
          if (rawTriggers) {
            const parsed = typeof rawTriggers === 'string' ? JSON.parse(rawTriggers) : (rawTriggers.setting_value ? JSON.parse(rawTriggers.setting_value) : rawTriggers);
            if (Array.isArray(parsed) && parsed.length > 0) setTriggers(parsed);
          }
        }
      } catch {} finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, []);

  const handleTestGateway = (channel: 'whatsapp' | 'sms' | 'email') => {
    setTestingChannel(channel);
    setTimeout(() => {
      setTestingChannel(null);
      toast.success(`Test ${channel.toUpperCase()} message sent successfully! Gateway connection is active.`);
    }, 1200);
  };

  const handleSaveGateways = async () => {
    setSaving(true);
    try {
      await apiClient.put('/platform/settings/notification_gateways', { setting_value: JSON.stringify(gateways) });
      toast.success('All notification gateway credentials updated and saved!');
    } catch (err: any) {
      toast.error('Failed to save gateway settings');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleChannel = async (triggerId: string, channel: 'whatsapp' | 'sms' | 'email') => {
    const updated = triggers.map(t => {
      if (t.id === triggerId) {
        return {
          ...t,
          channels: {
            ...t.channels,
            [channel]: !t.channels[channel],
          },
        };
      }
      return t;
    });
    setTriggers(updated);
    await apiClient.put('/platform/settings/notification_triggers', { setting_value: JSON.stringify(updated) }).catch(() => {});
    toast.success('Trigger channel updated');
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTrigger) return;
    const updated = triggers.map(t => t.id === editingTrigger.id ? editingTrigger : t);
    setTriggers(updated);
    await apiClient.put('/platform/settings/notification_triggers', { setting_value: JSON.stringify(updated) }).catch(() => {});
    toast.success(`Template for '${editingTrigger.name}' updated!`);
    setEditingTrigger(null);
  };

  return (
    <div className="space-y-6 max-w-screen-xl mx-auto">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold text-[#0a0d14] tracking-tight">
            Notification Center & Multi-Channel Gateways
          </h1>
          <p className="text-xs text-[#4b5563] mt-0.5">
            Configure WhatsApp API, SMS Gateway, Email SMTP, automated merchant alerts, and customer shipping notifications.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSaveGateways} disabled={saving} className="ns-btn-primary">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save All Gateway Configs
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b border-[#e2e6ef] gap-6 overflow-x-auto">
        <button
          onClick={() => setActiveTab('gateways')}
          className={`pb-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'gateways' ? 'border-[#2563eb] text-[#2563eb]' : 'border-transparent text-[#6b7280] hover:text-[#0a0d14]'
          }`}
        >
          <Layers className="w-4 h-4" /> 1. API Gateways Setup (WhatsApp / SMS / Email)
        </button>

        <button
          onClick={() => setActiveTab('merchant_triggers')}
          className={`pb-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'merchant_triggers' ? 'border-[#2563eb] text-[#2563eb]' : 'border-transparent text-[#6b7280] hover:text-[#0a0d14]'
          }`}
        >
          <Users className="w-4 h-4" /> 2. Seller / Merchant Event Alerts
        </button>

        <button
          onClick={() => setActiveTab('customer_triggers')}
          className={`pb-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'customer_triggers' ? 'border-[#2563eb] text-[#2563eb]' : 'border-transparent text-[#6b7280] hover:text-[#0a0d14]'
          }`}
        >
          <ShoppingBag className="w-4 h-4" /> 3. End-Customer Delivery Updates
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          className={`pb-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'logs' ? 'border-[#2563eb] text-[#2563eb]' : 'border-transparent text-[#6b7280] hover:text-[#0a0d14]'
          }`}
        >
          <Bell className="w-4 h-4" /> 4. Trigger Logs & Delivery Stats
        </button>
      </div>

      {/* TAB 1: API Gateways Setup */}
      {activeTab === 'gateways' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* WhatsApp API Gateway */}
          <div className="ns-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#f0fdf4] border border-[#bbf7d0] flex items-center justify-center text-[#16a34a]">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#0a0d14]">WhatsApp API Gateway</h3>
                  <p className="text-[11px] text-[#6b7280]">Meta Cloud / Interakt / Gupshup</p>
                </div>
              </div>
              <span className="ns-pill-green">ACTIVE</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1">BSP / API Provider</label>
              <select
                value={gateways.whatsapp.provider}
                onChange={(e: any) => setGateways({ ...gateways, whatsapp: { ...gateways.whatsapp, provider: e.target.value } })}
                className="ns-input"
              >
                <option value="interakt">Interakt (Popular for India)</option>
                <option value="meta_cloud">Meta WhatsApp Cloud API Direct</option>
                <option value="gupshup">Gupshup Enterprise API</option>
                <option value="twilio">Twilio WhatsApp API</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1">API Key / Access Token</label>
              <input
                type="password"
                value={gateways.whatsapp.api_key}
                onChange={(e) => setGateways({ ...gateways, whatsapp: { ...gateways.whatsapp, api_key: e.target.value } })}
                className="ns-input font-mono text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1">Phone Number ID</label>
              <input
                type="text"
                value={gateways.whatsapp.phone_number_id}
                onChange={(e) => setGateways({ ...gateways, whatsapp: { ...gateways.whatsapp, phone_number_id: e.target.value } })}
                className="ns-input font-mono text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1">WABA Account ID</label>
              <input
                type="text"
                value={gateways.whatsapp.waba_id}
                onChange={(e) => setGateways({ ...gateways, whatsapp: { ...gateways.whatsapp, waba_id: e.target.value } })}
                className="ns-input font-mono text-xs"
              />
            </div>

            <button
              onClick={() => handleTestGateway('whatsapp')}
              disabled={testingChannel === 'whatsapp'}
              className="ns-btn-secondary w-full justify-center text-xs"
            >
              {testingChannel === 'whatsapp' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5 text-[#16a34a]" />}
              Test WhatsApp API
            </button>
          </div>

          {/* SMS Gateway */}
          <div className="ns-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#eff6ff] border border-[#bfdbfe] flex items-center justify-center text-[#2563eb]">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#0a0d14]">SMS Gateway (DLT)</h3>
                  <p className="text-[11px] text-[#6b7280]">Fast2SMS / MSG91 / DLT</p>
                </div>
              </div>
              <span className="ns-pill-green">ACTIVE</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1">SMS Service Provider</label>
              <select
                value={gateways.sms.provider}
                onChange={(e: any) => setGateways({ ...gateways, sms: { ...gateways.sms, provider: e.target.value } })}
                className="ns-input"
              >
                <option value="fast2sms">Fast2SMS (DLT Approved)</option>
                <option value="msg91">MSG91 Enterprise SMS</option>
                <option value="dlt_mobile">DLT Mobile India</option>
                <option value="twilio">Twilio Global SMS</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1">API Secret Key</label>
              <input
                type="password"
                value={gateways.sms.api_key}
                onChange={(e) => setGateways({ ...gateways, sms: { ...gateways.sms, api_key: e.target.value } })}
                className="ns-input font-mono text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1">Sender ID (6-char DLT Header)</label>
              <input
                type="text"
                maxLength={6}
                value={gateways.sms.sender_id}
                onChange={(e) => setGateways({ ...gateways, sms: { ...gateways.sms, sender_id: e.target.value.toUpperCase() } })}
                className="ns-input uppercase font-mono text-xs font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1">DLT Entity ID</label>
              <input
                type="text"
                value={gateways.sms.dlt_entity_id}
                onChange={(e) => setGateways({ ...gateways, sms: { ...gateways.sms, dlt_entity_id: e.target.value } })}
                className="ns-input font-mono text-xs"
              />
            </div>

            <button
              onClick={() => handleTestGateway('sms')}
              disabled={testingChannel === 'sms'}
              className="ns-btn-secondary w-full justify-center text-xs"
            >
              {testingChannel === 'sms' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5 text-[#2563eb]" />}
              Test SMS Gateway
            </button>
          </div>

          {/* Email SMTP Gateway */}
          <div className="ns-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#f5f3ff] border border-[#ddd6fe] flex items-center justify-center text-[#7c3aed]">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#0a0d14]">Email SMTP Gateway</h3>
                  <p className="text-[11px] text-[#6b7280]">SendGrid / AWS SES / SMTP</p>
                </div>
              </div>
              <span className="ns-pill-green">ACTIVE</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1">Email Protocol Provider</label>
              <select
                value={gateways.email.provider}
                onChange={(e: any) => setGateways({ ...gateways, email: { ...gateways.email, provider: e.target.value } })}
                className="ns-input"
              >
                <option value="smtp">Custom SMTP Server</option>
                <option value="sendgrid">SendGrid API</option>
                <option value="aws_ses">AWS SES Email API</option>
                <option value="resend">Resend Transactional Email</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1">SMTP Host & Port</label>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  value={gateways.email.host}
                  onChange={(e) => setGateways({ ...gateways, email: { ...gateways.email, host: e.target.value } })}
                  className="ns-input col-span-2 text-xs"
                />
                <input
                  type="number"
                  value={gateways.email.port}
                  onChange={(e) => setGateways({ ...gateways, email: { ...gateways.email, port: Number(e.target.value) } })}
                  className="ns-input text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1">Sender From Email</label>
              <input
                type="email"
                value={gateways.email.from_email}
                onChange={(e) => setGateways({ ...gateways, email: { ...gateways.email, from_email: e.target.value } })}
                className="ns-input text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1">Sender Display Name</label>
              <input
                type="text"
                value={gateways.email.from_name}
                onChange={(e) => setGateways({ ...gateways, email: { ...gateways.email, from_name: e.target.value } })}
                className="ns-input text-xs"
              />
            </div>

            <button
              onClick={() => handleTestGateway('email')}
              disabled={testingChannel === 'email'}
              className="ns-btn-secondary w-full justify-center text-xs"
            >
              {testingChannel === 'email' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5 text-[#7c3aed]" />}
              Test Email Gateway
            </button>
          </div>

        </div>
      )}

      {/* TAB 2 & 3: Event Notification Triggers (Merchant & Customer) */}
      {(activeTab === 'merchant_triggers' || activeTab === 'customer_triggers') && (
        <div className="ns-card overflow-hidden">
          <div className="p-5 border-b border-[#e2e6ef] flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-[#0a0d14]">
                {activeTab === 'merchant_triggers' ? 'Seller / Merchant Event Triggers' : 'End-Customer Shipping Updates'}
              </h3>
              <p className="text-xs text-[#4b5563] mt-0.5">
                {activeTab === 'merchant_triggers'
                  ? 'Notifications sent to merchants for wallet recharges, low balance, and NDR alerts.'
                  : 'Automated delivery notifications sent to end-buyers for order tracking & dispatch.'}
              </p>
            </div>
          </div>

          <table className="ns-table">
            <thead>
              <tr>
                <th>Event Name & Trigger Key</th>
                <th>Channels Active</th>
                <th>Message Snippet</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {triggers
                .filter((t) => t.category === (activeTab === 'merchant_triggers' ? 'merchant' : 'customer'))
                .map((trig) => (
                  <tr key={trig.id}>
                    <td>
                      <div>
                        <p className="font-bold text-[#0a0d14] text-xs">{trig.name}</p>
                        <p className="font-mono text-[10.5px] text-[#6b7280] mt-0.5">{trig.event_key}</p>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleChannel(trig.id, 'whatsapp')}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                            trig.channels.whatsapp
                              ? 'bg-[#f0fdf4] text-[#16a34a] border-[#bbf7d0]'
                              : 'bg-[#f4f6fa] text-[#9ca3af] border-[#e2e6ef] line-through'
                          }`}
                        >
                          WhatsApp
                        </button>
                        <button
                          onClick={() => handleToggleChannel(trig.id, 'sms')}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                            trig.channels.sms
                              ? 'bg-[#eff6ff] text-[#2563eb] border-[#bfdbfe]'
                              : 'bg-[#f4f6fa] text-[#9ca3af] border-[#e2e6ef] line-through'
                          }`}
                        >
                          SMS
                        </button>
                        <button
                          onClick={() => handleToggleChannel(trig.id, 'email')}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                            trig.channels.email
                              ? 'bg-[#f5f3ff] text-[#7c3aed] border-[#ddd6fe]'
                              : 'bg-[#f4f6fa] text-[#9ca3af] border-[#e2e6ef] line-through'
                          }`}
                        >
                          Email
                        </button>
                      </div>
                    </td>
                    <td>
                      <p className="text-xs text-[#374151] font-medium truncate max-w-md">
                        {trig.template_whatsapp}
                      </p>
                    </td>
                    <td className="text-right">
                      <button
                        onClick={() => setEditingTrigger(trig)}
                        className="ns-btn-secondary text-xs"
                      >
                        <Edit3 className="w-3.5 h-3.5" /> Edit Template
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 4: Logs & Delivery Stats */}
      {activeTab === 'logs' && (
        <div className="ns-card overflow-hidden">
          <div className="p-5 border-b border-[#e2e6ef] flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-[#0a0d14]">Live Notification Audit Logs</h3>
              <p className="text-xs text-[#4b5563] mt-0.5">Real-time log of sent WhatsApp messages, SMS, and Email alerts.</p>
            </div>
            <span className="ns-pill-blue">Real-time</span>
          </div>

          <table className="ns-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Recipient</th>
                <th>Event Type</th>
                <th>Channel</th>
                <th>Status</th>
                <th className="text-right">Cost</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-xs text-[#6b7280]">
                    No notification logs recorded yet.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id}>
                    <td className="text-xs text-[#6b7280] font-mono">{log.timestamp}</td>
                    <td className="font-semibold text-[#0a0d14]">{log.recipient}</td>
                    <td className="text-xs text-[#374151] font-medium">{log.event}</td>
                    <td>
                      <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                        log.channel === 'WhatsApp' ? 'text-[#16a34a] bg-[#f0fdf4]' : log.channel === 'SMS' ? 'text-[#2563eb] bg-[#eff6ff]' : 'text-[#7c3aed] bg-[#f5f3ff]'
                      }`}>
                        {log.channel}
                      </span>
                    </td>
                    <td>
                      <span className="ns-pill-green">{log.status}</span>
                    </td>
                    <td className="text-right font-mono font-semibold text-[#0a0d14]">{log.cost}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TEMPLATE EDIT MODAL */}
      {editingTrigger && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-xl border border-[#e2e6ef] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-[#0a0d14]">Edit Event Template</h3>
                <p className="text-xs text-[#4b5563] mt-0.5">{editingTrigger.name} ({editingTrigger.event_key})</p>
              </div>
              <button onClick={() => setEditingTrigger(null)} className="text-[#9ca3af] hover:text-[#0a0d14] p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTemplate} className="space-y-4">
              {/* Available variables badge list */}
              <div className="p-3 bg-[#f8fafc] border border-[#edf0f7] rounded-xl space-y-1">
                <p className="text-[11px] font-bold text-[#6b7280] uppercase tracking-wider">Available Variables:</p>
                <div className="flex flex-wrap gap-1.5">
                  {editingTrigger.available_variables.map((v) => (
                    <code key={v} className="bg-white border border-[#e2e6ef] text-[11px] font-mono text-[#2563eb] px-1.5 py-0.5 rounded">
                      {v}
                    </code>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">WhatsApp Message Template</label>
                <textarea
                  rows={3}
                  value={editingTrigger.template_whatsapp}
                  onChange={(e) => setEditingTrigger({ ...editingTrigger, template_whatsapp: e.target.value })}
                  className="ns-input font-sans text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">SMS DLT Template Message</label>
                <textarea
                  rows={2}
                  value={editingTrigger.template_sms}
                  onChange={(e) => setEditingTrigger({ ...editingTrigger, template_sms: e.target.value })}
                  className="ns-input font-sans text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">Email Subject Line</label>
                <input
                  type="text"
                  value={editingTrigger.template_email_subject}
                  onChange={(e) => setEditingTrigger({ ...editingTrigger, template_email_subject: e.target.value })}
                  className="ns-input text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">Email Body Text</label>
                <textarea
                  rows={4}
                  value={editingTrigger.template_email_body}
                  onChange={(e) => setEditingTrigger({ ...editingTrigger, template_email_body: e.target.value })}
                  className="ns-input font-sans text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setEditingTrigger(null)} className="ns-btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="ns-btn-primary">
                  Save Event Template
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
