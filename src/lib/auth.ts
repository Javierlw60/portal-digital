export const ADMIN_EMAIL = 'sermec@live.com.ar';

export type UserRole = 'usuario' | 'comercio' | 'admin';

export interface Profile {
  id: string;
  email: string | null;
  role: UserRole;
  negocio_id: number | null;
  created_at?: string;
}

export function isAdminEmail(email?: string | null): boolean {
  return (email || '').toLowerCase() === ADMIN_EMAIL;
}

export function isAdminProfile(profile?: Profile | null): boolean {
  if (!profile) return false;
  return profile.role === 'admin' || isAdminEmail(profile.email);
}

export function canManageNegocio(
  profile: Profile | null | undefined,
  negocioId: number
): boolean {
  if (!profile) return false;
  if (isAdminProfile(profile)) return true;
  return profile.role === 'comercio' && profile.negocio_id === negocioId;
}
