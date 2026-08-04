'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMensaje('');

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (error) {
      setMensaje(error.message);
      return;
    }

    router.push('/cuenta');
    router.refresh();
  };

  return (
    <main className="flex-1 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
        <h1 className="text-2xl font-bold text-center">Ingresar</h1>
        <p className="text-sm text-slate-400 text-center mt-2 mb-6">
          Accedé con tu email verificado
        </p>

        {mensaje && (
          <div className="mb-4 p-3 rounded-xl text-sm text-center bg-red-500/20 text-red-300 border border-red-500/30">
            {mensaje}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500"
              placeholder="tu@email.com"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Contraseña</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 font-semibold py-3 rounded-xl disabled:opacity-50"
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
