'use client';

import Link from 'next/link';
import { FavoritoButton } from '@/components/FavoritoButton';
import { normalizeSlug } from '@/lib/slug';

interface ComercioCardProps {
  id: number;
  nombre_comercio: string;
  slug: string;
  rubro: string | null;
  domicilio: string | null;
  localidad: string | null;
  partido: string | null;
  slugUrl: string;
}

export function ComercioCard({
  id,
  nombre_comercio,
  slug,
  rubro,
  domicilio,
  localidad,
  partido,
  slugUrl,
}: ComercioCardProps) {
  return (
    <div className="bg-slate-900 border border-slate-800 hover:border-blue-500/50 rounded-2xl p-4 sm:p-5 transition shadow-lg relative">
      <div className="absolute top-4 right-4">
        <FavoritoButton negocioId={id} />
      </div>
      <Link href={`/${slugUrl}/${normalizeSlug(slug)}`} className="block pr-20">
        <span className="text-[10px] sm:text-xs uppercase tracking-wider bg-blue-500/15 text-blue-400 border border-blue-500/20 px-2.5 py-1 rounded-full font-semibold">
          {rubro || 'Comercio'}
        </span>
        <h3 className="text-lg sm:text-xl font-bold mt-3 break-words">
          {nombre_comercio}
        </h3>
        <p className="text-sm text-slate-400 mt-1 break-words">
          {[domicilio, localidad, partido].filter(Boolean).join(', ')}
        </p>
        <span className="inline-block mt-3 text-xs font-semibold text-blue-400">
          Ver catálogo →
        </span>
      </Link>
    </div>
  );
}
