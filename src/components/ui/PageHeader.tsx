'use client';

import React from 'react';

export interface PageHeaderProps {
  title: string;
  description?: string;
  tag?: string;
  action?: React.ReactNode;
  actions?: React.ReactNode;
}

export function PageHeader({
  title,
  description,
  tag,
  action,
  actions,
}: PageHeaderProps) {
  const headerActions = actions || action;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#242428]">
      <div>
        {tag && (
          <div className="flex items-center gap-2 mb-1.5">
            <span className="font-mono text-[10px] uppercase tracking-widest font-bold text-[#ff3e00]">
              {tag}
            </span>
            <span className="text-[#3f3f46]">/</span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#71717a]">
              Operations
            </span>
          </div>
        )}
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-white">
          {title}
        </h1>
        {description && (
          <p className="text-xs sm:text-sm text-[#a1a1aa] mt-1 leading-relaxed max-w-3xl">
            {description}
          </p>
        )}
      </div>
      {headerActions && <div className="flex items-center gap-2.5 shrink-0 flex-wrap">{headerActions}</div>}
    </div>
  );
}
