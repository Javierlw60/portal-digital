'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import {
  clearPendingNegocio,
  readPendingNegocio,
} from '@/lib/pending-negocio';
import {
  createNegocioFromPending,
  ensureNegocioForUser,
  findOwnedNegocio,
  negocioHref,
} from '@/lib/owned-negocio';

/** Completa negocio pendiente (sessionStorage) si el server aún no lo creó. */
export function MiNegocioClient() {
  const router = useRouter();
  const [mensaje, setMensaje] = useState('Preparando tu panel…');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace('/login?next=/mi-negocio');
        return;
      }

      let negocio = await ensureNegocioForUser(supabase, user);

      if (!negocio) {
        const pending = readPendingNegocio();
        if (pending) {
          negocio = await createNegocioFromPending(supabase, user.id, pending);
          clearPendingNegocio();
        }
      } else {
        clearPendingNegocio();
      }

      if (!negocio) {
        negocio = await findOwnedNegocio(supabase, user.id);
      }

      if (cancelled) return;

      if (negocio) {
        router.replace(negocioHref(negocio));
        return;
      }

      setMensaje(
        'Tu cuenta está verificada, pero aún no encontramos un comercio asociado. Volvé a iniciar sesión o contactá soporte.'
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="flex-1 flex items-center justify-center p-6 bg-slate-950 text-white">
      <p className="text-slate-300 text-center text-sm max-w-md animate-pulse">
        {mensaje}
      </p>
    </main>
  );
}
