import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeSlug } from '@/lib/slug';

export type OwnedNegocio = {
  id: number;
  slug: string;
  localidad: string | null;
  nombre_comercio?: string | null;
};

export function negocioHref(negocio: Pick<OwnedNegocio, 'slug' | 'localidad'>): string {
  const loc = normalizeSlug(negocio.localidad || 'local');
  const slug = normalizeSlug(negocio.slug);
  return `/${loc}/${slug}`;
}

/** Busca el comercio del usuario por profile.negocio_id o por owner_id. */
export async function findOwnedNegocio(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  userId: string,
  profileNegocioId?: number | null
): Promise<OwnedNegocio | null> {
  if (profileNegocioId) {
    const { data } = await supabase
      .from('negocios')
      .select('id, slug, localidad, nombre_comercio')
      .eq('id', profileNegocioId)
      .maybeSingle();
    if (data?.slug) return data as OwnedNegocio;
  }

  const { data: byOwner } = await supabase
    .from('negocios')
    .select('id, slug, localidad, nombre_comercio')
    .eq('owner_id', userId)
    .order('id', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (byOwner?.slug) return byOwner as OwnedNegocio;
  return null;
}

/**
 * Si el usuario ya tiene un negocio (p. ej. solo por owner_id),
 * sincroniza profiles.negocio_id y role=comercio.
 */
export async function syncProfileWithOwnedNegocio(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  userId: string,
  profileNegocioId?: number | null,
  currentRole?: string | null
): Promise<OwnedNegocio | null> {
  const negocio = await findOwnedNegocio(supabase, userId, profileNegocioId);
  if (!negocio) return null;

  const needsLink = profileNegocioId !== negocio.id;
  const needsRole = currentRole !== 'admin' && currentRole !== 'comercio';

  if (needsLink || needsRole) {
    await supabase
      .from('profiles')
      .update({
        negocio_id: negocio.id,
        ...(needsRole ? { role: 'comercio' } : {}),
      })
      .eq('id', userId);
  }

  return negocio;
}
