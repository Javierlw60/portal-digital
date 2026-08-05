'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { isAdminUser } from '@/lib/auth';
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
  const [esAdmin, setEsAdmin] = useState(false);
  const [listoSinNegocio, setListoSinNegocio] = useState(false);

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

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, email')
        .eq('id', user.id)
        .maybeSingle();

      const admin = isAdminUser({
        role: profile?.role,
        email: profile?.email ?? user.email,
      });
      if (!cancelled) setEsAdmin(admin);

      let negocio = await ensureNegocioForUser(supabase, user);

      if (!negocio) {
        const pending = readPendingNegocio();
        if (pending) {
          negocio = await createNegocioFromPending(supabase, user.id, pending, {
            role: profile?.role,
            email: profile?.email ?? user.email,
          });
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

      setListoSinNegocio(true);
      if (admin) {
        setMensaje(
          'Todavía no tenés un comercio propio vinculado. Podés gestionarlo desde el Panel Admin.'
        );
      } else {
        setMensaje(
          'Tu cuenta está verificada, pero aún no encontramos un comercio asociado. Volvé a iniciar sesión o contactá soporte.'
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="flex-1 flex flex-col items-center justify-center gap-4 p-6 bg-slate-950 text-white">
      <p
        className={`text-slate-300 text-center text-sm max-w-md ${
          listoSinNegocio ? '' : 'animate-pulse'
        }`}
      >
        {mensaje}
      </p>

      {listoSinNegocio && esAdmin && (
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href="/admin"
            className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-5 py-3 rounded-xl text-center"
          >
            Ir al Panel Admin
          </Link>
          <Link
            href="/admin#alta-comercio"
            className="border border-slate-600 hover:bg-slate-800 text-slate-200 text-sm font-medium px-5 py-3 rounded-xl text-center"
          >
            Dar de alta mi comercio
          </Link>
        </div>
      )}
    </main>
  );
}
