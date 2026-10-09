'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/apiClient';
import { useAuth } from '@/lib/authStore';
import {
  Loader2, RefreshCw, FileText, Ticket, Sparkles, X, Tag, Percent, Gift, Check, ArrowRight, AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { TransactionTable } from '@/components/wallet/TransactionTable';

export default function TenantWalletPage() {
  const { user } = useAuth();
  const [balance, setBalance] = useState<number>(0);
  const [lastRecharge, setLastRecharge] = useState<any>({ amount: 0, date: 'No recent recharge' });
  const [amount, setAmount] = useState<string>('1000');
  const [selectedGateway, setSelectedGateway] = useState<'razorpay' | 'cashfree'>('razorpay');
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [initiating, setInitiating] = useState(false);
  const [gstSettings, setGstSettings] = useState({ enabled: true, gst_percent: 18, fee_percent: 0, presets: [500, 1000, 2000, 5000] });

  // Coupon state
  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [couponError, setCouponError] = useState('');
  const [availableCoupons, setAvailableCoupons] = useState<any[]>([]);
  const [loadingCoupons, setLoadingCoupons] = useState(false);

  // Paginated ledger state
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerPagination, setLedgerPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [ledgerTransactions, setLedgerTransactions] = useState<any[]>([]);
  const [loadingLedger, setLoadingLedger] = useState(false);

  useEffect(() => {
    fetchWalletData();
    fetchGstSettings();
    fetchCoupons();
  }, []);

  useEffect(() => {
    fetchLedgerData(ledgerPage);
  }, [ledgerPage]);

  const fetchLedgerData = async (page: number) => {
    try {
      setLoadingLedger(true);
      const res = await apiClient.get('/wallet/transactions', { params: { page, limit: 15 } });
      if (res.data.success) {
        const d = res.data.data;
        const rows = Array.isArray(d) ? d : (d?.rows || d?.transactions || []);
        setLedgerTransactions(rows);
        if (d?.pagination) {
          setLedgerPagination(d.pagination);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoadingLedger(false);
    }
  };

  const fetchGstSettings = async () => {
    try {
      const res = await apiClient.get('/wallet/recharge/config');
      if (res.data.success && res.data.data) {
        const gs = res.data.data;
        setGstSettings({
          enabled: gs.auto_gst_invoice ?? true,
          gst_percent: 18,
          fee_percent: gs.fee_percent ?? 0,
          presets: gs.presets || [500, 1000, 2000, 5000],
        });
      }
    } catch {
      // silently fail — use defaults
    }
  };

  const fetchCoupons = async () => {
    setLoadingCoupons(true);
    try {
      const res = await apiClient.get('/wallet/recharge/coupons');
      if (res.data?.success && Array.isArray(res.data?.data?.coupons)) {
        setAvailableCoupons(res.data.data.coupons);
      }
    } catch {
      // ignore
    } finally {
      setLoadingCoupons(false);
    }
  };

  const fetchWalletData = async () => {
    try {
      setLoadingHistory(true);
      const [walletRes, txRes] = await Promise.all([
        apiClient.get('/wallet'),
        apiClient.get('/wallet/transactions')
      ]);

      if (walletRes.data.success) {
        const walletData = walletRes.data.data;
        setBalance(parseFloat(walletData.balance ?? 0));
        if (walletData.updated_at) {
          const d = new Date(walletData.updated_at);
          setLastRecharge({ amount: 0, date: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) });
        }
      }
      if (txRes.data.success) {
        const d = txRes.data.data;
        const list = Array.isArray(d) ? d : (d?.transactions || d?.rows || []);
        setTransactions(list);
      }
    } catch (err: any) {
      toast.error('Failed to load wallet data');
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleAmountChange = (newAmt: string) => {
    setAmount(newAmt);
    if (appliedCoupon) {
      const parsed = parseFloat(newAmt || '0');
      if (parsed < (appliedCoupon.coupon?.min_recharge_amount || 0)) {
        setCouponError(`Coupon removed: requires min recharge of ₹${appliedCoupon.coupon?.min_recharge_amount}`);
        setAppliedCoupon(null);
      }
    }
  };

  const handlePresetSelect = (presetAmt: number) => {
    handleAmountChange(presetAmt.toString());
  };

  const handleApplyCoupon = async (codeToApply?: string, customAmount?: number) => {
    const code = (codeToApply || couponCodeInput).trim().toUpperCase();
    const amt = customAmount !== undefined ? customAmount : Number(amount) || 0;

    if (!code) {
      setCouponError('Please enter a coupon code.');
      return;
    }
    if (!amt || amt <= 0) {
      setCouponError('Please enter a recharge amount first.');
      return;
    }

    setCouponError('');
    setValidatingCoupon(true);

    try {
      const res = await apiClient.post('/wallet/recharge/validate-coupon', {
        code,
        amount: amt,
      });

      if (res.data?.success) {
        setAppliedCoupon(res.data.data);
        setCouponCodeInput(code);
        setCouponError('');
        toast.success(`Coupon ${code} applied successfully!`);
      } else {
        setCouponError(res.data?.error?.message || 'Invalid coupon');
      }
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || err.response?.data?.message || 'Failed to apply coupon';
      setCouponError(msg);
      toast.error(msg);
      setAppliedCoupon(null);
    } finally {
      setValidatingCoupon(false);
    }
  };

  const handleSelectCoupon = async (coupon: any) => {
    let targetAmount = Number(amount) || 0;
    if (!targetAmount || targetAmount < Number(coupon.min_recharge_amount || 0)) {
      targetAmount = Number(coupon.min_recharge_amount || 500);
      setAmount(targetAmount.toString());
    }
    setCouponCodeInput(coupon.code);
    await handleApplyCoupon(coupon.code, targetAmount);
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCodeInput('');
    setCouponError('');
    toast('Coupon removed');
  };

  const loadRazorpayScript = () =>
    new Promise<void>((resolve) => {
      if ((window as any).Razorpay) return resolve();
      if (document.getElementById('rzp-script')) return resolve();
      const s = document.createElement('script');
      s.id = 'rzp-script';
      s.src = 'https://checkout.razorpay.com/v1/checkout.js';
      s.onload = () => resolve();
      document.body.appendChild(s);
    });

  const handleInitiatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmt = Number(amount);
    if (!numAmt || numAmt < 1) {
      toast.error('Minimum recharge amount is ₹1');
      return;
    }

    try {
      setInitiating(true);
      const initiatePayload: any = {
        amount: numAmt,
        gateway: selectedGateway,
      };
      if (appliedCoupon) {
        initiatePayload.coupon_code = appliedCoupon.coupon?.code;
      }

      const res = await apiClient.post('/wallet/recharge/initiate', initiatePayload);

      if (res.data.success) {
        const { recharge_id, checkout_params, gateway } = res.data.data;
        
        if (gateway === 'razorpay' && checkout_params) {
          await loadRazorpayScript();
          const options = {
            key: checkout_params.key,
            amount: checkout_params.amount,
            currency: checkout_params.currency || 'INR',
            name: checkout_params.name || 'Nanoshipy Wallet Recharge',
            description: checkout_params.description || `Recharge ₹${numAmt}`,
            order_id: checkout_params.order_id,
            prefill: {
              name: user?.name || '',
              email: user?.email || '',
              contact: user?.phone || ''
            },
            handler: async (response: any) => {
              try {
                const verifyRes = await apiClient.post(`/wallet/recharge/${recharge_id}/verify`, {
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                });
                if (verifyRes.data.success) {
                  const bonusMsg = verifyRes.data.data?.coupon_bonus > 0
                    ? ` (Includes ₹${verifyRes.data.data.coupon_bonus} coupon bonus!)`
                    : '';
                  toast.success(`₹${numAmt} wallet recharge successful!${bonusMsg}`);
                  fetchWalletData();
                  setAppliedCoupon(null);
                  setCouponCodeInput('');
                } else {
                  toast.error('Payment verification failed');
                }
              } catch (vErr) {
                toast.error('Verification failed');
              }
            },
            modal: {
              ondismiss: () => {
                toast('Recharge cancelled');
                setInitiating(false);
              }
            }
          };
          const rzp = new (window as any).Razorpay(options);
          rzp.on('payment.failed', (resp: any) => {
            toast.error(resp.error?.description || 'Payment failed at gateway');
            setInitiating(false);
          });
          rzp.open();
        } else {
          toast.success(`Initiated ₹${numAmt} recharge`);
          fetchWalletData();
        }
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || err.response?.data?.message || 'Payment initiation failed');
    } finally {
      setInitiating(false);
    }
  };

  const numAmount = Number(amount) || 0;
  let payableBase = numAmount;
  let bonusCredit = 0;
  let discountAmount = 0;

  if (appliedCoupon) {
    if (appliedCoupon.benefit_type === 'discount') {
      discountAmount = appliedCoupon.benefit_amount;
      payableBase = Math.max(0, numAmount - discountAmount);
    } else if (appliedCoupon.benefit_type === 'bonus_credit') {
      bonusCredit = appliedCoupon.benefit_amount;
    }
  }

  const convenienceFee = Math.round(payableBase * (gstSettings.fee_percent / 100) * 100) / 100;
  const gstAmount = gstSettings.enabled && convenienceFee > 0
    ? Math.round(convenienceFee * (gstSettings.gst_percent / 100) * 100) / 100
    : 0;
  const totalPayable = payableBase + convenienceFee + gstAmount;
  const totalWalletCredit = numAmount + bonusCredit;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Topbar Title */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-[var(--ink)]">Wallet</h1>
        <div className="text-xs text-[var(--muted)] mt-0.5">Keep your balance topped up so orders never stall</div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Balance & Add Money */}
        <div className="lg:col-span-7 space-y-5">
          {/* Signature Dark Violet Balance Card */}
          <div className="bg-gradient-to-br from-[#120e24] via-[#1a1236] to-[#0f0b1e] border border-purple-500/20 rounded-2xl p-6 text-white flex flex-col sm:flex-row sm:items-end justify-between gap-4 shadow-xl relative overflow-hidden">
            <div className="w-48 h-48 rounded-full bg-[#8410DC]/15 blur-2xl pointer-events-none absolute -top-10 -right-10" />
            <div className="relative z-10">
              <div className="text-xs text-purple-200/80 mb-2 font-medium flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Available balance
              </div>
              <div className="text-3xl sm:text-4xl font-black tracking-tight text-white tabular-nums">
                ₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                <span className="text-sm sm:text-base text-purple-300 font-semibold ml-1.5">INR</span>
              </div>
            </div>
            <div className="text-left sm:text-right relative z-10">
              <div className="text-xs text-purple-300/80 mb-1 font-medium">Last recharge</div>
              <div className="text-xs font-semibold text-white">₹{lastRecharge.amount.toLocaleString('en-IN')} · {lastRecharge.date}</div>
            </div>
          </div>

          {/* Add Money Card */}
          <div
            className="border rounded-2xl overflow-hidden shadow-sm"
            style={{
              backgroundColor: 'var(--surface)',
              borderColor: 'var(--line)',
            }}
          >
            <div className="p-4 sm:p-5 border-b border-[var(--line)]">
              <h3 className="text-[15px] font-bold text-[var(--ink)]">Add money</h3>
              <div className="text-xs text-[var(--muted)] mt-0.5">Funds reflect instantly after payment is confirmed by the gateway</div>
            </div>

            <form onSubmit={handleInitiatePayment} className="p-4 sm:p-5 space-y-4">
              {/* Presets */}
              <div className="flex gap-2 flex-wrap">
                {(gstSettings.presets || [500, 1000, 2000, 5000]).map((p: number) => {
                  const isSelected = amount === p.toString();
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => handlePresetSelect(p)}
                      className={`rounded-xl px-4 py-2 text-xs font-bold cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-gradient-to-r from-[#5B069A] to-[#8410DC] text-white border-transparent shadow-md shadow-purple-950/20'
                          : 'border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:border-[#8410DC] hover:text-[#8410DC]'
                      }`}
                    >
                      ₹{p.toLocaleString('en-IN')}
                    </button>
                  );
                })}
              </div>

              {/* Amount Box */}
              <div
                className="border rounded-xl p-3.5 flex items-center gap-2"
                style={{
                  backgroundColor: 'var(--bg)',
                  borderColor: 'var(--line)',
                }}
              >
                <span className="text-xl text-[#8410DC] font-black">₹</span>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  placeholder="1000"
                  className="w-full bg-transparent text-xl sm:text-2xl font-black text-[var(--ink)] focus:outline-none"
                />
              </div>

              {/* Coupon Code & Offers Section */}
              <div className="border-t border-[var(--line)] pt-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[var(--ink)] flex items-center gap-1.5">
                    <Ticket className="w-3.5 h-3.5 text-[#8410DC]" />
                    Have a coupon code?
                  </label>
                  {availableCoupons.length > 0 && (
                    <span className="text-[10px] font-semibold text-[#8410DC] bg-[#8410DC]/10 px-2 py-0.5 rounded-full">
                      {availableCoupons.length} Active {availableCoupons.length === 1 ? 'Offer' : 'Offers'}
                    </span>
                  )}
                </div>

                {!appliedCoupon ? (
                  <div className="space-y-1.5">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={couponCodeInput}
                        onChange={(e) => setCouponCodeInput(e.target.value.toUpperCase())}
                        placeholder="Enter coupon code (e.g. WELCOME100)"
                        className="flex-1 uppercase font-mono font-bold text-xs px-3.5 py-2.5 rounded-xl border focus:outline-none focus:border-[#8410DC]"
                        style={{
                          backgroundColor: 'var(--bg)',
                          borderColor: 'var(--line)',
                          color: 'var(--ink)',
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => handleApplyCoupon()}
                        disabled={validatingCoupon || !couponCodeInput.trim() || !numAmount}
                        className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#5B069A] to-[#8410DC] hover:from-[#4d0582] hover:to-[#730ec2] disabled:opacity-50 text-white font-bold text-xs transition shadow-sm flex items-center gap-1.5 shrink-0 cursor-pointer"
                      >
                        {validatingCoupon ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Tag className="w-3.5 h-3.5" />
                        )}
                        Apply
                      </button>
                    </div>
                    {couponError && (
                      <p className="text-rose-500 text-xs font-medium flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {couponError}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                        <Sparkles className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400">
                            {appliedCoupon.coupon?.code}
                          </span>
                          <span className="text-[10px] font-semibold px-1.5 py-0.2 bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 rounded">
                            Applied
                          </span>
                        </div>
                        <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                          {appliedCoupon.benefit_type === 'bonus_credit'
                            ? `+₹${appliedCoupon.benefit_amount.toFixed(2)} Extra Bonus Wallet Credit`
                            : `₹${appliedCoupon.benefit_amount.toFixed(2)} Discount on Recharge`}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveCoupon}
                      className="text-[var(--muted)] hover:text-rose-500 p-1.5 rounded-lg transition cursor-pointer"
                      title="Remove coupon"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Available Offers Cards */}
                {availableCoupons.length > 0 && (
                  <div className="pt-1 space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-[var(--muted)]">
                      <span className="font-semibold text-[var(--ink)] flex items-center gap-1">
                        <Gift className="w-3.5 h-3.5 text-[#8410DC]" />
                        Available Offers for You
                      </span>
                      <span>Click offer to apply</span>
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                      {availableCoupons.map((coupon) => {
                        const isCurrentApplied = appliedCoupon?.coupon?.code === coupon.code;
                        const isMinMet = numAmount >= (coupon.min_recharge_amount || 0);

                        return (
                          <div
                            key={coupon.id || coupon.code}
                            className={`p-2.5 rounded-xl border transition-all ${
                              isCurrentApplied
                                ? 'border-emerald-500/50 bg-emerald-500/10'
                                : 'border-[var(--line)] bg-[var(--surface)] hover:border-[#8410DC]/50 hover:bg-purple-500/5'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2.5">
                              <div className="space-y-0.5 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-mono font-bold text-xs text-[#8410DC] dark:text-[#C084FC] bg-purple-500/15 px-1.5 py-0.5 rounded border border-purple-500/30">
                                    {coupon.code}
                                  </span>
                                  <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300">
                                    {coupon.benefit_type === 'bonus_credit' ? `+₹${coupon.discount_value} BONUS` : `${coupon.discount_value}% OFF`}
                                  </span>
                                </div>
                                <p className="text-xs font-semibold text-[var(--ink)] truncate">
                                  {coupon.title}
                                </p>
                                <p className="text-[11px] text-[var(--muted)] leading-tight line-clamp-2">
                                  {coupon.description}
                                </p>
                                <div className="flex items-center gap-2 text-[10px] text-[var(--muted)] pt-0.5">
                                  <span>Min: ₹{coupon.min_recharge_amount?.toLocaleString('en-IN')}</span>
                                  {coupon.max_discount_amount && coupon.discount_type === 'percentage' && (
                                    <span>• Max off: ₹{coupon.max_discount_amount}</span>
                                  )}
                                </div>
                              </div>

                              <div className="shrink-0 flex flex-col items-end gap-1">
                                {isCurrentApplied ? (
                                  <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/20 px-2.5 py-1 rounded-lg">
                                    <Check className="w-3 h-3" /> Applied
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleSelectCoupon(coupon)}
                                    disabled={validatingCoupon}
                                    className="flex items-center gap-1 text-[11px] font-semibold text-white bg-gradient-to-r from-[#5B069A] to-[#8410DC] hover:from-[#4d0582] hover:to-[#730ec2] px-3 py-1 rounded-lg transition shadow-xs cursor-pointer disabled:opacity-50"
                                  >
                                    Apply
                                    <ArrowRight className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Price Breakdown */}
              <div
                className="rounded-xl p-3.5 space-y-2 border text-xs"
                style={{
                  backgroundColor: 'var(--bg)',
                  borderColor: 'var(--line)',
                }}
              >
                <div className="flex justify-between text-[var(--muted)]">
                  <span>Base recharge amount</span>
                  <span className="font-semibold text-[var(--ink)]">₹{numAmount.toFixed(2)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                    <span className="flex items-center gap-1">
                      <Percent className="w-3 h-3" /> Coupon discount ({appliedCoupon?.coupon?.code})
                    </span>
                    <span className="font-bold">- ₹{discountAmount.toFixed(2)}</span>
                  </div>
                )}
                {bonusCredit > 0 && (
                  <div className="flex justify-between text-[#8410DC] dark:text-[#C084FC] font-medium bg-[#8410DC]/10 p-2 rounded-lg border border-[#8410DC]/25">
                    <span className="flex items-center gap-1 font-bold">
                      <Sparkles className="w-3 h-3 text-[#8410DC]" /> Coupon bonus credit
                    </span>
                    <span className="font-black">+ ₹{bonusCredit.toFixed(2)}</span>
                  </div>
                )}
                {gstSettings.fee_percent > 0 && (
                  <div className="flex justify-between text-[var(--muted)]">
                    <span>Payment gateway fee ({gstSettings.fee_percent}%)</span>
                    <span className="text-[var(--ink)] font-semibold">₹{convenienceFee.toFixed(2)}</span>
                  </div>
                )}
                {gstAmount > 0 && (
                  <div className="flex justify-between text-[var(--muted)]">
                    <span>GST ({gstSettings.gst_percent}%)</span>
                    <span className="text-[var(--ink)] font-semibold">₹{gstAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-[var(--muted)]">
                  <span className="flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    GST invoice
                  </span>
                  <span className="text-emerald-500 font-semibold">
                    {gstSettings.enabled ? 'Auto-generated' : 'Not applicable'}
                  </span>
                </div>
                <div className="flex justify-between border-t border-[var(--line)] pt-2 font-bold text-sm text-[var(--ink)]">
                  <span>Total payable</span>
                  <span className="text-[#8410DC] dark:text-[#D6A8FF] font-black text-base">₹{totalPayable.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold text-xs pt-0.5">
                  <span>Total wallet balance to receive</span>
                  <span>₹{totalWalletCredit.toFixed(2)}</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={initiating}
                className="w-full bg-gradient-to-r from-[#5B069A] to-[#8410DC] hover:from-[#4d0582] hover:to-[#730ec2] disabled:opacity-50 text-white font-bold text-sm py-3.5 rounded-xl shadow-md shadow-purple-950/25 transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-[0.99]"
              >
                {initiating ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Proceed to pay ₹{totalPayable.toFixed(2)}</span>}
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Recharge History */}
        <div className="lg:col-span-5">
          <div
            className="border rounded-2xl overflow-hidden shadow-sm"
            style={{
              backgroundColor: 'var(--surface)',
              borderColor: 'var(--line)',
            }}
          >
            <div className="p-4 sm:p-5 border-b border-[var(--line)]">
              <h3 className="text-[15px] font-bold text-[var(--ink)]">Recharge history</h3>
            </div>

            <div className="divide-y divide-[var(--line)]">
              {loadingHistory ? (
                <div className="p-8 text-center text-xs text-[var(--muted)]">Loading history...</div>
              ) : transactions.length === 0 ? (
                <div className="p-8 text-center text-xs text-[var(--muted)]">No recharges recorded yet.</div>
              ) : (
                transactions.map((tx, idx) => (
                  <div key={tx.id || idx} className="p-4 flex items-center justify-between hover:bg-purple-500/5 transition-colors">
                    <div>
                      <div className="font-bold text-xs text-[var(--ink)]">
                        ₹{parseFloat(tx.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-[11.5px] text-[var(--muted)] mt-0.5">
                        {tx.gateway_name || 'Razorpay'} · {new Date(tx.created_at || Date.now()).toLocaleDateString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className={`text-xs font-semibold flex items-center gap-1 justify-end ${
                        tx.status === 'success' ? 'text-emerald-500' : tx.status === 'pending' || tx.status === 'initiated' ? 'text-amber-500' : 'text-rose-500'
                      }`}>
                        <span>●</span>
                        <span className="capitalize">{tx.status}</span>
                      </div>
                      {tx.status === 'pending' || tx.status === 'initiated' ? (
                        <div className="text-[11px] text-[#8410DC] font-semibold cursor-pointer hover:underline mt-0.5">
                          Verify payment
                        </div>
                      ) : tx.status === 'failed' ? (
                        <div className="text-[11px] text-[#8410DC] font-semibold cursor-pointer hover:underline mt-0.5">
                          Retry
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Complete Ledger Section */}
      <div className="mt-8 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-[var(--ink)]">Wallet Ledger & Dispatch Debits</h2>
            <p className="text-xs text-[var(--muted)]">Complete record of topups, freight debits, RTO fees, and refunds.</p>
          </div>
          <button
            onClick={() => fetchLedgerData(ledgerPage)}
            className="flex items-center space-x-1.5 text-xs font-bold text-[#8410DC] hover:underline cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingLedger ? 'animate-spin' : ''}`} />
            <span>Refresh Ledger</span>
          </button>
        </div>

        <TransactionTable
          transactions={ledgerTransactions}
          pagination={ledgerPagination}
          onPageChange={(p) => setLedgerPage(p)}
        />
      </div>
    </div>
  );
}
