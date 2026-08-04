'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import { normalizeSlug } from '@/lib/slug';
import { isAdminProfile } from '@/lib/auth';
import {
  clearPendingNegocio,
  readPendingNegocio,
} from '@/lib/pending-negocio';

interface FavoritoRow {
  id: number;
  negocio_id: number;
  negocios: {
    id: number;
    nombre_comercio: string;
    slug: string;
    localidad: string | null;
    rubro: string | null;
  } | null;
}

export default function CuentaPage() {
  const router = useRouter();
  const { user, profile, loading, refreshProfile } = useAuth();
  const [favoritos, setFavoritos] = useState<FavoritoRow[]>([]);
  const [cargandoFav, setCargandoFav] = useState(true);

  // Completar registro de comercio pendiente tras confirmar email
  useEffect(() => {
    if (loading || !user) return;
    const pending = readPendingNegocio();
    if (!pending) return;
    if (profile?.negocio_id) {
      clearPendingNegocio();
      return;
    }

    let cancelled = false;
    (async () => {
      const supabase = createClient();
      try {
        const { data: inserted, error } = await supabase
          .from('negocios')
          .insert([
            {
              nombre_comercio: pending.nombre_comercio,
              domicilio: pending.domicilio,
              localidad: pending.slugLocalidad,
              partido: pending.partido,
              provincia: pending.provincia,
              pais: pending.pais,
              rubro: pending.rubro,
              slug: pending.slug,
              owner_id: user.id,
              tema_id: 1,
            },
          ])
          .select('id')
          .single();

        if (error) throw error;

        await supabase
          .from('profiles')
          .update({ role: 'comercio', negocio_id: inserted.id })
          .eq('id', user.id);

        clearPendingNegocio();
        await refreshProfile();
        if (!cancelled) {
          router.replace(`/${pending.slugLocalidad}/${pending.slug}`);
        }
      } catch (err) {
        console.warn('Pendiente comercio:', err);
        clearPendingNegocio();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, loading, profile?.negocio_id, refreshProfile, router]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }

    let cancelled = false;
    const supabase = createClient();
    setCargandoFav(true);
    supabase
      .from('favoritos')
      .select(
        'id, negocio_id, negocios(id, nombre_comercio, slug, localidad, rubro)'
      )
      .eq('user_id', user.id)
      .order('id', { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.warn(error);
          setFavoritos([]);
        } else {
          setFavoritos((data as unknown as FavoritoRow[]) || []);
        }
        setCargandoFav(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <main className="flex-1 flex items-center justify-center p-6">
        <p className="text-slate-400 animate-pulse">Cargando cuenta…</p>
      </main>
    );
  }

  return (
    <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <section className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
        <h1 className="text-2xl font-bold">Mi cuenta</h1>
        <p className="text-slate-400 text-sm mt-1">{user.email}</p>
        <p className="text-xs text-slate-500 mt-2">
          Rol: <span className="text-slate-300">{profile?.role || 'usuario'}</span>
        </p>
        <div className="flex flex-wrap gap-2 mt-4">
          {isAdminProfile(profile) && (
            <Link
              href="/admin"
              className="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-3 py-2 rounded-xl text-sm font-medium"
            >
              Ir al Admin
            </Link>
          )}
          {(profile?.role === 'comercio' || isAdminProfile(profile)) &&
            !profile?.negocio_id && (
              <Link
                href="/registro"
                className="bg-blue-600 hover:bg-blue-500 px-3 py-2 rounded-xl text-sm font-medium"
              >
                Completar datos del negocio
              </Link>
            )}
        </div>
      </section>

      <section className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
        <div className="flex justify-between items-center gap-2">
          <h2 className="text-lg font-bold">Favoritos</h2>
          <span className="text-xs text-slate-500">
            Alertas de precios: próximamente
          </span>
        </div>

        {cargandoFav ? (
          <p className="text-slate-500 text-sm">Cargando favoritos…</p>
        ) : favoritos.length === 0 ? (
          <p className="text-slate-500 text-sm">
            Todavía no guardaste comercios.{' '}
            <Link href="/" className="text-blue-400 hover:underline">
              Explorar localidades
            </Link>
          </p>
        ) : (
          <ul className="space-y-3">
            {favoritos.map((fav) => {
              const n = fav.negocios;
              if (!n) return null;
              const href = `/${normalizeSlug(n.localidad || 'local')}/${normalizeSlug(n.slug)}`;
              return (
                <li key={fav.id}>
                  <Link
                    href={href}
                    className="block bg-slate-800/60 border border-slate-700 rounded-2xl p-4 hover:border-blue-500/40 transition"
                  >
                    <p className="font-semibold">{n.nombre_comercio}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {n.rubro || 'Comercio'}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
