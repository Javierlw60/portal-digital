import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth-server';
import { syncProfileWithOwnedNegocio, negocioHref } from '@/lib/owned-negocio';

export default async function MiNegocioPage() {
  const { supabase, user } = await getSessionUser();

  if (!user) {
    redirect('/login?next=/mi-negocio');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('negocio_id, role')
    .eq('id', user.id)
    .maybeSingle();

  const negocio = await syncProfileWithOwnedNegocio(
    supabase,
    user.id,
    profile?.negocio_id,
    profile?.role
  );

  if (!negocio) {
    redirect('/registro');
  }

  redirect(negocioHref(negocio));
}
