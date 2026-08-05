import type { SupabaseClient, User } from '@supabase/supabase-js';
import { isAdminUser, roleWhenLinkingNegocio } from '@/lib/auth';
import { normalizeSlug } from '@/lib/slug';
import {
  pendingFromUserMetadata,
  type PendingNegocio,
} from '@/lib/pending-negocio';

export type OwnedNegocio = {
  id: number;
  slug: string;
  localidad: string | null;
  nombre_comercio?: string | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = SupabaseClient<any, any, any>;

export function negocioHref(negocio: Pick<OwnedNegocio, 'slug' | 'localidad'>): string {
  const loc = normalizeSlug(negocio.localidad || 'local');
  const slug = normalizeSlug(negocio.slug);
  return `/${loc}/${slug}`;
}

/** Busca el comercio del usuario por profile.negocio_id o por owner_id. */
export async function findOwnedNegocio(
  supabase: Sb,
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
 * sincroniza profiles.negocio_id sin degradar rol admin.
 */
export async function syncProfileWithOwnedNegocio(
  supabase: Sb,
  userId: string,
  profileNegocioId?: number | null,
  currentRole?: string | null,
  email?: string | null
): Promise<OwnedNegocio | null> {
  const negocio = await findOwnedNegocio(supabase, userId, profileNegocioId);
  if (!negocio) return null;

  const nextRole = roleWhenLinkingNegocio(currentRole, email);
  const needsLink = profileNegocioId !== negocio.id;
  const needsRole = currentRole !== nextRole;

  if (needsLink || needsRole) {
    await supabase
      .from('profiles')
      .update({
        negocio_id: negocio.id,
        role: nextRole,
      })
      .eq('id', userId);
  }

  return negocio;
}

export async function createNegocioFromPending(
  supabase: Sb,
  userId: string,
  pending: PendingNegocio,
  opts?: { role?: string | null; email?: string | null }
): Promise<OwnedNegocio | null> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, email')
    .eq('id', userId)
    .maybeSingle();

  const role = opts?.role ?? profile?.role;
  const email = opts?.email ?? profile?.email;
  const nextRole = roleWhenLinkingNegocio(role, email);

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
        owner_id: userId,
        tema_id: 1,
      },
    ])
    .select('id, slug, localidad, nombre_comercio')
    .single();

  if (error) {
    const existing = await findOwnedNegocio(supabase, userId);
    if (existing) {
      await syncProfileWithOwnedNegocio(
        supabase,
        userId,
        null,
        role,
        email
      );
      return existing;
    }
    console.warn('createNegocioFromPending:', error.message);
    return null;
  }

  await supabase
    .from('profiles')
    .update({ role: nextRole, negocio_id: inserted.id })
    .eq('id', userId);

  return inserted as OwnedNegocio;
}

/**
 * Tras confirmar email / login: enlaza negocio existente o lo crea
 * desde user_metadata.pending_negocio (cargado en el signUp).
 */
export async function ensureNegocioForUser(
  supabase: Sb,
  user: User
): Promise<OwnedNegocio | null> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, negocio_id, email')
    .eq('id', user.id)
    .maybeSingle();

  const existing = await syncProfileWithOwnedNegocio(
    supabase,
    user.id,
    profile?.negocio_id,
    profile?.role,
    profile?.email ?? user.email
  );
  if (existing) return existing;

  // Admin sin comercio propio: no forzar creación automática
  if (isAdminUser({ role: profile?.role, email: profile?.email ?? user.email })) {
    return null;
  }

  const pending = pendingFromUserMetadata(
    user.user_metadata as Record<string, unknown> | undefined
  );
  if (!pending) return null;

  return createNegocioFromPending(supabase, user.id, pending, {
    role: profile?.role,
    email: profile?.email ?? user.email,
  });
}
