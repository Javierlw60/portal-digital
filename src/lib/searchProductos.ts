import { normalizeSlug } from '@/lib/slug';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface ProductoBusqueda {
  id: number;
  nombre_articulo: string;
  marca: string | null;
  presentacion: string | null;
  precio: number;
  foto_url: string | null;
  codigo_barras: string | null;
  negocio: {
    id: number;
    nombre_comercio: string;
    slug: string;
    domicilio: string | null;
    localidad: string | null;
    partido: string | null;
    rubro: string | null;
  };
}

export interface ComercioSugerido {
  id: number;
  nombre_comercio: string;
  slug: string;
  domicilio: string | null;
  localidad: string | null;
  partido: string | null;
  rubro: string | null;
}

function sanitizeTerm(term: string): string {
  return term.trim().replace(/[%_,.()]/g, ' ').replace(/\s+/g, ' ');
}

/** Valores con espacios/comodines van entre comillas para PostgREST. */
function ilikePattern(term: string): string {
  return `"%${sanitizeTerm(term)}%"`;
}

function coincideLocalidad(
  valorDb: string | null | undefined,
  slugLocalidad: string
): boolean {
  if (!slugLocalidad) return true;
  if (!valorDb) return false;
  const n = normalizeSlug(valorDb);
  const s = normalizeSlug(slugLocalidad);
  return n === s || n.includes(s) || s.includes(n);
}

type ProductoRow = {
  id: number;
  nombre_articulo: string;
  marca: string | null;
  presentacion: string | null;
  precio: number;
  foto_url: string | null;
  codigo_barras: string | null;
  negocios: {
    id: number;
    nombre_comercio: string;
    slug: string;
    domicilio: string | null;
    localidad: string | null;
    partido: string | null;
    rubro: string | null;
  } | null;
};

function mapProducto(row: ProductoRow): ProductoBusqueda | null {
  if (!row.negocios) return null;
  return {
    id: row.id,
    nombre_articulo: row.nombre_articulo,
    marca: row.marca,
    presentacion: row.presentacion,
    precio: Number(row.precio),
    foto_url: row.foto_url,
    codigo_barras: row.codigo_barras,
    negocio: row.negocios,
  };
}

/** Busca productos públicos con JOIN a negocios; opcionalmente filtra por localidad. */
export async function buscarProductos(
  supabase: SupabaseClient,
  opts: { q: string; localidad?: string; limit?: number }
): Promise<{ productos: ProductoBusqueda[]; sugerencias: ComercioSugerido[] }> {
  const q = sanitizeTerm(opts.q || '');
  const localidad = (opts.localidad || '').trim();
  const slugLoc = localidad ? normalizeSlug(localidad) : '';
  const limit = opts.limit ?? 40;

  if (q.length < 2) {
    return { productos: [], sugerencias: [] };
  }

  const like = ilikePattern(q);
  const selectJoin = `
      id,
      nombre_articulo,
      marca,
      presentacion,
      precio,
      foto_url,
      codigo_barras,
      negocios!inner (
        id,
        nombre_comercio,
        slug,
        domicilio,
        localidad,
        partido,
        rubro
      )
    `;

  // JOIN productos → negocios (inner) + filtro por texto
  let query = supabase
    .from('productos')
    .select(selectJoin)
    .or(`nombre_articulo.ilike.${like},marca.ilike.${like},presentacion.ilike.${like}`)
    .order('precio', { ascending: true })
    .limit(Math.max(limit, 80));

  if (slugLoc) {
    const locSpace = slugLoc.replace(/-/g, ' ');
    query = query.or(
      `localidad.ilike."%${slugLoc}%",localidad.ilike."%${locSpace}%"`,
      { referencedTable: 'negocios' }
    );
  }

  let { data, error } = await query;

  // Si el filtro anidado falla, reintentar sin él y filtrar localidad en cliente
  if (error) {
    console.warn('[buscarProductos]', error.message);
    const retry = await supabase
      .from('productos')
      .select(selectJoin)
      .or(`nombre_articulo.ilike.${like},marca.ilike.${like},presentacion.ilike.${like}`)
      .order('precio', { ascending: true })
      .limit(Math.max(limit, 80));
    data = retry.data;
    error = retry.error;
    if (error) console.warn('[buscarProductos retry]', error.message);
  }

  let productos = ((data as unknown as ProductoRow[]) || [])
    .map(mapProducto)
    .filter((p): p is ProductoBusqueda => Boolean(p));

  // Refinar tildes / slug en cliente
  if (slugLoc) {
    productos = productos.filter((p) =>
      coincideLocalidad(p.negocio.localidad, slugLoc)
    );
  }

  // Regla de negocio: siempre devolver ordenados por menor precio primero
  productos = ordenarProductos(productos, 'menor_precio').slice(0, limit);

  let sugerencias: ComercioSugerido[] = [];

  if (productos.length === 0) {
    // Sugerencias: comercios cuyo rubro o nombre coincida
    let negQuery = supabase
      .from('negocios')
      .select('id, nombre_comercio, slug, domicilio, localidad, partido, rubro')
      .or(`rubro.ilike.${like},nombre_comercio.ilike.${like}`)
      .order('nombre_comercio', { ascending: true })
      .limit(12);

    if (slugLoc) {
      const locSpace = slugLoc.replace(/-/g, ' ');
      negQuery = negQuery.or(
        `localidad.ilike."%${slugLoc}%",localidad.ilike."%${locSpace}%"`
      );
    }

    const { data: negData, error: negError } = await negQuery;
    if (negError) {
      console.warn('[buscarProductos sugerencias]', negError.message);
    }

    sugerencias = ((negData as ComercioSugerido[]) || []).filter((n) =>
      coincideLocalidad(n.localidad, slugLoc)
    );

    // Si aún no hay nada y hay localidad, mostrar algunos comercios de la zona
    if (sugerencias.length === 0 && slugLoc) {
      const { data: zona } = await supabase
        .from('negocios')
        .select('id, nombre_comercio, slug, domicilio, localidad, partido, rubro')
        .ilike('localidad', `%${slugLoc}%`)
        .order('nombre_comercio', { ascending: true })
        .limit(8);
      sugerencias = ((zona as ComercioSugerido[]) || []).filter((n) =>
        coincideLocalidad(n.localidad, slugLoc)
      );
    }
  }

  return { productos, sugerencias };
}

export type OrdenProductos = 'menor_precio' | 'mayor_precio' | 'comercio';

/** Ordena resultados en cliente (ahorro del usuario = menor_precio por defecto). */
export function ordenarProductos(
  productos: ProductoBusqueda[],
  orden: OrdenProductos
): ProductoBusqueda[] {
  const copy = [...productos];
  switch (orden) {
    case 'mayor_precio':
      return copy.sort((a, b) => b.precio - a.precio);
    case 'comercio':
      return copy.sort((a, b) =>
        a.negocio.nombre_comercio.localeCompare(b.negocio.nombre_comercio, 'es', {
          sensitivity: 'base',
        })
      );
    case 'menor_precio':
    default:
      return copy.sort((a, b) => a.precio - b.precio);
  }
}

/** Id del producto con el precio más bajo (empate: el primero en la lista). */
export function idMejorPrecio(productos: ProductoBusqueda[]): number | null {
  if (productos.length === 0) return null;
  let best = productos[0];
  for (const p of productos) {
    if (p.precio < best.precio) best = p;
  }
  return best.id;
}
