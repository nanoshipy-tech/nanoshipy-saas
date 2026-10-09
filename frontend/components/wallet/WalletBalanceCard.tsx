import React, { useState } from 'react';
import { Wallet, Settings, AlertCircle, TrendingUp, BellRing } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface WalletBalanceCardProps {
  balance: number;
  lowBalanceThreshold: number;
  currency: string;
  onUpdateThreshold: (newThreshold: number) => Promise<void>;
}

export function WalletBalanceCard({ balance, lowBalanceThreshold, currency, onUpdateThreshold }: WalletBalanceCardProps) {
  const [threshold, setThreshold] = useState(lowBalanceThreshold.toString());
  const [showConfig, setShowConfig] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isLowBalance = balance < lowBalanceThreshold;

  const handleSubmitThreshold = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const parsed = parseFloat(threshold);
    if (isNaN(parsed) || parsed < 0) {
      setError('Threshold must be a positive number');
      setLoading(false);
      return;
    }

    try {
      await onUpdateThreshold(parsed);
      setShowConfig(false);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to update threshold');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-[#131620] border border-slate-200 dark:border-white/[0.06] rounded-2xl p-6 shadow-sm space-y-6 relative overflow-hidden">
      {/* Background radial highlight */}
      <div className="absolute top-0 right-0 -mt-6 -mr-6 w-36 h-36 bg-purple-50/60 dark:bg-purple-950/20 rounded-full blur-2xl pointer-events-none" />

      <div className="flex items-start justify-between relative">
        <div className="space-y-1">
          <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Available Balance</p>
          <div className="flex items-baseline space-x-1">
            <span className="text-3xl font-black text-slate-900 dark:text-white">
              ₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{currency}</span>
          </div>
        </div>
        <div className="h-12 w-12 rounded-2xl bg-purple-50 dark:bg-purple-950/40 text-[#8410DC] dark:text-purple-300 flex items-center justify-center border border-purple-100/50 dark:border-indigo-900/30">
          <Wallet className="h-6 w-6" />
        </div>
      </div>

      {isLowBalance && (
        <div className="flex items-center space-x-2 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 rounded-xl px-4 py-3 text-rose-750 dark:text-rose-450">
          <AlertCircle className="h-4.5 w-4.5 shrink-0" />
          <p className="text-xs font-semibold">
            Low Balance Alert: Funds are below the alert threshold (₹{lowBalanceThreshold.toFixed(2)}).
          </p>
        </div>
      )}

      {/* Threshold settings trigger */}
      <div className="border-t border-slate-100 dark:border-white/[0.06] pt-4 flex items-center justify-between">
        <div className="flex items-center space-x-1.5 text-xs text-slate-400 dark:text-slate-500">
          <BellRing className="h-3.5 w-3.5" />
          <span>Alert threshold: <strong className="text-slate-700 dark:text-slate-350">₹{lowBalanceThreshold.toFixed(2)}</strong></span>
        </div>
        <button
          onClick={() => { setShowConfig(!showConfig); setError(null); }}
          className="text-xs text-[#8410DC] dark:text-[#D6A8FF] hover:text-indigo-850 dark:hover:text-purple-300 font-bold flex items-center space-x-1 hover:underline outline-none"
        >
          <Settings className="h-3.5 w-3.5" />
          <span>Configure Alerts</span>
        </button>
      </div>

      {showConfig && (
        <form onSubmit={handleSubmitThreshold} className="bg-slate-50 dark:bg-[#0f1117] border border-slate-100 dark:border-white/[0.04] rounded-xl p-4 space-y-3 animation-fade-in">
          <div>
            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Low Balance Trigger Amount (₹)</label>
            <div className="mt-1.5 flex items-center space-x-2">
              <input
                type="number"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                placeholder="e.g. 500"
                className="flex-1 text-xs border border-slate-200 dark:border-white/[0.08] rounded-xl px-3 py-2 bg-white dark:bg-[#131620] text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 outline-none"
              />
              <Button type="submit" disabled={loading} className="text-xs px-3.5 py-2 font-bold h-9 bg-gradient-to-r from-[#5B069A] to-[#8410DC] hover:from-[#4d0582] hover:to-[#730ec2] text-white rounded-xl">
                {loading ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
          {error && <p className="text-[10px] text-rose-600 dark:text-rose-400 font-medium">{error}</p>}
        </form>
      )}
    </div>
  );
}
