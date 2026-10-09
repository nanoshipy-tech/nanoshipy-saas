import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'primary', size = 'md', isLoading, children, disabled, ...props }, ref) => {
    const baseStyle = 'inline-flex justify-center items-center font-medium rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

    const sizeStyles = {
      sm: 'px-3 py-1.5 text-xs',
      md: 'px-4 py-2 text-sm',
      lg: 'px-6 py-2.5 text-base',
    };

    const variants = {
      primary: 'bg-gradient-to-r from-[#5B069A] to-[#8410DC] text-white hover:opacity-95 shadow-sm active:scale-[0.98] focus:ring-[#5B069A]',
      secondary: 'bg-slate-100 text-[#14121F] hover:bg-slate-200 border border-[#E8DEF2] focus:ring-[#5B069A]',
      outline: 'border border-[#E8DEF2] bg-white text-[#14121F] hover:bg-slate-50 focus:ring-[#5B069A]',
      danger: 'bg-rose-600 text-white hover:bg-rose-700 shadow-sm active:scale-[0.98] focus:ring-rose-500',
      ghost: 'text-[#534F66] hover:text-[#14121F] hover:bg-slate-100 focus:ring-[#5B069A]',
    };

    return (
      <button
        ref={ref}
        className={`${baseStyle} ${sizeStyles[size]} ${variants[variant]} ${className}`}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && (
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        )}
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';
