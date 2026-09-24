'use client';

import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverEffect?: boolean;
}

export function Card({
  children,
  hoverEffect = false,
  className = '',
  ...props
}: CardProps) {
  return (
    <div
      className={`bg-[#141416] border border-[#242428] rounded-sm p-4 sm:p-6 relative transition-all duration-200 ${
        hoverEffect ? 'hover:border-[#ff3e00]/40 hover:bg-[#161619]' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  children,
  className = '',
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 mb-4 border-b border-[#242428] ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  children,
  className = '',
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={`text-sm sm:text-base font-bold text-white tracking-tight ${className}`}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardDescription({
  children,
  className = '',
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={`text-xs text-[#a1a1aa] mt-0.5 leading-relaxed ${className}`} {...props}>
      {children}
    </p>
  );
}

export interface StatCardProps {
  label: string;
  value: string | number;
  description?: string;
  icon?: React.ReactNode;
  trend?: string;
  trendDirection?: 'up' | 'down' | 'neutral';
  accentColor?: string;
  className?: string;
}

export function StatCard({
  label,
  value,
  description,
  icon,
  trend,
  trendDirection = 'neutral',
  className = '',
}: StatCardProps) {
  return (
    <div
      className={`bg-[#141416] border border-[#242428] p-5 sm:p-6 rounded-sm relative group hover:border-[#ff3e00]/40 transition-all duration-200 ${className}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <span className="font-mono text-[10px] uppercase font-bold tracking-widest text-[#a1a1aa]">
            {label}
          </span>
          <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-mono">
            {value}
          </div>
          {description && (
            <p className="text-xs text-[#71717a] mt-1.5 leading-relaxed">
              {description}
            </p>
          )}
          {trend && (
            <div className="mt-2 flex items-center gap-1.5 text-xs font-mono">
              <span
                className={
                  trendDirection === 'up'
                    ? 'text-[#00d664]'
                    : trendDirection === 'down'
                    ? 'text-red-400'
                    : 'text-[#a1a1aa]'
                }
              >
                {trend}
              </span>
            </div>
          )}
        </div>
        {icon && (
          <div className="p-2.5 bg-[#18181b] border border-[#27272a] rounded-sm text-[#ff3e00] group-hover:border-[#ff3e00]/40 transition-colors">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
