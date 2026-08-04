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

export function savePendingNegocio(data: PendingNegocio) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(KEY, JSON.stringify(data));
}

export function readPendingNegocio(): PendingNegocio | null {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingNegocio;
  } catch {
    return null;
  }
}

export function clearPendingNegocio() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(KEY);
}
