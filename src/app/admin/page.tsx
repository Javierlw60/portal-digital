'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import { ADMIN_EMAIL, isAdminProfile, type UserRole } from '@/lib/auth';
import { normalizeSlug } from '@/lib/slug';

interface NegocioAdmin {
  id: number;
  nombre_comercio: string;
  slug: string;
  localidad: string | null;
  rubro: string | null;
  owner_id: string | null;
}

interface ProfileAdmin {
  id: string;
  email: string | null;
  role: UserRole;
  negocio_id: number | null;
}

export default function AdminPage() {
  const router = useRouter();
  const { user, profile, loading, refreshProfile } = useAuth();
  const supabase = createClient();
  const [negocios, setNegocios] = useState<NegocioAdmin[]>([]);
  const [profiles, setProfiles] = useState<ProfileAdmin[]>([]);
  const [mensaje, setMensaje] = useState('');

  const allowed = isAdminProfile(profile) || user?.email?.toLowerCase() === ADMIN_EMAIL;

  useEffect(() => {
    if (loading) return;
    if (!user || !allowed) {
      router.replace('/login');
      return;
    }

    (async () => {
      const [{ data: neg }, { data: prof }] = await Promise.all([
        supabase
          .from('negocios')
          .select('id, nombre_comercio, slug, localidad, rubro, owner_id')
          .order('id', { ascending: false })
          .limit(100),
        supabase
          .from('profiles')
          .select('id, email, role, negocio_id')
          .order('created_at', { ascending: false })
          .limit(100),
      ]);
      setNegocios((neg as NegocioAdmin[]) || []);
      setProfiles((prof as ProfileAdmin[]) || []);
    })();
  }, [user, loading, allowed, router, supabase]);

  const cambiarRol = async (profileId: string, role: UserRole) => {
    setMensaje('');
    const { error } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', profileId);
    if (error) {
      setMensaje(error.message);
      return;
    }
    setProfiles((prev) =>
      prev.map((p) => (p.id === profileId ? { ...p, role } : p))
    );
    await refreshProfile();
    setMensaje('Rol actualizado.');
  };

  if (loading || !user || !allowed) {
    return (
      <main className="flex-1 flex items-center justify-center p-6">
        <p className="text-slate-400">Verificando acceso admin…</p>
      </main>
    );
  }

  return (
    <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <section>
        <h1 className="text-2xl sm:text-3xl font-bold text-amber-300">Panel Admin</h1>
        <p className="text-sm text-slate-400 mt-1">
          Acceso: {ADMIN_EMAIL}
        </p>
        {mensaje && (
          <p className="mt-3 text-sm text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2">
            {mensaje}
          </p>
        )}
      </section>

      <section className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-4">
        <h2 className="text-lg font-bold">Comercios ({negocios.length})</h2>
        <div className="space-y-3">
          {negocios.map((n) => (
            <div
              key={n.id}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-slate-800/50 border border-slate-700 rounded-2xl p-4"
            >
              <div>
                <p className="font-semibold">{n.nombre_comercio}</p>
                <p className="text-xs text-slate-400">
                  {n.rubro || 'Sin rubro'} · {n.localidad || '—'}
                </p>
              </div>
              <Link
                href={`/${normalizeSlug(n.localidad || 'local')}/${normalizeSlug(n.slug)}`}
                className="text-sm text-blue-400 hover:underline"
              >
                Ver ficha
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-4">
        <h2 className="text-lg font-bold">Usuarios / Roles ({profiles.length})</h2>
        <div className="space-y-3">
          {profiles.map((p) => (
            <div
              key={p.id}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-800/50 border border-slate-700 rounded-2xl p-4"
            >
              <div>
                <p className="font-medium text-sm break-all">{p.email || p.id}</p>
                <p className="text-xs text-slate-400 mt-1">
                  Rol actual: {p.role}
                  {p.negocio_id ? ` · negocio #${p.negocio_id}` : ''}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(['usuario', 'comercio', 'admin'] as UserRole[]).map((role) => (
                  <button
                    key={role}
                    type="button"
                    disabled={p.role === role}
                    onClick={() => cambiarRol(p.id, role)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-slate-600 disabled:opacity-40 hover:bg-slate-700"
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
