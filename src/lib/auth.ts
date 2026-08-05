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

export function isAdminUser(opts: {
  role?: string | null;
  email?: string | null;
}): boolean {
  return opts.role === 'admin' || isAdminEmail(opts.email);
}

/** Rol a guardar al vincular un negocio: nunca degrada a un admin. */
export function roleWhenLinkingNegocio(
  currentRole?: string | null,
  email?: string | null
): UserRole {
  if (isAdminUser({ role: currentRole, email })) return 'admin';
  return 'comercio';
}

/**
 * Destino post-login / post-confirmación.
 * Admin → /admin (salvo next explícito bajo /admin).
 */
export function defaultPostAuthPath(opts: {
  role?: string | null;
  email?: string | null;
  hasNegocio?: boolean;
  next?: string | null;
}): string {
  const next = opts.next;
  const safeNext =
    next && next.startsWith('/') && !next.startsWith('//') ? next : null;

  if (isAdminUser({ role: opts.role, email: opts.email })) {
    if (safeNext && (safeNext === '/admin' || safeNext.startsWith('/admin/'))) {
      return safeNext;
    }
    return '/admin';
  }

  if (safeNext && safeNext !== '/registro' && !safeNext.startsWith('/registro?')) {
    return safeNext;
  }

  if (opts.hasNegocio) return '/mi-negocio';
  return '/cuenta';
}

export function canManageNegocio(
  profile: Profile | null | undefined,
  negocioId: number
): boolean {
  if (!profile) return false;
  if (isAdminProfile(profile)) return true;
  return profile.role === 'comercio' && profile.negocio_id === negocioId;
}
