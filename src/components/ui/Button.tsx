'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'brand' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      loading = false,
      icon,
      iconPosition = 'left',
      disabled,
      className = '',
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-mono font-bold tracking-wider uppercase transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff3e00] disabled:opacity-50 disabled:cursor-not-allowed select-none';

    const sizeStyles = {
      sm: 'px-2.5 py-1.5 text-[11px] gap-1.5 rounded-sm',
      md: 'px-4 py-2.5 text-xs gap-2 rounded-sm',
      lg: 'px-6 py-3 text-xs gap-2.5 rounded-sm',
    };

    const variantStyles = {
      primary:
        'bg-white text-black hover:bg-[#ff3e00] hover:text-white shadow-xs border border-transparent',
      brand:
        'bg-[#ff3e00] text-white hover:bg-[#e03700] shadow-xs border border-transparent',
      secondary:
        'bg-[#18181b] border border-[#27272a] text-[#f5f5f2] hover:border-[#ff3e00]/60 hover:text-white',
      outline:
        'border border-[#27272a] bg-transparent text-[#a1a1aa] hover:border-[#ff3e00] hover:text-[#ff3e00]',
      danger:
        'bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-600 hover:text-white hover:border-red-600',
      ghost:
        'bg-transparent text-[#a1a1aa] hover:text-white hover:bg-white/5 border border-transparent',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
        {...props}
      >
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          icon && iconPosition === 'left' && <span className="shrink-0">{icon}</span>
        )}
        <span>{children}</span>
        {!loading && icon && iconPosition === 'right' && (
          <span className="shrink-0">{icon}</span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
