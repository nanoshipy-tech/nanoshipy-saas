'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/apiClient';
import { useRouter } from 'next/navigation';
import {
  Zap, ArrowLeft, Shield, CreditCard, CheckCircle, RefreshCw,
  AlertCircle, Receipt, Ticket, Sparkles, X, Tag, Percent, Gift, Check, ArrowRight
} from 'lucide-react';
import Link from 'next/link';

declare global { interface Window { Razorpay: any; } }

export default function WalletRechargePage() {
  const [amount, setAmount] = useState('');
  const [config, setConfig] = useState<any>({
    gateway: 'razorpay',
    min_recharge: 1,
    max_recharge: 100000,
    presets: [100, 500, 1000, 2000, 5000],
    fee_percent: 0,
    auto_gst_invoice: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [rechargeReceipt, setRechargeReceipt] = useState<any>(null);

  // Coupon state
  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [couponError, setCouponError] = useState('');
  const [availableCoupons, setAvailableCoupons] = useState<any[]>([]);
  const [loadingCoupons, setLoadingCoupons] = useState(false);

  const router = useRouter();

  useEffect(() => {
    fetchConfig();
    fetchCoupons();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await apiClient.get('/wallet/recharge/config');
      if (res.data.success) {
        setConfig(res.data.data);
      }
    } catch (err) {
      console.warn('Failed to load recharge config');
    }
  };

  const fetchCoupons = async () => {
    setLoadingCoupons(true);
    try {
      const res = await apiClient.get('/wallet/recharge/coupons');
      if (res.data?.success && Array.isArray(res.data?.data?.coupons)) {
        setAvailableCoupons(res.data.data.coupons);
      }
    } catch (err) {
      console.warn('Failed to load available coupons');
    } finally {
      setLoadingCoupons(false);
    }
  };

  const loadRazorpayScript = () =>
    new Promise<void>((resolve) => {
      if (document.getElementById('rzp-script')) return resolve();
      const s = document.createElement('script');
      s.id = 'rzp-script';
      s.src = 'https://checkout.razorpay.com/v1/checkout.js';
      s.onload = () => resolve();
      document.body.appendChild(s);
    });

  const numAmount = parseFloat(amount || '0');

  // Coupon calculations
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

  const feeAmount = (payableBase * (config.fee_percent || 0)) / 100;
  const gstAmount = config.auto_gst_invoice ? (feeAmount * 0.18) : 0;
  const totalAmount = payableBase + feeAmount + gstAmount;
  const totalWalletCredit = numAmount + bonusCredit;

  const handleApplyCoupon = async (codeToApply?: string, customAmount?: number) => {
    const code = (codeToApply || couponCodeInput).trim().toUpperCase();
    const amt = customAmount !== undefined ? customAmount : numAmount;

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
      } else {
        setCouponError(res.data?.error?.message || 'Invalid coupon');
      }
    } catch (err: any) {
      setCouponError(err.response?.data?.error?.message || err.response?.data?.message || 'Failed to apply coupon');
      setAppliedCoupon(null);
    } finally {
      setValidatingCoupon(false);
    }
  };

  const handleSelectCoupon = async (coupon: any) => {
    let targetAmount = numAmount;
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
  };

  const handleAmountChange = (newAmt: string) => {
    setAmount(newAmt);
    // If user changes amount significantly below min_recharge of applied coupon, notify or revalidate
    if (appliedCoupon) {
      const parsed = parseFloat(newAmt || '0');
      if (parsed < appliedCoupon.coupon?.min_recharge_amount) {
        setCouponError(`Coupon removed: requires min recharge of ₹${appliedCoupon.coupon?.min_recharge_amount}`);
        setAppliedCoupon(null);
      }
    }
  };

  const handleRecharge = async () => {
    if (!numAmount || numAmount < config.min_recharge) {
      setError(`Minimum recharge amount is ₹${config.min_recharge}`);
      return;
    }
    if (numAmount > config.max_recharge) {
      setError(`Maximum recharge amount limit is ₹${config.max_recharge.toLocaleString('en-IN')}`);
      return;
    }
    setError('');
    setLoading(true);

    try {
      const initiatePayload: any = { amount: numAmount };
      if (appliedCoupon) {
        initiatePayload.coupon_code = appliedCoupon.coupon?.code;
      }

      const { data } = await apiClient.post('/wallet/recharge/initiate', initiatePayload);
      if (!data.success) throw new Error(data.error?.message || 'Failed to initiate recharge');

      const { recharge_id, checkout_params, gateway } = data.data;

      if (gateway === 'razorpay') {
        await loadRazorpayScript();
        const options = {
          key: checkout_params.key,
          amount: checkout_params.amount,
          currency: checkout_params.currency || 'INR',
          name: checkout_params.name || 'Nanoshipy',
          description: checkout_params.description || 'Wallet Recharge',
          order_id: checkout_params.order_id,
          handler: async (response: any) => {
            try {
              const verifyRes = await apiClient.post(`/wallet/recharge/${recharge_id}/verify`, {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              });

              if (verifyRes.data.success) {
                setRechargeReceipt({
                  amount: verifyRes.data.data.amount || totalWalletCredit,
                  base_amount: numAmount,
                  bonus_amount: verifyRes.data.data.coupon_bonus || bonusCredit,
                  new_balance: verifyRes.data.data.new_balance,
                  coupon_code: appliedCoupon?.coupon?.code,
                });
                setSuccess(true);
                setTimeout(() => router.push('/wallet'), 3500);
              } else {
                setError('Payment verification failed');
              }
            } catch (vErr: any) {
              setError(vErr.response?.data?.error?.message || 'Verification error');
            }
          },
          theme: { color: '#8410DC' },
          modal: { ondismiss: () => setLoading(false) },
        };

        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', (resp: any) => {
          setError(resp.error?.description || 'Payment failed at gateway');
          setLoading(false);
        });
        rzp.open();
      } else {
        // Manual verification flow
        const verifyRes = await apiClient.post(`/wallet/recharge/${recharge_id}/verify`, {});
        if (verifyRes.data.success) {
          setSuccess(true);
          setTimeout(() => router.push('/wallet'), 2500);
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <div
          className="text-center border p-8 rounded-3xl shadow-2xl max-w-md w-full space-y-4"
          style={{
            backgroundColor: 'var(--surface)',
            borderColor: 'var(--line)',
            color: 'var(--ink)',
          }}
        >
          <div className="flex items-center justify-center w-20 h-20 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 mx-auto">
            <CheckCircle className="w-10 h-10 text-emerald-500" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-[var(--ink)]">Wallet Credited Successfully!</h2>
          
          <div className="space-y-1">
            <p className="text-base font-bold text-[var(--ink)]">
              ₹{(rechargeReceipt?.amount || totalWalletCredit).toFixed(2)} added to your wallet
            </p>
            {rechargeReceipt?.bonus_amount > 0 && (
              <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 rounded-full inline-block border border-emerald-200 dark:border-emerald-800">
                🎉 Includes ₹{rechargeReceipt.bonus_amount.toFixed(2)} Bonus Credit via Coupon {rechargeReceipt.coupon_code}!
              </p>
            )}
          </div>

          {rechargeReceipt?.new_balance && (
            <div
              className="p-3 rounded-xl border text-xs flex items-center justify-between"
              style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--line)' }}
            >
              <span className="text-[var(--muted)] font-medium">New Wallet Balance:</span>
              <span className="font-extrabold text-emerald-500 text-sm">₹{rechargeReceipt.new_balance.toFixed(2)}</span>
            </div>
          )}
          <p className="text-[var(--muted)] text-xs mt-2 animate-pulse">Redirecting to wallet overview...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-6 px-1 sm:px-0">
      <div className="flex items-center gap-3">
        <Link
          href="/wallet"
          className="nano-btn-secondary w-9 h-9 p-0 flex items-center justify-center rounded-xl"
          title="Back to wallet"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[var(--ink)]">Add Money to Wallet</h1>
          <p className="text-xs sm:text-sm text-[var(--muted)]">Online instant recharge via UPI, Cards, Netbanking</p>
        </div>
      </div>

      <div
        className="rounded-2xl border p-5 sm:p-6 space-y-5 shadow-sm"
        style={{
          backgroundColor: 'var(--surface)',
          borderColor: 'var(--line)',
        }}
      >
        {/* Amount Input */}
        <div>
          <label className="block text-[11.5px] font-bold uppercase tracking-wider text-[var(--muted)] mb-2">Recharge Amount</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8410DC] font-extrabold text-xl">₹</span>
            <input
              type="number"
              value={amount}
              onChange={e => handleAmountChange(e.target.value)}
              placeholder="0.00"
              min={config.min_recharge}
              max={config.max_recharge}
              step={100}
              className="w-full pl-9 pr-4 py-3.5 text-2xl font-black rounded-xl border focus:outline-none focus:border-[#8410DC] focus:ring-2 focus:ring-[#8410DC]/20 transition-all"
              style={{
                backgroundColor: 'var(--bg)',
                borderColor: 'var(--line)',
                color: 'var(--ink)',
              }}
            />
          </div>
          {error && <p className="text-rose-500 text-xs mt-2 font-medium">{error}</p>}
        </div>

        {/* Quick Presets */}
        <div>
          <p className="text-[11.5px] text-[var(--muted)] mb-2 font-semibold uppercase tracking-wider">Quick Preset Amounts</p>
          <div className="flex flex-wrap gap-2">
            {(config.presets || [500, 1000, 2000, 5000]).map((preset: number) => {
              const isSelected = amount === String(preset);
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handleAmountChange(preset.toString())}
                  className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-gradient-to-r from-[#5B069A] to-[#8410DC] text-white border-transparent shadow-md shadow-purple-950/20'
                      : 'border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:border-[#8410DC] hover:text-[#8410DC]'
                  }`}
                >
                  + ₹{preset.toLocaleString('en-IN')}
                </button>
              );
            })}
          </div>
        </div>

        {/* Coupon Code Section */}
        <div className="pt-3 border-t border-[var(--line)] space-y-3">
          <label className="text-[11.5px] font-bold uppercase tracking-wider text-[var(--muted)] flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Ticket className="w-3.5 h-3.5 text-[#8410DC]" />
              Have a Coupon Code?
            </span>
            {availableCoupons.length > 0 && (
              <span className="text-[10px] font-semibold text-[#8410DC] bg-[#8410DC]/10 px-2 py-0.5 rounded-full">
                {availableCoupons.length} Active {availableCoupons.length === 1 ? 'Offer' : 'Offers'}
              </span>
            )}
          </label>

          {!appliedCoupon ? (
            <div className="space-y-1.5">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={couponCodeInput}
                  onChange={e => setCouponCodeInput(e.target.value.toUpperCase())}
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
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Tag className="w-3.5 h-3.5" />
                  )}
                  Apply
                </button>
              </div>
              {couponError && (
                <p className="text-rose-500 text-xs font-medium flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  {couponError}
                </p>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-black text-xs text-emerald-600 dark:text-emerald-400">
                      {appliedCoupon.coupon?.code}
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.2 bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 rounded">
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

          {/* Available Offers & Coupons Section */}
          {availableCoupons.length > 0 && (
            <div className="pt-2 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[var(--ink)] flex items-center gap-1">
                  <Gift className="w-3.5 h-3.5 text-[#8410DC]" />
                  Available Offers for You
                </span>
                <span className="text-[10px] text-[var(--muted)]">Click any offer to apply</span>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                {availableCoupons.map((coupon) => {
                  const isCurrentApplied = appliedCoupon?.coupon?.code === coupon.code;
                  const isMinMet = numAmount >= (coupon.min_recharge_amount || 0);

                  return (
                    <div
                      key={coupon.id || coupon.code}
                      className={`relative overflow-hidden p-3 rounded-xl border transition-all ${
                        isCurrentApplied
                          ? 'border-emerald-500/50 bg-emerald-500/10 shadow-xs'
                          : 'border-[var(--line)] bg-[var(--surface)] hover:border-[#8410DC]/60 hover:bg-purple-500/5'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-black text-xs text-[#8410DC] dark:text-[#C084FC] bg-purple-500/15 px-2 py-0.5 rounded border border-purple-500/30">
                              {coupon.code}
                            </span>
                            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300">
                              {coupon.benefit_type === 'bonus_credit' ? `+₹${coupon.discount_value} BONUS` : `${coupon.discount_value}% OFF`}
                            </span>
                          </div>
                          <p className="text-xs font-bold text-[var(--ink)] truncate">
                            {coupon.title}
                          </p>
                          <p className="text-[11px] text-[var(--muted)] leading-tight">
                            {coupon.description}
                          </p>
                          <div className="flex items-center gap-2 text-[10px] text-[var(--muted)] pt-0.5">
                            <span>Min recharge: ₹{coupon.min_recharge_amount?.toLocaleString('en-IN')}</span>
                            {coupon.max_discount_amount && coupon.discount_type === 'percentage' && (
                              <span>• Max discount: ₹{coupon.max_discount_amount}</span>
                            )}
                          </div>
                        </div>

                        <div className="shrink-0 flex flex-col items-end gap-1.5">
                          {isCurrentApplied ? (
                            <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/20 px-2.5 py-1 rounded-lg">
                              <Check className="w-3 h-3" /> Applied
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleSelectCoupon(coupon)}
                              disabled={validatingCoupon}
                              className="flex items-center gap-1 text-[11px] font-bold text-white bg-gradient-to-r from-[#5B069A] to-[#8410DC] hover:from-[#4d0582] hover:to-[#730ec2] px-3 py-1.5 rounded-lg transition shadow-xs cursor-pointer disabled:opacity-50"
                            >
                              Apply
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          )}
                          {!isMinMet && !isCurrentApplied && (
                            <span className="text-[9px] text-[var(--muted)] whitespace-nowrap">
                              Auto-sets ₹{coupon.min_recharge_amount}
                            </span>
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

        {/* Fee & GST Breakdown */}
        {numAmount > 0 && (
          <div
            className="p-4 rounded-xl border space-y-2 text-xs"
            style={{
              backgroundColor: 'var(--bg)',
              borderColor: 'var(--line)',
            }}
          >
            <div className="flex justify-between text-[var(--muted)]">
              <span>Base Recharge</span>
              <span className="font-bold text-[var(--ink)]">₹{numAmount.toFixed(2)}</span>
            </div>

            {discountAmount > 0 && (
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                <span className="flex items-center gap-1">
                  <Percent className="w-3 h-3" /> Coupon Discount ({appliedCoupon?.coupon?.code})
                </span>
                <span className="font-bold">- ₹{discountAmount.toFixed(2)}</span>
              </div>
            )}

            {bonusCredit > 0 && (
              <div className="flex justify-between text-[#8410DC] dark:text-[#C084FC] font-medium bg-[#8410DC]/10 p-2 rounded-lg border border-[#8410DC]/25">
                <span className="flex items-center gap-1 font-bold">
                  <Sparkles className="w-3 h-3 text-[#8410DC]" /> Coupon Bonus Credit
                </span>
                <span className="font-black">+ ₹{bonusCredit.toFixed(2)}</span>
              </div>
            )}

            {feeAmount > 0 && (
              <div className="flex justify-between text-[var(--muted)]">
                <span>Convenience Fee ({config.fee_percent}%)</span>
                <span className="text-[var(--ink)]">₹{feeAmount.toFixed(2)}</span>
              </div>
            )}

            {gstAmount > 0 && (
              <div className="flex justify-between text-[var(--muted)]">
                <span>GST (18%)</span>
                <span className="text-[var(--ink)]">₹{gstAmount.toFixed(2)}</span>
              </div>
            )}

            <div className="border-t border-[var(--line)] pt-2.5 flex justify-between font-bold text-sm">
              <span className="text-[var(--ink)]">Total Payable</span>
              <span className="text-[#8410DC] dark:text-[#D6A8FF] font-extrabold text-base">₹{totalAmount.toFixed(2)}</span>
            </div>

            <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold text-xs pt-1">
              <span>Total Wallet Balance to Receive</span>
              <span>₹{totalWalletCredit.toFixed(2)}</span>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <button
          onClick={handleRecharge}
          disabled={loading || !numAmount}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-[#5B069A] to-[#8410DC] hover:from-[#4d0582] hover:to-[#730ec2] disabled:opacity-50 text-white font-bold text-sm transition-all shadow-md shadow-purple-950/30 cursor-pointer active:scale-[0.99]"
        >
          {loading ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <CreditCard className="w-4 h-4" />
          )}
          {loading ? 'Initiating Checkout...' : `Proceed to Pay ₹${totalAmount.toFixed(2)}`}
        </button>
      </div>

      <div className="flex items-center gap-2.5 text-[var(--muted)] text-xs px-2 justify-center text-center">
        <Shield className="w-4 h-4 text-emerald-500 shrink-0" />
        <span>Secured by 256-bit SSL encryption. Instant recharge via UPI, Cards & Netbanking.</span>
      </div>
    </div>
  );
}
