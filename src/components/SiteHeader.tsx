'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';

export function SiteHeader() {
  const { user, profile, loading, isAdmin, signOut } = useAuth();
  const hasNegocio = Boolean(profile?.negocio_id);
  const esComercio = profile?.role === 'comercio' || isAdmin;

  return (
    <header className="border-b border-slate-800 bg-slate-950/90 backdrop-blur-md sticky top-0 z-50">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-3 sm:py-4 flex justify-between items-center gap-3">
        <Link href="/" className="flex items-center gap-2 min-w-0">
          <span className="bg-blue-500 text-white font-black text-sm sm:text-xl px-2.5 py-1 sm:px-3 rounded-xl shrink-0">
            PD
          </span>
          <span className="text-base sm:text-xl font-bold tracking-tight text-white truncate">
            Portal Digital
          </span>
        </Link>

        <nav className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm">
          {!loading && !user && (
            <>
              <Link
                href="/login"
                className="text-slate-300 hover:text-white px-2 sm:px-3 py-2 rounded-lg transition"
              >
                Ingresar
              </Link>
              <Link
                href="/registro"
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-2 sm:text-sm sm:px-4 sm:py-2.5 rounded-xl font-medium transition shadow-lg shadow-blue-500/30 whitespace-nowrap"
              >
                Sumar mi Negocio
              </Link>
            </>
          )}

          {!loading && user && (
            <>
              <Link
                href="/cuenta"
                className="text-slate-300 hover:text-white px-2 sm:px-3 py-2 rounded-lg transition"
              >
                Mi cuenta
              </Link>
              {hasNegocio ? (
                <Link
                  href="/mi-negocio"
                  className="text-blue-400 hover:text-blue-300 px-2 py-2 rounded-lg transition whitespace-nowrap"
                >
                  Mi negocio
                </Link>
              ) : esComercio ? (
                <Link
                  href="/registro"
                  className="text-blue-400 hover:text-blue-300 px-2 py-2 rounded-lg transition whitespace-nowrap"
                >
                  Completar negocio
                </Link>
              ) : null}
              {isAdmin ? (
                <Link
                  href="/admin"
                  className="text-amber-400 hover:text-amber-300 px-2 sm:px-3 py-2 rounded-lg transition"
                >
                  Admin
                </Link>
              ) : null}
              <button
                type="button"
                onClick={() => signOut()}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-2 rounded-xl font-medium transition"
              >
                Salir
              </button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
