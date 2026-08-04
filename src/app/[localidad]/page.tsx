import React from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { ComercioCard } from '@/components/ComercioCard';
import { normalizeSlug, slugToLabel } from '@/lib/slug';

interface NegocioListado {
  id: number;
  nombre_comercio: string;
  slug: string;
  rubro: string | null;
  domicilio: string | null;
  localidad: string | null;
  partido: string | null;
  provincia: string | null;
  pais: string | null;
  estado_suscripcion: string | null;
}

interface LocalidadPageProps {
  params: Promise<{ localidad: string }> | { localidad: string };
}

function coincideLocalidad(valorDb: string | null | undefined, slugUrl: string): boolean {
  if (!valorDb) return false;
  const normalizado = normalizeSlug(valorDb);
  return (
    normalizado === slugUrl ||
    normalizado.includes(slugUrl) ||
    slugUrl.includes(normalizado)
  );
}

async function obtenerComerciosPorLocalidad(slugUrl: string): Promise<NegocioListado[]> {
  const supabase = await createClient();
  const labelConEspacios = slugUrl.replace(/-/g, ' ');

  const { data, error } = await supabase
    .from('negocios')
    .select(
      'id, nombre_comercio, slug, rubro, domicilio, localidad, partido, provincia, pais, estado_suscripcion'
    )
    .or(
      `localidad.ilike.%${slugUrl}%,localidad.ilike.%${labelConEspacios}%`
    )
    .order('nombre_comercio', { ascending: true });

  console.log('[Localidad] Búsqueda Supabase', {
    slugUrl,
    labelConEspacios,
    fallaQuery: error?.message ?? null,
    recibidos: data?.length ?? 0,
    localidades: data?.map((n) => n.localidad) ?? [],
  });

  if (error) {
    console.warn('[Localidad] Falla al consultar negocios:', error.message);
  }

  let resultados = (data ?? []).filter((n) =>
    coincideLocalidad(n.localidad, slugUrl)
  );

  if (resultados.length === 0) {
    const { data: fallbackData, error: fallbackError } = await supabase
      .from('negocios')
      .select(
        'id, nombre_comercio, slug, rubro, domicilio, localidad, partido, provincia, pais, estado_suscripcion'
      )
      .order('nombre_comercio', { ascending: true })
      .limit(500);

    console.log('[Localidad] Fallback normalizando tildes/slug', {
      slugUrl,
      fallaQuery: fallbackError?.message ?? null,
      recibidos: fallbackData?.length ?? 0,
      localidades: fallbackData?.map((n) => n.localidad) ?? [],
    });

    resultados = (fallbackData ?? []).filter((n) =>
      coincideLocalidad(n.localidad, slugUrl)
    );
  }

  console.log('[Localidad] Comercios finales para render:', {
    slugUrl,
    total: resultados.length,
    slugs: resultados.map((n) => n.slug),
  });

  return resultados as NegocioListado[];
}

export default async function LocalidadPage({ params }: LocalidadPageProps) {
  const resolvedParams = await params;
  const slugUrl = normalizeSlug(resolvedParams.localidad || '');
  const localidadLabel = slugToLabel(slugUrl);

  const comercios = slugUrl ? await obtenerComerciosPorLocalidad(slugUrl) : [];

  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-slate-950 text-white">
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 md:px-8 py-6 sm:py-8">
        <header className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 mb-8 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div className="min-w-0">
            <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">
              Portal Digital Local
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold mt-1 truncate">
              {localidadLabel}
            </h1>
          </div>
          <div className="flex flex-wrap gap-2 sm:gap-3">
            <a
              href="#comercios"
              className="bg-blue-600 text-white text-xs sm:text-sm px-3 sm:px-4 py-2 rounded-xl font-medium hover:bg-blue-500 transition"
            >
              Ver Comercios
            </a>
            <Link
              href="/registro"
              className="border border-blue-500 text-blue-400 text-xs sm:text-sm px-3 sm:px-4 py-2 rounded-xl font-medium hover:bg-blue-500/10 transition"
            >
              Sumar mi Negocio
            </Link>
          </div>
        </header>

        <section className="mb-10">
          <h2 className="text-lg sm:text-xl font-bold mb-4">
            Ofertas Destacadas en {localidadLabel}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-6 sm:p-8 rounded-2xl shadow-lg flex flex-col justify-between min-h-40">
              <span className="bg-white/20 text-[10px] sm:text-xs px-3 py-1 rounded-full w-max">
                Oferta Premium
              </span>
              <div>
                <h3 className="text-xl sm:text-2xl font-bold">Ventana de Ofertas 1</h3>
                <p className="text-sm text-blue-100 mt-1">
                  Rotación automática configurable
                </p>
              </div>
            </div>
            <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-6 sm:p-8 rounded-2xl shadow-lg flex flex-col justify-between min-h-40">
              <span className="bg-white/20 text-[10px] sm:text-xs px-3 py-1 rounded-full w-max">
                Oferta Premium
              </span>
              <div>
                <h3 className="text-xl sm:text-2xl font-bold">Ventana de Ofertas 2</h3>
                <p className="text-sm text-emerald-100 mt-1">
                  Tocá un comercio para ver su catálogo
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="comercios">
          <h2 className="text-lg sm:text-xl font-bold mb-4">
            Negocios y Kioscos Registrados ({comercios.length})
          </h2>

          {comercios.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center text-slate-400">
              Aún no hay comercios cargados en esta localidad. ¡Sé el primero en{' '}
              <Link href="/registro" className="text-blue-400 hover:underline">
                registrarte
              </Link>
              !
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {comercios.map((negocio) => (
                <ComercioCard
                  key={negocio.id}
                  id={negocio.id}
                  nombre_comercio={negocio.nombre_comercio}
                  slug={negocio.slug}
                  rubro={negocio.rubro}
                  domicilio={negocio.domicilio}
                  localidad={negocio.localidad}
                  partido={negocio.partido}
                  slugUrl={slugUrl}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
