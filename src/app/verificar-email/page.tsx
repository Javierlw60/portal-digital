'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

function Contenido() {
  const params = useSearchParams();
  const email = params.get('email');

  return (
    <main className="flex-1 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-center">
        <h1 className="text-2xl font-bold">Revisá tu correo</h1>
        <p className="text-slate-400 mt-3 text-sm leading-relaxed">
          Te enviamos un enlace de confirmación
          {email ? (
            <>
              {' '}
              a <span className="text-white font-medium">{email}</span>
            </>
          ) : null}
          . Abrí el mail (remitente noreply@portal-digital.com.ar) y confirmá tu
          cuenta para continuar.
        </p>
        <Link
          href="/login"
          className="inline-block mt-6 bg-blue-600 hover:bg-blue-500 px-5 py-2.5 rounded-xl font-medium"
        >
          Ir a Ingresar
        </Link>
      </div>
    </main>
  );
}

export default function VerificarEmailPage() {
  return (
    <Suspense
      fallback={
        <main className="flex-1 flex items-center justify-center p-4">
          <p className="text-slate-400">Cargando…</p>
        </main>
      }
    >
      <Contenido />
    </Suspense>
  );
}
