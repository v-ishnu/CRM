'use client';

import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, icon, className = '', id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block font-mono text-[11px] font-bold uppercase tracking-wider text-[#a1a1aa] mb-1.5"
          >
            {label}
            {props.required && <span className="text-[#ff3e00] ml-1">*</span>}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#71717a] pointer-events-none">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={`w-full bg-[#0d0d10] border rounded-sm px-3.5 py-2.5 text-xs sm:text-sm text-[#f5f5f2] placeholder-[#52525b] outline-none transition-all duration-150 ${
              icon ? 'pl-10' : ''
            } ${
              error
                ? 'border-red-500/60 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                : 'border-[#27272a] focus:border-[#ff3e00] focus:ring-1 focus:ring-[#ff3e00]'
            } disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
            {...props}
          />
        </div>
        {error ? (
          <p className="font-mono text-[10px] text-red-400 mt-1">{error}</p>
        ) : hint ? (
          <p className="font-mono text-[10px] text-[#71717a] mt-1">{hint}</p>
        ) : null}
      </div>
    );
  }
);
Input.displayName = 'Input';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, hint, className = '', id, children, ...props }, ref) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={selectId}
            className="block font-mono text-[11px] font-bold uppercase tracking-wider text-[#a1a1aa] mb-1.5"
          >
            {label}
            {props.required && <span className="text-[#ff3e00] ml-1">*</span>}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={`w-full bg-[#0d0d10] border rounded-sm px-3.5 py-2.5 text-xs sm:text-sm text-[#f5f5f2] outline-none transition-all duration-150 ${
            error
              ? 'border-red-500/60 focus:border-red-500 focus:ring-1 focus:ring-red-500'
              : 'border-[#27272a] focus:border-[#ff3e00] focus:ring-1 focus:ring-[#ff3e00]'
          } disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
          {...props}
        >
          {children}
        </select>
        {error ? (
          <p className="font-mono text-[10px] text-red-400 mt-1">{error}</p>
        ) : hint ? (
          <p className="font-mono text-[10px] text-[#71717a] mt-1">{hint}</p>
        ) : null}
      </div>
    );
  }
);
Select.displayName = 'Select';

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, className = '', id, rows = 3, ...props }, ref) => {
    const textareaId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={textareaId}
            className="block font-mono text-[11px] font-bold uppercase tracking-wider text-[#a1a1aa] mb-1.5"
          >
            {label}
            {props.required && <span className="text-[#ff3e00] ml-1">*</span>}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          rows={rows}
          className={`w-full bg-[#0d0d10] border rounded-sm px-3.5 py-2.5 text-xs sm:text-sm text-[#f5f5f2] placeholder-[#52525b] outline-none transition-all duration-150 resize-y ${
            error
              ? 'border-red-500/60 focus:border-red-500 focus:ring-1 focus:ring-red-500'
              : 'border-[#27272a] focus:border-[#ff3e00] focus:ring-1 focus:ring-[#ff3e00]'
          } disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
          {...props}
        />
        {error ? (
          <p className="font-mono text-[10px] text-red-400 mt-1">{error}</p>
        ) : hint ? (
          <p className="font-mono text-[10px] text-[#71717a] mt-1">{hint}</p>
        ) : null}
      </div>
    );
  }
);
Textarea.displayName = 'Textarea';
