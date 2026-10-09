'use client';

import React, { useState, useEffect } from 'react';
import { PlanCard, PlanDetails } from '@/components/subscription/PlanCard';
import { PlanComparisonTable } from '@/components/subscription/PlanComparisonTable';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_URL } from '@/lib/env';
import { apiClient } from '@/lib/apiClient';
import Link from 'next/link';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

export default function ComparePlansPage() {
  const [plans, setPlans] = useState<PlanDetails[]>([]);
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);
  const [pendingPlanId, setPendingPlanId] = useState<string | null>(null);
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly');
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmPlanModal, setConfirmPlanModal] = useState<{
    isOpen: boolean;
    plan?: PlanDetails;
    planCycle?: 'monthly' | 'yearly';
  }>({ isOpen: false });

  useEffect(() => {
    fetchPlansAndSubscription();
  }, []);

  const fetchPlansAndSubscription = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch comparison list
      const [plansRes, subscriptionRes] = await Promise.all([
        apiClient.get('/subscription/plans'),
        apiClient.get('/subscription'),
      ]);

      const plansBody = plansRes.data;
      const subBody = subscriptionRes.data;

      setPlans(plansBody.data);
      if (subBody.data?.plan) {
        setCurrentPlanId(subBody.data.plan.id);
        setCycle(subBody.data.billing_cycle || 'monthly');
      }
      if (subBody.data?.pending_plan) {
        setPendingPlanId(subBody.data.pending_plan.id);
      }
    } catch (err: any) {
      setError(err.message || 'Error occurred while loading plans');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlan = (planId: string, planCycle: 'monthly' | 'yearly') => {
    const selected = plans.find(p => p.id === planId);
    if (!selected) return;
    setConfirmPlanModal({ isOpen: true, plan: selected, planCycle });
  };

  const executePlanChange = async () => {
    const { plan, planCycle } = confirmPlanModal;
    if (!plan || !planCycle) return;

    try {
      setSubmitting(true);
      
      const res = await apiClient.post('/subscription/change', {
        plan_id: plan.id,
        billing_cycle: planCycle,
      });

      const body = res.data;

      if (body.data.effective === 'deferred') {
        toast.success('Downgrade scheduled! It will take effect at the end of the billing period.');
      } else {
        toast.success('Upgrade completed! Prorated fee debited from your virtual wallet.');
      }
      
      setConfirmPlanModal({ isOpen: false });
      fetchPlansAndSubscription();
    } catch (err: any) {
      toast.error(err.message || 'Payment upgrade transaction failed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-12 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#8410DC]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto p-4">
      {/* Navigation & Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
        <div>
          <Link href="/settings/subscription" className="inline-flex items-center text-xs text-[#8410DC] font-bold hover:underline mb-2">
            <ArrowLeft className="h-4.5 w-4.5 mr-1" />
            <span>Back to overview</span>
          </Link>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Compare Pricing Plans</h1>
          <p className="text-xs text-[#7E7994] mt-1">
            Choose the subscription plan that aligns with your monthly shipment volume.
          </p>
        </div>

        {/* Cycle Toggle Switch */}
        <div className="inline-flex p-1 bg-slate-100 rounded-xl">
          <button
            onClick={() => setCycle('monthly')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              cycle === 'monthly' ? 'bg-white text-slate-900 shadow-sm' : 'text-[#7E7994] hover:text-slate-700'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setCycle('yearly')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              cycle === 'yearly' ? 'bg-white text-slate-900 shadow-sm' : 'text-[#7E7994] hover:text-slate-700'
            }`}
          >
            Yearly (Save 15%)
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl p-4 flex items-center space-x-2">
          <ShieldAlert className="h-5 w-5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Plans Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
        {plans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            isCurrent={plan.id === currentPlanId}
            isPending={plan.id === pendingPlanId}
            cycle={cycle}
            onSelect={handleSelectPlan}
            loading={submitting}
          />
        ))}
      </div>

      {/* Comparison Grid section */}
      <div className="space-y-4 pt-4 border-t border-[#F2ECF7]">
        <h3 className="text-sm font-black text-[#14121F] tracking-tight">Compare Feature Matrix</h3>
        <PlanComparisonTable plans={plans} />
      </div>

      <ConfirmModal
        isOpen={confirmPlanModal.isOpen}
        onClose={() => setConfirmPlanModal({ isOpen: false })}
        onConfirm={executePlanChange}
        title={confirmPlanModal.plan?.price_monthly === 0 ? 'Change Plan' : 'Upgrade Plan Subscription'}
        description={
          confirmPlanModal.plan?.price_monthly === 0
            ? `Are you sure you want to change your subscription to the ${confirmPlanModal.plan?.name} plan?`
            : `Are you sure you want to change your subscription to ${confirmPlanModal.plan?.name} on the ${confirmPlanModal.planCycle} billing cycle? Prorated differences will be adjusted from your account wallet.`
        }
        confirmText="Confirm Change"
        variant="primary"
        isLoading={submitting}
      />
    </div>
  );
}
