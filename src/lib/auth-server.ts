import { createClient } from '@/lib/supabase/server';
import {
  ADMIN_EMAIL,
  isAdminProfile,
  type Profile,
  type UserRole,
} from '@/lib/auth';

export async function getSessionUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function getCurrentProfile(): Promise<{
  user: Awaited<ReturnType<typeof getSessionUser>>['user'];
  profile: Profile | null;
}> {
  const { supabase, user } = await getSessionUser();
  if (!user) return { user: null, profile: null };

  const { data } = await supabase
    .from('profiles')
    .select('id, email, role, negocio_id, created_at')
    .eq('id', user.id)
    .maybeSingle();

  let profile = (data as Profile | null) ?? null;

  // Sembrar admin si el email coincide y aún no tiene profile/role
  if (user.email?.toLowerCase() === ADMIN_EMAIL) {
    if (!profile) {
      const { data: created } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          email: user.email,
          role: 'admin' satisfies UserRole,
        })
        .select('id, email, role, negocio_id, created_at')
        .single();
      profile = created as Profile;
    } else if (profile.role !== 'admin') {
      const { data: updated } = await supabase
        .from('profiles')
        .update({ role: 'admin', email: user.email })
        .eq('id', user.id)
        .select('id, email, role, negocio_id, created_at')
        .single();
      profile = (updated as Profile) ?? profile;
    }
  }

  return { user, profile };
}

export async function requireAdmin() {
  const { user, profile } = await getCurrentProfile();
  if (!user || !isAdminProfile(profile)) {
    return { ok: false as const, user, profile };
  }
  return { ok: true as const, user, profile };
}
