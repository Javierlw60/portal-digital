'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { normalizeSlug } from '@/lib/slug';
import {
  buscarProductos,
  type ComercioSugerido,
  type ProductoBusqueda,
} from '@/lib/searchProductos';

interface BuscadorProductosProps {
  /** Si viene de /garin, fija la localidad y oculta el input de zona */
  localidadFija?: string;
  localidadLabel?: string;
  compact?: boolean;
}

export function BuscadorProductos({
  localidadFija,
  localidadLabel,
  compact = false,
}: BuscadorProductosProps) {
  const [q, setQ] = useState('');
  const [localidad, setLocalidad] = useState(localidadLabel || localidadFija || '');
  const [productos, setProductos] = useState<ProductoBusqueda[]>([]);
  const [sugerencias, setSugerencias] = useState<ComercioSugerido[]>([]);
  const [buscado, setBuscado] = useState(false);
  const [pending, startTransition] = useTransition();
  const [mensaje, setMensaje] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    if (term.length < 2) {
      setMensaje('Escribí al menos 2 letras para buscar.');
      return;
    }
    setMensaje('');
    setBuscado(true);

    startTransition(async () => {
      const supabase = createClient();
      const loc = localidadFija || localidad;
      const { productos: rows, sugerencias: sug } = await buscarProductos(supabase, {
        q: term,
        localidad: loc,
      });
      setProductos(rows);
      setSugerencias(sug);
    });
  };

  return (
    <div className="w-full space-y-4">
      <form
        onSubmit={handleSubmit}
        className={`bg-slate-800/90 border border-slate-700 rounded-2xl shadow-xl ${
          compact ? 'p-3' : 'p-3 sm:p-4'
        }`}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder='Producto, marca… (ej: "Lysoform", "Desinfectante")'
            className="bg-slate-950/40 w-full min-w-0 flex-1 px-3 sm:px-4 py-2.5 rounded-xl text-sm sm:text-base text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 border border-slate-700"
          />
          {!localidadFija && (
            <input
              type="text"
              value={localidad}
              onChange={(e) => setLocalidad(e.target.value)}
              placeholder="Localidad (ej: Garín)"
              className="bg-slate-950/40 w-full sm:w-44 shrink-0 px-3 sm:px-4 py-2.5 rounded-xl text-sm sm:text-base text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 border border-slate-700"
            />
          )}
          <button
            type="submit"
            disabled={pending}
            className="w-full sm:w-auto shrink-0 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-6 py-3 rounded-xl text-sm sm:text-base font-semibold transition"
          >
            {pending ? 'Buscando…' : 'Buscar producto'}
          </button>
        </div>
        {localidadFija && (
          <p className="text-[11px] text-slate-500 mt-2 px-1">
            Buscando en {localidadLabel || localidadFija}
          </p>
        )}
      </form>

      {mensaje && (
        <p className="text-sm text-amber-300/90 px-1">{mensaje}</p>
      )}

      {buscado && !pending && (
        <div className="space-y-4">
          {productos.length > 0 ? (
            <>
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
                Resultados ({productos.length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {productos.map((p) => (
                  <ProductoResultadoCard key={p.id} producto={p} />
                ))}
              </div>
            </>
          ) : (
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
              <p className="text-sm text-slate-400">
                No encontramos productos exactos para “{q.trim()}”.
                {sugerencias.length > 0
                  ? ' Te sugerimos estos comercios de la zona o rubro:'
                  : ''}
              </p>
              {sugerencias.length > 0 && (
                <ul className="space-y-2">
                  {sugerencias.map((c) => {
                    const href = `/${normalizeSlug(c.localidad || 'local')}/${normalizeSlug(c.slug)}`;
                    return (
                      <li key={c.id}>
                        <Link
                          href={href}
                          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-slate-800/60 border border-slate-700 rounded-xl p-3 hover:border-blue-500/40 transition"
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-white break-words">
                              {c.nombre_comercio}
                            </p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {[c.rubro, c.domicilio, c.localidad]
                                .filter(Boolean)
                                .join(' · ')}
                            </p>
                          </div>
                          <span className="text-xs font-semibold text-blue-400 shrink-0">
                            Ver catálogo →
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ProductoResultadoCard({ producto }: { producto: ProductoBusqueda }) {
  const n = producto.negocio;
  const href = `/${normalizeSlug(n.localidad || 'local')}/${normalizeSlug(n.slug)}`;

  return (
    <article className="bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-4 flex gap-3 shadow-lg">
      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-slate-800 border border-slate-700 overflow-hidden shrink-0 flex items-center justify-center">
        {producto.foto_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={producto.foto_url}
            alt={producto.nombre_articulo}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-[10px] text-slate-600 text-center px-1">Sin foto</span>
        )}
      </div>

      <div className="min-w-0 flex-1 flex flex-col">
        <div className="flex justify-between gap-2 items-start">
          <div className="min-w-0">
            <h4 className="font-bold text-white break-words leading-snug">
              {producto.nombre_articulo}
            </h4>
            {(producto.marca || producto.presentacion) && (
              <p className="text-xs text-slate-400 mt-0.5 break-words">
                {[producto.marca, producto.presentacion].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
          <span className="text-emerald-400 font-bold text-lg shrink-0">
            ${producto.precio}
          </span>
        </div>

        <p className="text-sm text-slate-300 mt-2 font-medium break-words">
          {n.nombre_comercio}
        </p>
        <p className="text-xs text-slate-500 break-words">
          {[n.domicilio, n.localidad, n.partido].filter(Boolean).join(', ')}
        </p>

        <Link
          href={href}
          className="mt-2 inline-flex self-start text-xs font-bold bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 px-3 py-1.5 rounded-lg transition"
        >
          Ver comercio / Catálogo
        </Link>
      </div>
    </article>
  );
}
