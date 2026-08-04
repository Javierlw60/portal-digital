'use client';

import React, { useState } from 'react';

const inputClassName =
  'w-full bg-slate-800 border border-slate-600 text-white placeholder:text-slate-400 rounded-xl px-4 py-3 pr-12 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500';

interface PasswordFieldProps {
  id?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  minLength?: number;
  placeholder?: string;
  labelClassName?: string;
  autoComplete?: string;
}

export function PasswordField({
  id = 'password',
  label = 'Contraseña',
  value,
  onChange,
  required = true,
  minLength = 6,
  placeholder,
  labelClassName = 'block text-xs font-medium text-slate-300 mb-1',
  autoComplete = 'current-password',
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label htmlFor={id} className={labelClassName}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          required={required}
          minLength={minLength}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className={inputClassName}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-0 px-3 flex items-center text-slate-400 hover:text-white"
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          tabIndex={0}
        >
          {visible ? (
            <EyeOffIcon className="w-5 h-5" />
          ) : (
            <EyeIcon className="w-5 h-5" />
          )}
        </button>
      </div>
    </div>
  );
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 12s3.75-6.75 9.75-6.75S21.75 12 21.75 12s-3.75 6.75-9.75 6.75S2.25 12 2.25 12z"
      />
      <circle cx="12" cy="12" r="2.75" />
    </svg>
  );
}

function EyeOffIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.98 8.223A10.477 10.477 0 001.5 12s3.75 6.75 10.5 6.75c1.61 0 3.11-.3 4.45-.84M9.88 9.88A2.75 2.75 0 0114.12 14.12M6.23 6.23C7.86 5.15 9.84 4.5 12 4.5c6.75 0 10.5 7.5 10.5 7.5a18.12 18.12 0 01-2.16 3.19M3 3l18 18"
      />
    </svg>
  );
}

export const authInputClassName =
  'w-full bg-slate-800 border border-slate-600 text-white placeholder:text-slate-400 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500';

export const authLabelClassName = 'block text-xs font-medium text-slate-300 mb-1';
