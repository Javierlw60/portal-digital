'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';

export function FavoritoButton({
  negocioId,
  className = '',
}: {
  negocioId: number;
  className?: string;
}) {
  const { user } = useAuth();
  const supabase = createClient();
  const [activo, setActivo] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      setActivo(false);
      return;
    }
    let cancelled = false;
    const client = createClient();
    client
      .from('favoritos')
      .select('id')
      .eq('user_id', user.id)
      .eq('negocio_id', negocioId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setActivo(Boolean(data));
      });
    return () => {
      cancelled = true;
    };
  }, [user, negocioId]);

  if (!user) {
    return (
      <Link
        href="/login"
        onClick={(e) => e.stopPropagation()}
        className={`text-xs font-semibold text-slate-300 hover:text-white border border-slate-700 px-2.5 py-1.5 rounded-lg ${className}`}
      >
        Guardar
      </Link>
    );
  }

  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setLoading(true);
    try {
      if (activo) {
        await supabase
          .from('favoritos')
          .delete()
          .eq('user_id', user.id)
          .eq('negocio_id', negocioId);
        setActivo(false);
      } else {
        const { error } = await supabase.from('favoritos').insert({
          user_id: user.id,
          negocio_id: negocioId,
        });
        if (error) throw error;
        setActivo(true);
      }
    } catch (err) {
      console.warn(err);
      alert('No se pudo actualizar el favorito. ¿Ejecutaste el schema de favoritos en Supabase?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      disabled={loading}
      onClick={toggle}
      className={`text-xs font-semibold border px-2.5 py-1.5 rounded-lg transition disabled:opacity-50 ${
        activo
          ? 'bg-blue-600/20 text-blue-300 border-blue-500/40'
          : 'text-slate-300 hover:text-white border-slate-700'
      } ${className}`}
    >
      {activo ? 'Guardado' : 'Guardar'}
    </button>
  );
}
