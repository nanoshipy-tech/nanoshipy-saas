'use client';

import React from 'react';
import Link from 'next/link';
import { PackageOpen } from 'lucide-react';
import { Button } from './Button';

export interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  actionHref?: string;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon = PackageOpen,
  title,
  description,
  actionText,
  onAction,
  actionHref,
  className = '',
}) => {
  return (
    <div className={`flex flex-col items-center justify-center p-12 text-center bg-white rounded-2xl border border-dashed border-[#E8DEF2] ${className}`}>
      <div className="w-14 h-14 rounded-2xl bg-violet-50/80 border border-[#E8DEF2] flex items-center justify-center mb-4 text-[#5B069A] shadow-sm">
        <Icon className="w-7 h-7" />
      </div>
      <h3 className="text-base font-bold text-[#14121F] mb-1.5">{title}</h3>
      <p className="text-xs text-[#534F66] max-w-sm mb-6 leading-relaxed">
        {description}
      </p>
      {actionText && (
        actionHref ? (
          <Link href={actionHref}>
            <Button size="sm">{actionText}</Button>
          </Link>
        ) : (
          <Button size="sm" onClick={onAction}>
            {actionText}
          </Button>
        )
      )}
    </div>
  );
};
