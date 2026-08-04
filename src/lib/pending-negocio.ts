export interface PendingNegocio {
  nombre_comercio: string;
  domicilio: string;
  localidad: string;
  partido: string;
  provincia: string;
  pais: string;
  rubro: string;
  slug: string;
  slugLocalidad: string;
}

const KEY = 'pd_pending_negocio';
export const PENDING_NEGOCIO_META_KEY = 'pending_negocio';

export function savePendingNegocio(data: PendingNegocio) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(KEY, JSON.stringify(data));
}

export function readPendingNegocio(): PendingNegocio | null {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return parsePendingNegocio(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function clearPendingNegocio() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(KEY);
}

export function parsePendingNegocio(raw: unknown): PendingNegocio | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const required: (keyof PendingNegocio)[] = [
    'nombre_comercio',
    'domicilio',
    'slug',
    'slugLocalidad',
  ];
  for (const key of required) {
    if (typeof o[key] !== 'string' || !(o[key] as string).trim()) return null;
  }
  return {
    nombre_comercio: String(o.nombre_comercio).trim(),
    domicilio: String(o.domicilio).trim(),
    localidad: String(o.localidad ?? '').trim(),
    partido: String(o.partido ?? '').trim(),
    provincia: String(o.provincia ?? '').trim(),
    pais: String(o.pais ?? '').trim(),
    rubro: String(o.rubro ?? '').trim(),
    slug: String(o.slug).trim(),
    slugLocalidad: String(o.slugLocalidad).trim(),
  };
}

export function pendingFromUserMetadata(
  meta: Record<string, unknown> | null | undefined
): PendingNegocio | null {
  if (!meta) return null;
  return parsePendingNegocio(meta[PENDING_NEGOCIO_META_KEY]);
}
