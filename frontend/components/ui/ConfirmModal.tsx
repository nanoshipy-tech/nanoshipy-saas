'use client';

import React, { useEffect } from 'react';
import { AlertTriangle, Info, CheckCircle2, X } from 'lucide-react';
import { Button } from './Button';

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description?: React.ReactNode;
  message?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'primary' | 'warning';
  isLoading?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'primary',
  isLoading = false,
}) => {
  const bodyContent = description || message;
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isLoading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  const iconConfig = {
    danger: {
      icon: AlertTriangle,
      bg: 'bg-rose-50',
      text: 'text-rose-600',
      btnVariant: 'danger' as const,
    },
    warning: {
      icon: AlertTriangle,
      bg: 'bg-amber-50',
      text: 'text-amber-600',
      btnVariant: 'primary' as const,
    },
    primary: {
      icon: Info,
      bg: 'bg-violet-50',
      text: 'text-[#5B069A]',
      btnVariant: 'primary' as const,
    },
  };

  const currentConfig = iconConfig[variant] || iconConfig.primary;
  const IconComponent = currentConfig.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#14121F]/40 backdrop-blur-sm transition-opacity">
      <div
        className="w-full max-w-md bg-white rounded-2xl border border-[#E8DEF2] shadow-2xl overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-headline"
      >
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-xl flex-shrink-0 ${currentConfig.bg}`}>
              <IconComponent className={`w-6 h-6 ${currentConfig.text}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h3 id="modal-headline" className="text-base font-bold text-[#14121F]">
                  {title}
                </h3>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isLoading}
                  className="text-[#7E7994] hover:text-[#14121F] p-1 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="mt-2 text-xs text-[#534F66] leading-relaxed">
                {bodyContent}
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-slate-50/60 border-t border-[#F2ECF7] flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isLoading}
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            variant={currentConfig.btnVariant}
            size="sm"
            onClick={onConfirm}
            isLoading={isLoading}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
};
