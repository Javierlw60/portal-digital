'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import { ADMIN_EMAIL, isAdminProfile, type UserRole } from '@/lib/auth';
import { normalizeComparable, normalizeSlug } from '@/lib/slug';
import {
  authInputClassName,
  authLabelClassName,
} from '@/components/PasswordField';

interface NegocioAdmin {
  id: number;
  nombre_comercio: string;
  slug: string;
  localidad: string | null;
  rubro: string | null;
  domicilio: string | null;
  owner_id: string | null;
}

interface ProfileAdmin {
  id: string;
  email: string | null;
  role: UserRole;
  negocio_id: number | null;
}

const emptyForm = {
  emailCliente: '',
  nombreComercio: '',
  domicilio: '',
  localidad: '',
  partido: '',
  provincia: 'Buenos Aires',
  pais: 'Argentina',
  rubro: '',
};

export default function AdminPage() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const supabase = createClient();
  const [negocios, setNegocios] = useState<NegocioAdmin[]>([]);
  const [profiles, setProfiles] = useState<ProfileAdmin[]>([]);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [filtro, setFiltro] = useState('');

  const allowed =
    isAdminProfile(profile) || user?.email?.toLowerCase() === ADMIN_EMAIL;

  const cargar = useCallback(async () => {
    const [{ data: neg }, { data: prof }] = await Promise.all([
      supabase
        .from('negocios')
        .select(
          'id, nombre_comercio, slug, localidad, rubro, domicilio, owner_id'
        )
        .order('id', { ascending: false })
        .limit(500),
      supabase
        .from('profiles')
        .select('id, email, role, negocio_id')
        .order('created_at', { ascending: false })
        .limit(500),
    ]);
    setNegocios((neg as NegocioAdmin[]) || []);
    setProfiles((prof as ProfileAdmin[]) || []);
  }, [supabase]);

  useEffect(() => {
    if (loading || !allowed) return;
    void cargar();
  }, [loading, allowed, cargar]);

  const formatTitleCase = (value: string) =>
    value.replace(/\b\w/g, (char) => char.toUpperCase());

  const setField = (key: keyof typeof emptyForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const crearComercio = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardando(true);
    setMensaje('');
    setError('');

    try {
      const slugLocalidad = normalizeSlug(form.localidad);
      const slugNegocio = normalizeSlug(form.nombreComercio);
      if (!slugLocalidad || !slugNegocio) {
        setError('Completá nombre y localidad válidos.');
        return;
      }

      const email = form.emailCliente.trim().toLowerCase();
      if (!email) {
        setError('Indicá el email del cliente.');
        return;
      }

      const { data: porSlug } = await supabase
        .from('negocios')
        .select('id')
        .eq('slug', slugNegocio)
        .maybeSingle();
      if (porSlug) {
        setError('Ya existe un comercio con ese slug/nombre.');
        return;
      }

      // Buscar perfil del cliente por email
      const { data: candidatos } = await supabase
        .from('profiles')
        .select('id, email, role, negocio_id')
        .ilike('email', email)
        .limit(5);

      const cliente =
        (candidatos || []).find(
          (p) => (p.email || '').toLowerCase() === email
        ) || null;

      const { data: inserted, error: insertError } = await supabase
        .from('negocios')
        .insert([
          {
            nombre_comercio: form.nombreComercio.trim(),
            domicilio: form.domicilio.trim(),
            localidad: slugLocalidad,
            partido: form.partido.trim(),
            provincia: form.provincia.trim(),
            pais: form.pais.trim(),
            rubro: form.rubro.trim(),
            slug: slugNegocio,
            owner_id: cliente?.id ?? null,
            tema_id: 1,
          },
        ])
        .select('id, nombre_comercio, slug, localidad')
        .single();

      if (insertError) throw insertError;

      if (cliente) {
        await supabase
          .from('profiles')
          .update({
            role: cliente.role === 'admin' ? 'admin' : 'comercio',
            negocio_id: inserted.id,
          })
          .eq('id', cliente.id);

        setMensaje(
          `Comercio "${inserted.nombre_comercio}" creado y asociado a ${email}.`
        );
      } else {
        setMensaje(
          `Comercio "${inserted.nombre_comercio}" creado sin dueño vinculado. El cliente aún no tiene cuenta con ${email}; cuando se registre, vinculalo desde Roles o volvé a asociarlo.`
        );
      }

      setForm(emptyForm);
      await cargar();
      await refreshProfile();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGuardando(false);
    }
  };

  const vincularOwner = async (negocioId: number, emailRaw: string) => {
    setMensaje('');
    setError('');
    const email = emailRaw.trim().toLowerCase();
    if (!email) {
      setError('Email vacío.');
      return;
    }

    const { data: candidatos } = await supabase
      .from('profiles')
      .select('id, email, role')
      .ilike('email', email)
      .limit(5);

    const cliente =
      (candidatos || []).find((p) => (p.email || '').toLowerCase() === email) ||
      null;

    if (!cliente) {
      setError(`No hay usuario registrado con ${email}.`);
      return;
    }

    const { error: nErr } = await supabase
      .from('negocios')
      .update({ owner_id: cliente.id })
      .eq('id', negocioId);
    if (nErr) {
      setError(nErr.message);
      return;
    }

    await supabase
      .from('profiles')
      .update({
        role: cliente.role === 'admin' ? 'admin' : 'comercio',
        negocio_id: negocioId,
      })
      .eq('id', cliente.id);

    setMensaje(`Negocio #${negocioId} vinculado a ${email}.`);
    await cargar();
  };

  const cambiarRol = async (profileId: string, role: UserRole) => {
    setMensaje('');
    setError('');
    const { error: uErr } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', profileId);
    if (uErr) {
      setError(uErr.message);
      return;
    }
    setProfiles((prev) =>
      prev.map((p) => (p.id === profileId ? { ...p, role } : p))
    );
    await refreshProfile();
    setMensaje('Rol actualizado.');
  };

  const negociosFiltrados = negocios.filter((n) => {
    if (!filtro.trim()) return true;
    const q = normalizeComparable(filtro);
    return (
      normalizeComparable(n.nombre_comercio).includes(q) ||
      normalizeComparable(n.localidad || '').includes(q) ||
      normalizeComparable(n.rubro || '').includes(q) ||
      String(n.id).includes(q)
    );
  });

  const emailPorOwner = (ownerId: string | null) => {
    if (!ownerId) return null;
    return profiles.find((p) => p.id === ownerId)?.email || null;
  };

  if (loading || !allowed) {
    return (
      <main className="flex-1 flex items-center justify-center p-6">
        <p className="text-slate-400">Verificando acceso admin…</p>
      </main>
    );
  }

  return (
    <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <section>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-100">
          Panel Admin
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Superadministrador · {ADMIN_EMAIL}
        </p>
        {mensaje && (
          <p className="mt-3 text-sm text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2">
            {mensaje}
          </p>
        )}
        {error && (
          <p className="mt-3 text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
            {error}
          </p>
        )}
      </section>

      {/* a) Alta de comercio */}
      <section className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-4">
        <div>
          <h2 className="text-lg font-bold">Crear / Alta de Comercio</h2>
          <p className="text-xs text-slate-500 mt-1">
            Registrá un negocio completo y asociarlo al email de un cliente.
          </p>
        </div>

        <form onSubmit={crearComercio} className="space-y-4">
          <div>
            <label className={authLabelClassName}>Email del cliente</label>
            <input
              type="email"
              required
              value={form.emailCliente}
              onChange={(e) => setField('emailCliente', e.target.value)}
              placeholder="cliente@email.com"
              className={authInputClassName}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className={authLabelClassName}>Nombre del comercio</label>
              <input
                required
                value={form.nombreComercio}
                onChange={(e) =>
                  setField('nombreComercio', formatTitleCase(e.target.value))
                }
                className={authInputClassName}
              />
            </div>
            <div className="md:col-span-2">
              <label className={authLabelClassName}>Domicilio</label>
              <input
                required
                value={form.domicilio}
                onChange={(e) =>
                  setField('domicilio', formatTitleCase(e.target.value))
                }
                className={authInputClassName}
              />
            </div>
            <div>
              <label className={authLabelClassName}>Localidad</label>
              <input
                required
                value={form.localidad}
                onChange={(e) =>
                  setField('localidad', formatTitleCase(e.target.value))
                }
                className={authInputClassName}
              />
            </div>
            <div>
              <label className={authLabelClassName}>Partido</label>
              <input
                required
                value={form.partido}
                onChange={(e) =>
                  setField('partido', formatTitleCase(e.target.value))
                }
                className={authInputClassName}
              />
            </div>
            <div>
              <label className={authLabelClassName}>Provincia</label>
              <input
                required
                value={form.provincia}
                onChange={(e) =>
                  setField('provincia', formatTitleCase(e.target.value))
                }
                className={authInputClassName}
              />
            </div>
            <div>
              <label className={authLabelClassName}>País</label>
              <input
                required
                value={form.pais}
                onChange={(e) =>
                  setField('pais', formatTitleCase(e.target.value))
                }
                className={authInputClassName}
              />
            </div>
            <div className="md:col-span-2">
              <label className={authLabelClassName}>Rubro</label>
              <input
                required
                value={form.rubro}
                onChange={(e) =>
                  setField('rubro', formatTitleCase(e.target.value))
                }
                list="admin-rubros"
                className={authInputClassName}
              />
              <datalist id="admin-rubros">
                <option value="Kiosco / Almacén" />
                <option value="Verdulería / Frutería" />
                <option value="Carnicería / Granja" />
                <option value="Librería / Varios" />
                <option value="Farmacia" />
                <option value="Gastronomía / Restaurante" />
              </datalist>
            </div>
          </div>

          <button
            type="submit"
            disabled={guardando}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold px-5 py-3 rounded-xl"
          >
            {guardando ? 'Creando…' : 'Dar de alta comercio'}
          </button>
        </form>
      </section>

      {/* b) Gestor de comercios */}
      <section className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">
              Gestor de Comercios ({negociosFiltrados.length})
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Administrá el catálogo o editá información en nombre del comercio.
            </p>
          </div>
          <input
            type="search"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Filtrar…"
            className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm w-full sm:w-56"
          />
        </div>

        <div className="space-y-3">
          {negociosFiltrados.length === 0 ? (
            <p className="text-sm text-slate-500">No hay comercios.</p>
          ) : (
            negociosFiltrados.map((n) => {
              const ownerEmail = emailPorOwner(n.owner_id);
              const hrefPublico = `/${normalizeSlug(n.localidad || 'local')}/${normalizeSlug(n.slug)}`;
              return (
                <div
                  key={n.id}
                  className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div>
                      <p className="font-semibold">{n.nombre_comercio}</p>
                      <p className="text-xs text-slate-400 mt-1">
                        #{n.id} · {n.rubro || 'Sin rubro'} ·{' '}
                        {n.localidad || '—'}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Dueño:{' '}
                        {ownerEmail || (
                          <span className="text-amber-400/80">sin vincular</span>
                        )}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/admin/catalogo/${n.id}`}
                        className="text-xs sm:text-sm bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-xl font-medium"
                      >
                        Administrar Catálogo
                      </Link>
                      <Link
                        href={hrefPublico}
                        className="text-xs sm:text-sm border border-slate-600 hover:bg-slate-700 px-3 py-2 rounded-xl"
                      >
                        Ver ficha
                      </Link>
                    </div>
                  </div>

                  {!n.owner_id && (
                    <form
                      className="flex flex-col sm:flex-row gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const fd = new FormData(e.currentTarget);
                        void vincularOwner(
                          n.id,
                          String(fd.get('email') || '')
                        );
                      }}
                    >
                      <input
                        name="email"
                        type="email"
                        required
                        placeholder="Vincular email del cliente…"
                        className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm"
                      />
                      <button
                        type="submit"
                        className="text-xs border border-slate-600 hover:bg-slate-700 px-3 py-2 rounded-xl"
                      >
                        Vincular dueño
                      </button>
                    </form>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-4">
        <h2 className="text-lg font-bold">Usuarios / Roles ({profiles.length})</h2>
        <div className="space-y-3">
          {profiles.map((p) => (
            <div
              key={p.id}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-800/50 border border-slate-700 rounded-2xl p-4"
            >
              <div>
                <p className="font-medium text-sm break-all">
                  {p.email || p.id}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Rol: {p.role}
                  {p.negocio_id ? ` · negocio #${p.negocio_id}` : ''}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(['usuario', 'comercio', 'admin'] as UserRole[]).map((role) => (
                  <button
                    key={role}
                    type="button"
                    disabled={p.role === role}
                    onClick={() => cambiarRol(p.id, role)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-slate-600 disabled:opacity-40 hover:bg-slate-700"
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
