import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', label, error, helperText, ...props }, ref) => {
    return (
      <div className="w-full space-y-1">
        {label && <label className="block text-xs font-semibold text-[#534F66]">{label}</label>}
        <input
          ref={ref}
          className={`block w-full rounded-xl border border-[#E8DEF2] bg-white text-[#14121F] placeholder-[#7E7994] shadow-sm transition-all focus:border-[#5B069A] focus:outline-none focus:ring-1 focus:ring-[#5B069A] text-sm px-3.5 py-2 ${
            error ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500' : ''
          } ${className}`}
          {...props}
        />
        {helperText && !error && <p className="text-[11px] text-[#7E7994]">{helperText}</p>}
        {error && <p className="text-[11px] font-medium text-rose-600">{error}</p>}
      </div>
    );
  }
);
Input.displayName = 'Input';
