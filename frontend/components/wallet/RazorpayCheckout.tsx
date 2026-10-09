import React, { useEffect, useState } from 'react';
import { CreditCard, Loader2 } from 'lucide-react';

interface RazorpayCheckoutProps {
  rzpKeyId: string;
  gatewayOrderId: string;
  amount: number;
  customerName: string;
  customerEmail: string;
  onPaymentSuccess: (data: { gateway_payment_id: string; gateway_signature: string }) => void;
  onPaymentCancel: () => void;
}

export function RazorpayCheckout({
  rzpKeyId,
  gatewayOrderId,
  amount,
  customerName,
  customerEmail,
  onPaymentSuccess,
  onPaymentCancel,
}: RazorpayCheckoutProps) {
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 1. Dynamic Script Loader
    const loadRazorpayScript = () => {
      if ((window as any).Razorpay) {
        setScriptLoaded(true);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => setScriptLoaded(true);
      script.onerror = () => setError('Failed to load payment gateway script. Check internet connectivity.');
      document.body.appendChild(script);
    };

    loadRazorpayScript();
  }, []);

  const handlePay = () => {
    if (!scriptLoaded || !(window as any).Razorpay) return;

    setError(null);
    const options = {
      key: rzpKeyId,
      amount: amount * 100, // paise
      currency: 'INR',
      name: 'ShippingSaaS Wallet',
      description: `Recharge Order: ${gatewayOrderId}`,
      order_id: gatewayOrderId,
      handler: function (response: any) {
        onPaymentSuccess({
          gateway_payment_id: response.razorpay_payment_id,
          gateway_signature: response.razorpay_signature,
        });
      },
      prefill: {
        name: customerName,
        email: customerEmail,
      },
      theme: {
        color: '#4f46e5', // Premium indigo brand style
      },
      modal: {
        ondismiss: function () {
          onPaymentCancel();
        },
      },
    };

    const rzp = new (window as any).Razorpay(options);
    rzp.open();
  };

  // Launch checkout immediately on script load
  useEffect(() => {
    if (scriptLoaded) {
      handlePay();
    }
  }, [scriptLoaded]);

  return (
    <div className="bg-white dark:bg-[#131620] text-slate-900 dark:text-white rounded-2xl p-8 max-w-sm mx-auto text-center space-y-6 shadow-2xl border border-slate-200 dark:border-white/[0.06]">
      <div className="mx-auto w-12 h-12 bg-purple-50 dark:bg-purple-950/40 text-[#8410DC] dark:text-[#D6A8FF] border border-purple-100/50 dark:border-indigo-900/30 rounded-full flex items-center justify-center">
        <CreditCard className="h-6 w-6 animate-pulse" />
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-bold">Secure Recharge Gateway</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">Launching payment gateway window to capture ₹{amount.toFixed(2)}...</p>
      </div>

      {error ? (
        <p className="text-xs text-rose-500 font-semibold">{error}</p>
      ) : (
        <div className="flex items-center justify-center space-x-2 text-xs text-slate-450 dark:text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin text-[#8410DC]" />
          <span>Securing checkout tunnel...</span>
        </div>
      )}

      <button
        onClick={handlePay}
        disabled={!scriptLoaded}
        className="w-full bg-gradient-to-r from-[#5B069A] to-[#8410DC] hover:from-[#4d0582] hover:to-[#730ec2] disabled:bg-slate-100 dark:disabled:bg-slate-800 text-white text-xs font-bold py-3 rounded-xl transition outline-none"
      >
        Re-launch checkout portal
      </button>
    </div>
  );
}
