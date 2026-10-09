'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/apiClient';
import { CreditCard, ShieldCheck, AlertTriangle, CheckCircle2, RefreshCw, History, ArrowDownLeft } from 'lucide-react';
import toast from 'react-hot-toast';

interface PaymentTermsTabProps {
  tenantId: string;
}

export default function PaymentTermsTab({ tenantId }: PaymentTermsTabProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  // Form states
  const [mode, setMode] = useState<'prepaid' | 'postpaid'>('prepaid');
  const [creditLimit, setCreditLimit] = useState('0');
  const [billingCycle, setBillingCycle] = useState('weekly');
  const [paymentTermsDays, setPaymentTermsDays] = useState('7');
  const [status, setStatus] = useState('active');
  const [reason, setReason] = useState('');
  const [savingTerms, setSavingTerms] = useState(false);

  // Payment recording state
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [recordingPayment, setRecordingPayment] = useState(false);

  useEffect(() => {
    fetchPaymentTerms();
  }, [tenantId]);

  const fetchPaymentTerms = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get(`/platform/sellers/${tenantId}/payment-terms`);
      if (res.data?.success && res.data?.data) {
        const payload = res.data.data;
        setData(payload);
        const p = payload.profile || {};
        setMode(p.payment_mode || 'prepaid');
        setCreditLimit(String(p.credit_limit || '0'));
        setBillingCycle(p.billing_cycle || 'weekly');
        setPaymentTermsDays(String(p.payment_terms_days || '7'));
        setStatus(p.status || 'active');
      }
    } catch {
      toast.error('Failed to load seller payment terms');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTerms = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingTerms(true);
      const res = await apiClient.put(`/platform/sellers/${tenantId}/payment-terms`, {
        payment_mode: mode,
        credit_limit: parseFloat(creditLimit) || 0,
        billing_cycle: billingCycle,
        payment_terms_days: parseInt(paymentTermsDays, 10) || 7,
        status,
        reason: reason || 'Updated by platform administrator',
      });
      if (res.data?.success) {
        toast.success('Payment terms updated successfully');
        setReason('');
        fetchPaymentTerms();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to update payment terms');
    } finally {
      setSavingTerms(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmt = parseFloat(paymentAmount);
    if (!numAmt || numAmt <= 0) {
      toast.error('Please enter a valid positive payment amount');
      return;
    }

    try {
      setRecordingPayment(true);
      const res = await apiClient.post(`/platform/sellers/${tenantId}/postpaid/payments`, {
        amount: numAmt,
        payment_method: paymentMethod,
        payment_reference: paymentReference,
        notes: paymentNotes,
      });
      if (res.data?.success) {
        toast.success(`Recorded payment of ₹${numAmt.toLocaleString('en-IN')}`);
        setPaymentAmount('');
        setPaymentReference('');
        setPaymentNotes('');
        fetchPaymentTerms();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to record payment');
    } finally {
      setRecordingPayment(false);
    }
  };

  if (loading) {
    return (
      <div className="py-12 text-center text-slate-500 flex flex-col items-center gap-2">
        <RefreshCw className="w-5 h-5 animate-spin text-[#8410DC]" />
        <span>Loading payment terms and credit profiles...</span>
      </div>
    );
  }

  const profile = data?.profile || {};
  const summary = data?.summary || {};
  const history = data?.history || [];

  return (
    <div className="space-y-6 text-xs text-slate-800">
      {/* Current Mode Banner */}
      <div className={`p-4 rounded-2xl border flex items-center justify-between ${
        profile.payment_mode === 'postpaid'
          ? 'bg-purple-50/60 border-purple-200'
          : 'bg-emerald-50/60 border-emerald-200'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
            profile.payment_mode === 'postpaid'
              ? 'bg-[#8410DC] text-white'
              : 'bg-emerald-600 text-white'
          }`}>
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-black text-slate-900 uppercase">
              Current Mode: {profile.payment_mode || 'PREPAID'}
            </h4>
            <p className="text-slate-600 text-[11px]">
              {profile.payment_mode === 'postpaid'
                ? `Postpaid line of credit with ${profile.billing_cycle || 'weekly'} billing cycle and Net ${profile.payment_terms_days || 7} days terms.`
                : 'Prepaid wallet deduction before carrier dispatch.'}
            </p>
          </div>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
          profile.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
        }`}>
          {profile.status || 'ACTIVE'}
        </span>
      </div>

      {/* Postpaid Metrics (Visible if Postpaid) */}
      {profile.payment_mode === 'postpaid' && (
        <div className="grid grid-cols-4 gap-3">
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
            <p className="text-[10px] font-bold text-slate-500 uppercase">Approved Credit Limit</p>
            <p className="text-base font-black text-slate-900 mt-1">
              ₹{parseFloat(profile.credit_limit || 0).toLocaleString('en-IN')}
            </p>
          </div>
          <div className="p-3.5 rounded-2xl bg-rose-50/60 border border-rose-100">
            <p className="text-[10px] font-bold text-rose-600 uppercase">Current Outstanding</p>
            <p className="text-base font-black text-rose-700 mt-1">
              ₹{parseFloat(profile.outstanding_amount || 0).toLocaleString('en-IN')}
            </p>
          </div>
          <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-100">
            <p className="text-[10px] font-bold text-emerald-600 uppercase">Available Credit</p>
            <p className="text-base font-black text-emerald-700 mt-1">
              ₹{parseFloat(profile.available_credit || 0).toLocaleString('en-IN')}
            </p>
          </div>
          <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-100">
            <p className="text-[10px] font-bold text-amber-600 uppercase">Unbilled Freight</p>
            <p className="text-base font-black text-amber-700 mt-1">
              ₹{parseFloat(summary.unbilled_amount || 0).toLocaleString('en-IN')}
            </p>
          </div>
        </div>
      )}

      {/* Payment Terms Form */}
      <form onSubmit={handleSaveTerms} className="p-4 bg-white rounded-2xl border border-slate-200 space-y-4">
        <h4 className="font-black text-slate-900 uppercase tracking-wider text-xs flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#8410DC]" /> Update Payment Terms & Limits
        </h4>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">Payment Mode</label>
            <select
              value={mode}
              onChange={e => setMode(e.target.value as any)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#8410DC]"
            >
              <option value="prepaid">Prepaid (Deduct from Wallet)</option>
              <option value="postpaid">Postpaid (Credit Limit & Invoiced)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">Credit Limit (₹)</label>
            <input
              type="number"
              step="0.01"
              value={creditLimit}
              onChange={e => setCreditLimit(e.target.value)}
              disabled={mode !== 'postpaid'}
              placeholder="e.g. 50000"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#8410DC] disabled:bg-slate-100"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">Billing Cycle</label>
            <select
              value={billingCycle}
              onChange={e => setBillingCycle(e.target.value)}
              disabled={mode !== 'postpaid'}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#8410DC] disabled:bg-slate-100"
            >
              <option value="weekly">Weekly</option>
              <option value="biweekly">Bi-weekly (Fortnightly)</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">Payment Terms (Net Days)</label>
            <select
              value={paymentTermsDays}
              onChange={e => setPaymentTermsDays(e.target.value)}
              disabled={mode !== 'postpaid'}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#8410DC] disabled:bg-slate-100"
            >
              <option value="3">Net 3 Days</option>
              <option value="7">Net 7 Days</option>
              <option value="15">Net 15 Days</option>
              <option value="30">Net 30 Days</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">Credit Status</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#8410DC]"
            >
              <option value="active">Active (Dispatches Allowed)</option>
              <option value="grace_period">Grace Period</option>
              <option value="suspended">Suspended (Block Dispatches)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">Audit Reason</label>
            <input
              type="text"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. Approved ₹50k credit limit after review"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#8410DC]"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={savingTerms}
          className="px-4 py-2 rounded-xl bg-[#8410DC] text-white font-black flex items-center gap-2 hover:bg-[#6c0cb5] transition disabled:opacity-50 cursor-pointer"
        >
          {savingTerms ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
          {savingTerms ? 'Updating Terms...' : 'Save Payment Terms'}
        </button>
      </form>

      {/* Record Payment Section */}
      {profile.payment_mode === 'postpaid' && (
        <form onSubmit={handleRecordPayment} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
          <h4 className="font-black text-slate-900 uppercase tracking-wider text-xs flex items-center gap-2">
            <ArrowDownLeft className="w-4 h-4 text-emerald-600" /> Record Offline / Postpaid Payment
          </h4>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Amount (₹)</label>
              <input
                type="number"
                step="0.01"
                required
                value={paymentAmount}
                onChange={e => setPaymentAmount(e.target.value)}
                placeholder="e.g. 15000"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#8410DC]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Method</label>
              <select
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#8410DC]"
              >
                <option value="bank_transfer">Bank Transfer (NEFT/RTGS/IMPS)</option>
                <option value="cheque">Cheque</option>
                <option value="razorpay">Razorpay</option>
                <option value="manual_adjustment">Credit Note / Adjustment</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">UTR / Ref Number</label>
              <input
                type="text"
                value={paymentReference}
                onChange={e => setPaymentReference(e.target.value)}
                placeholder="e.g. UTR29381029"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#8410DC]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={recordingPayment}
            className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-black flex items-center gap-2 hover:bg-emerald-700 transition disabled:opacity-50 cursor-pointer"
          >
            {recordingPayment ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            {recordingPayment ? 'Recording...' : 'Record Payment Against Debt'}
          </button>
        </form>
      )}

      {/* Terms Audit History */}
      {history.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-black text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
            <History className="w-3.5 h-3.5 text-slate-500" /> Terms Change History
          </h4>
          <div className="border border-slate-200 rounded-2xl overflow-hidden">
            <table className="w-full text-left border-collapse text-[11px]">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                <tr>
                  <th className="py-2 px-3">Date</th>
                  <th className="py-2 px-3">Changed By</th>
                  <th className="py-2 px-3">Mode Transition</th>
                  <th className="py-2 px-3">Credit Limit</th>
                  <th className="py-2 px-3">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((h: any) => (
                  <tr key={h.id}>
                    <td className="py-2 px-3 text-slate-600">
                      {new Date(h.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-2 px-3 font-bold text-slate-800">
                      {h.admin?.name || 'Super Admin'}
                    </td>
                    <td className="py-2 px-3 uppercase font-semibold">
                      {h.previous_mode || 'N/A'} → {h.new_mode}
                    </td>
                    <td className="py-2 px-3 font-mono">
                      ₹{parseFloat(h.new_credit_limit || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="py-2 px-3 text-slate-500">
                      {h.reason || 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
