'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import {
  PasswordField,
  authInputClassName,
  authLabelClassName,
} from '@/components/PasswordField';
import { defaultPostAuthPath } from '@/lib/auth';
import { syncProfileWithOwnedNegocio } from '@/lib/owned-negocio';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState(() => searchParams.get('mensaje') || '');
  const verified = searchParams.get('verified') === '1';
  const nextParam = searchParams.get('next');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMensaje('');

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setLoading(false);
      setMensaje(error.message);
      return;
    }

    const userId = data.user?.id;
    let destination = '/cuenta';

    if (userId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, email, negocio_id')
        .eq('id', userId)
        .maybeSingle();

      const negocio = await syncProfileWithOwnedNegocio(
        supabase,
        userId,
        profile?.negocio_id,
        profile?.role,
        profile?.email ?? data.user?.email
      );

      destination = defaultPostAuthPath({
        role: profile?.role,
        email: profile?.email ?? data.user?.email,
        hasNegocio: Boolean(negocio || profile?.negocio_id),
        next: nextParam,
      });
    }

    setLoading(false);
    router.push(destination);
    router.refresh();
  };

  return (
    <main className="flex-1 flex items-center justify-center p-4 bg-slate-950 text-white">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
        <h1 className="text-2xl font-bold text-center text-white">Ingresar</h1>
        <p className="text-sm text-slate-400 text-center mt-2 mb-6">
          Accedé con tu email verificado
        </p>

        {(mensaje || verified) && (
          <div
            className={`mb-4 p-3 rounded-xl text-sm text-center border ${
              verified || mensaje.includes('éxito') || mensaje.includes('verificado')
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                : 'bg-red-500/20 text-red-300 border-red-500/30'
            }`}
          >
            {mensaje ||
              '¡Correo verificado con éxito! Por favor ingresa a tu cuenta.'}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="login-email" className={authLabelClassName}>
              Email
            </label>
            <input
              id="login-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={authInputClassName}
              placeholder="tu@email.com"
              autoComplete="email"
            />
          </div>
          <PasswordField
            id="login-password"
            value={password}
            onChange={setPassword}
            labelClassName={authLabelClassName}
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-xl disabled:opacity-50"
          >
            {loading ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>

        <p className="text-sm text-slate-400 text-center mt-6">
          ¿No tenés cuenta?{' '}
          <Link href="/registro-usuario" className="text-blue-400 hover:underline">
            Crear cuenta
          </Link>
          {' · '}
          <Link href="/registro" className="text-blue-400 hover:underline">
            Soy comercio
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex-1 flex items-center justify-center p-4 bg-slate-950">
          <p className="text-slate-400">Cargando…</p>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
