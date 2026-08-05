'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import { ADMIN_EMAIL, isAdminProfile } from '@/lib/auth';
import { normalizeSlug } from '@/lib/slug';
import { parseProductosCsv } from '@/lib/parseProductosCsv';
import {
  authInputClassName,
  authLabelClassName,
} from '@/components/PasswordField';

interface NegocioRow {
  id: number;
  nombre_comercio: string;
  slug: string;
  localidad: string | null;
  domicilio: string | null;
  rubro: string | null;
}

interface ProductoRow {
  id: number;
  codigo_barras: string | null;
  nombre_articulo: string;
  marca: string | null;
  presentacion: string | null;
  precio: number;
}

export default function AdminCatalogoPage() {
  const params = useParams();
  const negocioId = Number(params?.negocioId);
  const { user, profile, loading: authLoading } = useAuth();
  const supabase = createClient();

  const allowed =
    isAdminProfile(profile) || user?.email?.toLowerCase() === ADMIN_EMAIL;

  const [negocio, setNegocio] = useState<NegocioRow | null>(null);
  const [productos, setProductos] = useState<ProductoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [importando, setImportando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const [editId, setEditId] = useState<number | null>(null);
  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [marca, setMarca] = useState('');
  const [presentacion, setPresentacion] = useState('');
  const [precio, setPrecio] = useState('');

  const cargar = useCallback(async () => {
    if (!Number.isFinite(negocioId)) return;
    setLoading(true);
    const [{ data: neg }, { data: prods }] = await Promise.all([
      supabase
        .from('negocios')
        .select('id, nombre_comercio, slug, localidad, domicilio, rubro')
        .eq('id', negocioId)
        .maybeSingle(),
      supabase
        .from('productos')
        .select(
          'id, codigo_barras, nombre_articulo, marca, presentacion, precio'
        )
        .eq('negocio_id', negocioId)
        .order('id', { ascending: false }),
    ]);
    setNegocio((neg as NegocioRow) || null);
    setProductos((prods as ProductoRow[]) || []);
    setLoading(false);
  }, [negocioId, supabase]);

  useEffect(() => {
    if (authLoading || !allowed) return;
    void cargar();
  }, [authLoading, allowed, cargar]);

  const resetForm = () => {
    setEditId(null);
    setCodigo('');
    setNombre('');
    setMarca('');
    setPresentacion('');
    setPrecio('');
  };

  const editar = (p: ProductoRow) => {
    setEditId(p.id);
    setCodigo(p.codigo_barras || '');
    setNombre(p.nombre_articulo);
    setMarca(p.marca || '');
    setPresentacion(p.presentacion || '');
    setPrecio(String(p.precio));
  };

  const guardarProducto = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardando(true);
    setMensaje('');
    setError('');

    const precioNum = Number(precio.replace(',', '.'));
    if (!nombre.trim() || !Number.isFinite(precioNum) || precioNum < 0) {
      setError('Nombre y precio válidos son obligatorios.');
      setGuardando(false);
      return;
    }

    const payload = {
      negocio_id: negocioId,
      codigo_barras: codigo.trim() || null,
      nombre_articulo: nombre.trim(),
      marca: marca.trim() || null,
      presentacion: presentacion.trim() || null,
      precio: precioNum,
    };

    if (editId) {
      const { error: uErr } = await supabase
        .from('productos')
        .update(payload)
        .eq('id', editId);
      if (uErr) setError(uErr.message);
      else {
        setMensaje('Producto actualizado.');
        resetForm();
        await cargar();
      }
    } else {
      const { error: iErr } = await supabase.from('productos').insert([payload]);
      if (iErr) setError(iErr.message);
      else {
        setMensaje('Producto agregado.');
        resetForm();
        await cargar();
      }
    }
    setGuardando(false);
  };

  const eliminar = async (id: number) => {
    if (!confirm('¿Eliminar este producto?')) return;
    const { error: dErr } = await supabase.from('productos').delete().eq('id', id);
    if (dErr) setError(dErr.message);
    else {
      setMensaje('Producto eliminado.');
      await cargar();
    }
  };

  const onImportFile = async (file: File | null) => {
    if (!file) return;
    setImportando(true);
    setMensaje('');
    setError('');

    try {
      const text = await file.text();
      const { rows, errors } = parseProductosCsv(text);
      if (rows.length === 0) {
        setError(errors[0] || 'No se encontraron filas válidas.');
        return;
      }

      const batch = rows.map((r) => ({
        negocio_id: negocioId,
        ...r,
      }));

      // Insertar en lotes de 100
      for (let i = 0; i < batch.length; i += 100) {
        const chunk = batch.slice(i, i + 100);
        const { error: iErr } = await supabase.from('productos').insert(chunk);
        if (iErr) throw iErr;
      }

      setMensaje(
        `Importados ${rows.length} productos.` +
          (errors.length ? ` (${errors.length} filas omitidas)` : '')
      );
      await cargar();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setImportando(false);
    }
  };

  if (authLoading || !allowed) {
    return (
      <main className="flex-1 flex items-center justify-center p-6">
        <p className="text-slate-400">Verificando acceso…</p>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center p-6">
        <p className="text-slate-400">Cargando catálogo…</p>
      </main>
    );
  }

  if (!negocio) {
    return (
      <main className="flex-1 flex items-center justify-center p-6">
        <p className="text-slate-400">Negocio no encontrado.</p>
      </main>
    );
  }

  const hrefPublico = `/${normalizeSlug(negocio.localidad || 'local')}/${normalizeSlug(negocio.slug)}`;

  return (
    <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <Link
            href="/admin"
            className="text-xs text-slate-500 hover:text-slate-300"
          >
            ← Volver al Panel Admin
          </Link>
          <h1 className="text-2xl font-bold mt-2">{negocio.nombre_comercio}</h1>
          <p className="text-sm text-slate-500 mt-1">
            Catálogo · {productos.length} productos · {negocio.localidad}
          </p>
        </div>
        <Link
          href={hrefPublico}
          className="text-sm border border-slate-600 hover:bg-slate-800 px-3 py-2 rounded-xl self-start"
        >
          Abrir ficha pública
        </Link>
      </div>

      {mensaje && (
        <p className="text-sm text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2">
          {mensaje}
        </p>
      )}
      {error && (
        <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
          {error}
        </p>
      )}

      <section className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-3">
        <h2 className="font-bold">Importar CSV / Excel</h2>
        <p className="text-xs text-slate-500">
          Desde Excel: Archivo → Guardar como → CSV UTF-8. Columnas:{' '}
          <code className="text-slate-400">
            codigo_barras, nombre_articulo, marca, presentacion, precio
          </code>
        </p>
        <input
          type="file"
          accept=".csv,text/csv,.txt,application/vnd.ms-excel"
          disabled={importando}
          onChange={(e) => {
            const f = e.target.files?.[0] || null;
            void onImportFile(f);
            e.target.value = '';
          }}
          className="block w-full text-sm text-slate-400 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-slate-700 file:text-white"
        />
        {importando && (
          <p className="text-xs text-slate-400 animate-pulse">Importando…</p>
        )}
      </section>

      <section className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4">
        <h2 className="font-bold">
          {editId ? 'Editar producto' : 'Agregar producto'}
        </h2>
        <form
          onSubmit={guardarProducto}
          className="grid grid-cols-1 sm:grid-cols-2 gap-3"
        >
          <div>
            <label className={authLabelClassName}>Código de barras</label>
            <input
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              className={authInputClassName}
            />
          </div>
          <div>
            <label className={authLabelClassName}>Precio</label>
            <input
              required
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
              className={authInputClassName}
              inputMode="decimal"
            />
          </div>
          <div className="sm:col-span-2">
            <label className={authLabelClassName}>Nombre</label>
            <input
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className={authInputClassName}
            />
          </div>
          <div>
            <label className={authLabelClassName}>Marca</label>
            <input
              value={marca}
              onChange={(e) => setMarca(e.target.value)}
              className={authInputClassName}
            />
          </div>
          <div>
            <label className={authLabelClassName}>Presentación</label>
            <input
              value={presentacion}
              onChange={(e) => setPresentacion(e.target.value)}
              className={authInputClassName}
            />
          </div>
          <div className="sm:col-span-2 flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={guardando}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-4 py-2.5 rounded-xl text-sm font-medium"
            >
              {guardando
                ? 'Guardando…'
                : editId
                  ? 'Guardar cambios'
                  : 'Agregar'}
            </button>
            {editId && (
              <button
                type="button"
                onClick={resetForm}
                className="border border-slate-600 px-4 py-2.5 rounded-xl text-sm"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-3">
        <h2 className="font-bold">Productos</h2>
        {productos.length === 0 ? (
          <p className="text-sm text-slate-500">Sin productos aún.</p>
        ) : (
          <ul className="space-y-2">
            {productos.map((p) => (
              <li
                key={p.id}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-slate-800/50 border border-slate-700 rounded-xl px-3 py-3"
              >
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">
                    {p.nombre_articulo}
                  </p>
                  <p className="text-xs text-slate-500">
                    {p.codigo_barras || 'Sin código'}
                    {p.marca ? ` · ${p.marca}` : ''}
                    {p.presentacion ? ` · ${p.presentacion}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-semibold text-emerald-300">
                    ${Number(p.precio).toLocaleString('es-AR')}
                  </span>
                  <button
                    type="button"
                    onClick={() => editar(p)}
                    className="text-xs text-blue-400 hover:underline"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => eliminar(p.id)}
                    className="text-xs text-red-400 hover:underline"
                  >
                    Borrar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
