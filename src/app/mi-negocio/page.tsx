import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth-server';
import { ensureNegocioForUser, negocioHref } from '@/lib/owned-negocio';
import { MiNegocioClient } from './MiNegocioClient';

export default async function MiNegocioPage() {
  const { supabase, user } = await getSessionUser();

  if (!user) {
    redirect('/login?next=/mi-negocio');
  }

  const negocio = await ensureNegocioForUser(supabase, user);

  if (negocio) {
    redirect(negocioHref(negocio));
  }

  // Sin fila aún (p. ej. pending solo en sessionStorage): completar en cliente.
  // Nunca redirigir a /registro.
  return <MiNegocioClient />;
}
