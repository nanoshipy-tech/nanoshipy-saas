import React, { useState } from 'react';
import { IndianRupee, ArrowRight, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface RechargeFormProps {
  onInitiateRecharge: (amount: number) => Promise<void>;
  loading: boolean;
}

export function RechargeForm({ onInitiateRecharge, loading }: RechargeFormProps) {
  const [amount, setAmount] = useState('2000');
  const [error, setError] = useState<string | null>(null);

  const presetAmounts = [500, 1000, 2000, 5000, 10000];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const val = parseFloat(amount);
    if (isNaN(val) || val < 100 || val > 500000) {
      setError('Amount must be between ₹100 and ₹5,00,000');
      return;
    }

    await onInitiateRecharge(val);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white dark:bg-[#131620] border border-slate-200 dark:border-white/[0.06] rounded-2xl p-6 shadow-sm space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-800 dark:text-white">Initiate Digital Recharge</h3>
        <p className="text-xs text-slate-400 dark:text-slate-550 mt-0.5">Fund your wallet to prevent shipping dispatch disruptions.</p>
      </div>

      {error && (
        <div className="text-xs text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 rounded-xl px-4 py-2.5">
          {error}
        </div>
      )}

      {/* Preset Amounts Selector */}
      <div className="flex flex-wrap gap-2">
        {presetAmounts.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => { setAmount(preset.toString()); setError(null); }}
            className={`text-xs font-bold px-4 py-2.5 rounded-xl border transition outline-none ${
              amount === preset.toString()
                ? 'bg-[#8410DC] border-transparent text-white shadow-sm hover:bg-[#730ec2]'
                : 'bg-slate-50 dark:bg-white/[0.02] border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-slate-350 hover:bg-slate-100 dark:hover:bg-white/[0.04]'
            }`}
          >
            ₹{preset.toLocaleString('en-IN')}
          </button>
        ))}
      </div>

      {/* Direct Input */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">Custom Recharge Amount (₹)</label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
            <IndianRupee className="h-4 w-4" />
          </div>
          <input
            type="number"
            value={amount}
            onChange={(e) => { setAmount(e.target.value); setError(null); }}
            placeholder="e.g. 5000"
            className="w-full text-xs font-semibold border border-slate-200 dark:border-white/[0.08] rounded-xl pl-10 pr-4 py-3 bg-white dark:bg-[#0f1117] text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition"
          />
        </div>
        <p className="text-[10px] text-slate-400 dark:text-slate-500">Valid range: ₹100 - ₹5,00,000</p>
      </div>

      <div className="bg-slate-50 dark:bg-[#0f1117]/50 border border-slate-100 dark:border-white/[0.04] rounded-xl p-3.5 flex items-start space-x-2">
        <ShieldCheck className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-450 shrink-0 mt-0.5" />
        <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal">
          Payments are secured with E2E encryption and verified using payment gateway checkout signatures.
        </p>
      </div>

      <Button
        type="submit"
        disabled={loading}
        className="w-full h-11 bg-gradient-to-r from-[#5B069A] to-[#8410DC] hover:from-[#4d0582] hover:to-[#730ec2] disabled:bg-indigo-300 text-white text-xs font-bold py-3 rounded-xl flex items-center justify-center space-x-2 transition shadow-md"
      >
        <span>{loading ? 'Preparing Checkout...' : 'Proceed to Checkout'}</span>
        <ArrowRight className="h-4 w-4" />
      </Button>
    </form>
  );
}
