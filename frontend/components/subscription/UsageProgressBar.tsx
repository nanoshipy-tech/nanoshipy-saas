import React from 'react';

interface UsageProgressBarProps {
  label: string;
  current: number;
  limit: number | null;
}

export function UsageProgressBar({ label, current, limit }: UsageProgressBarProps) {
  const isUnlimited = limit === null;
  const ratio = isUnlimited ? 0 : Math.min(100, Math.round((current / limit) * 100));

  let colorClass = 'bg-[#8410DC] dark:bg-[#8410DC]';
  if (!isUnlimited) {
    if (ratio >= 90) {
      colorClass = 'bg-rose-500 animate-pulse';
    } else if (ratio >= 75) {
      colorClass = 'bg-amber-500';
    }
  }

  return (
    <div className="space-y-2 text-xs">
      <div className="flex justify-between font-bold text-slate-700 dark:text-slate-200">
        <span>{label}</span>
        <span>
          {current} / {isUnlimited ? '∞' : limit}
        </span>
      </div>
      
      {/* Track */}
      <div className="h-2 w-full bg-slate-100 dark:bg-white/[0.04] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${colorClass}`}
          style={{ width: `${isUnlimited ? 100 : ratio}%` }}
        />
      </div>
      
      {!isUnlimited && ratio >= 75 && (
        <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
          {ratio >= 90 ? 'Critical limit reached. Upgrade immediately!' : 'Approaching plan limit capacity.'}
        </p>
      )}
    </div>
  );
}
