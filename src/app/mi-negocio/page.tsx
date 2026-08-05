import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth-server';
import { isAdminUser } from '@/lib/auth';
import { ensureNegocioForUser, negocioHref } from '@/lib/owned-negocio';
import { MiNegocioClient } from './MiNegocioClient';

export default async function MiNegocioPage() {
  const { supabase, user } = await getSessionUser();

  if (!user) {
    redirect('/login?next=/mi-negocio');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, email, negocio_id')
    .eq('id', user.id)
    .maybeSingle();

  const negocio = await ensureNegocioForUser(supabase, user);

  if (negocio) {
    redirect(negocioHref(negocio));
  }

  // Admin sin comercio propio: UI con acceso al panel (cliente)
  if (
    isAdminUser({
      role: profile?.role,
      email: profile?.email ?? user.email,
    })
  ) {
    return <MiNegocioClient />;
  }

  // Sin fila aún (p. ej. pending solo en sessionStorage): completar en cliente.
  return <MiNegocioClient />;
}
