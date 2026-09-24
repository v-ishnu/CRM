'use client';

import React from 'react';

export interface StatusBeaconProps {
  status?: 'operational' | 'warning' | 'error' | 'idle';
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
  dotColor?: string;
}

export function StatusBeacon({
  status = 'operational',
  label,
  size = 'md',
  className = '',
  dotColor,
}: StatusBeaconProps) {
  const dotStyles = {
    operational: 'bg-[#00d664] status-beacon',
    warning: 'bg-amber-400 status-beacon-orange',
    error: 'bg-red-500 animate-ping',
    idle: 'bg-[#71717a]',
  };

  const textStyles = {
    operational: 'text-[#00d664]',
    warning: 'text-amber-400',
    error: 'text-red-400',
    idle: 'text-[#71717a]',
  };

  const dotSize = size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5';
  const customDot = dotColor ? `${dotColor} status-beacon` : dotStyles[status];

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <span className="relative flex items-center justify-center">
        <span className={`${dotSize} rounded-full ${customDot}`} />
      </span>
      {label && (
        <span
          className={`font-mono text-[10px] tracking-widest uppercase font-bold ${
            dotColor ? 'text-white' : textStyles[status]
          }`}
        >
          {label}
        </span>
      )}
    </div>
  );
}
