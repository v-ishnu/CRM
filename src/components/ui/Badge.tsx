'use client';

import React from 'react';

export type BadgeVariant =
  | 'orange'
  | 'green'
  | 'active'
  | 'success'
  | 'warning'
  | 'amber'
  | 'danger'
  | 'red'
  | 'blue'
  | 'info'
  | 'purple'
  | 'neutral';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  dot?: boolean;
  pulse?: boolean;
  size?: 'sm' | 'md';
}

export function Badge({
  children,
  variant = 'neutral',
  dot = false,
  pulse = false,
  size = 'md',
  className = '',
  ...props
}: BadgeProps) {
  const sizeStyles = {
    sm: 'text-[9px] px-1.5 py-0.5 tracking-wider',
    md: 'text-[10px] px-2 py-0.5 tracking-wider',
  };

  const variantStyles: Record<BadgeVariant, { container: string; dot: string }> = {
    orange: {
      container: 'border-[#ff3e00]/40 text-[#ff3e00] bg-[#ff3e00]/5',
      dot: 'bg-[#ff3e00]',
    },
    green: {
      container: 'border-[#00d664]/40 text-[#00d664] bg-[#00d664]/5',
      dot: 'bg-[#00d664]',
    },
    active: {
      container: 'border-[#00d664]/40 text-[#00d664] bg-[#00d664]/5',
      dot: 'bg-[#00d664]',
    },
    success: {
      container: 'border-[#00d664]/40 text-[#00d664] bg-[#00d664]/5',
      dot: 'bg-[#00d664]',
    },
    warning: {
      container: 'border-amber-500/40 text-amber-400 bg-amber-500/5',
      dot: 'bg-amber-400',
    },
    amber: {
      container: 'border-amber-500/40 text-amber-400 bg-amber-500/5',
      dot: 'bg-amber-400',
    },
    danger: {
      container: 'border-red-500/40 text-red-400 bg-red-500/5',
      dot: 'bg-red-400',
    },
    red: {
      container: 'border-red-500/40 text-red-400 bg-red-500/5',
      dot: 'bg-red-400',
    },
    blue: {
      container: 'border-sky-500/40 text-sky-400 bg-sky-500/5',
      dot: 'bg-sky-400',
    },
    info: {
      container: 'border-sky-500/40 text-sky-400 bg-sky-500/5',
      dot: 'bg-sky-400',
    },
    purple: {
      container: 'border-purple-500/40 text-purple-400 bg-purple-500/5',
      dot: 'bg-purple-400',
    },
    neutral: {
      container: 'border-[#27272a] text-[#a1a1aa] bg-white/[0.02]',
      dot: 'bg-[#71717a]',
    },
  };

  const current = variantStyles[variant] || variantStyles.neutral;

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-mono font-bold uppercase border rounded-xs select-none ${sizeStyles[size]} ${current.container} ${className}`}
      {...props}
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${current.dot} ${pulse ? 'animate-pulse' : ''}`}
        />
      )}
      {children}
    </span>
  );
}
