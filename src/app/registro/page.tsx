'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import { normalizeComparable, normalizeSlug } from '@/lib/slug';
import {
  PasswordField,
  authInputClassName,
  authLabelClassName,
} from '@/components/PasswordField';
import {
  clearPendingNegocio,
  readPendingNegocio,
  savePendingNegocio,
  type PendingNegocio,
} from '@/lib/pending-negocio';
import { findOwnedNegocio } from '@/lib/owned-negocio';

const MSG_DUPLICADO =
  'Ya existe un comercio registrado con este nombre en esa dirección.';

export default function RegistroPage() {
  const router = useRouter();
  const { user, profile, refreshProfile } = useAuth();
  const supabase = createClient();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombreComercio, setNombreComercio] = useState('');
  const [domicilio, setDomicilio] = useState('');
  const [localidad, setLocalidad] = useState('');
  const [partido, setPartido] = useState('');
  const [provincia, setProvincia] = useState('Buenos Aires');
  const [pais, setPais] = useState('Argentina');
  const [rubro, setRubro] = useState('');
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState('');

  const formatTitleCase = (value: string) =>
    value.replace(/\b\w/g, (char) => char.toUpperCase());

  const completarNegocioPendiente = async (pending: PendingNegocio, userId: string) => {
    const { data: inserted, error } = await supabase
      .from('negocios')
      .insert([
        {
          nombre_comercio: pending.nombre_comercio,
          domicilio: pending.domicilio,
          localidad: pending.slugLocalidad,
          partido: pending.partido,
          provincia: pending.provincia,
          pais: pending.pais,
          rubro: pending.rubro,
          slug: pending.slug,
          owner_id: userId,
          tema_id: 1,
        },
      ])
      .select('id')
      .single();

    if (error) throw error;

    await supabase
      .from('profiles')
      .update({ role: 'comercio', negocio_id: inserted.id })
      .eq('id', userId);

    clearPendingNegocio();
    await refreshProfile();
    return pending;
  };

  useEffect(() => {
    async function resumeOrRedirect() {
      if (!user) return;

      // Si ya tiene comercio (owner_id o profile), no volver a "Unite a la red"
      const existing = await findOwnedNegocio(
        supabase,
        user.id,
        profile?.negocio_id
      );
      if (existing || profile?.negocio_id) {
        clearPendingNegocio();
        router.replace('/mi-negocio');
        return;
      }

      const pending = readPendingNegocio();
      if (!pending) return;
      setLoading(true);
      try {
        const done = await completarNegocioPendiente(pending, user.id);
        setMensaje(`¡Negocio "${done.nombre_comercio}" registrado con éxito!`);
        router.push('/mi-negocio');
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        setMensaje('No se pudo completar el registro del comercio: ' + message);
      } finally {
        setLoading(false);
      }
    }
    resumeOrRedirect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, profile?.negocio_id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMensaje('');

    try {
      const slugLocalidad = normalizeSlug(localidad);
      const slugNegocio = normalizeSlug(nombreComercio);
      const nombreNorm = normalizeComparable(nombreComercio);
      const domicilioNorm = normalizeComparable(domicilio);

      if (!slugLocalidad || !slugNegocio) {
        setMensaje('Completá un nombre y una localidad válidos.');
        return;
      }

      const { data: porSlug, error: errorSlug } = await supabase
        .from('negocios')
        .select('id, slug, nombre_comercio, domicilio, localidad')
        .eq('slug', slugNegocio)
        .maybeSingle();

      if (errorSlug) throw errorSlug;
      if (porSlug) {
        setMensaje(MSG_DUPLICADO);
        return;
      }

      const { data: enLocalidad, error: errorLocalidad } = await supabase
        .from('negocios')
        .select('id, slug, nombre_comercio, domicilio, localidad')
        .ilike('localidad', `%${slugLocalidad}%`)
        .limit(200);

      if (errorLocalidad) throw errorLocalidad;

      const duplicado = (enLocalidad ?? []).some((n) => {
        const mismaLocalidad = normalizeSlug(n.localidad || '') === slugLocalidad;
        const mismoNombre =
          normalizeComparable(n.nombre_comercio || '') === nombreNorm;
        const mismaDireccion =
          normalizeComparable(n.domicilio || '') === domicilioNorm;
        const mismoSlugNorm = normalizeSlug(n.slug || '') === slugNegocio;
        return mismoSlugNorm || (mismaLocalidad && mismoNombre && mismaDireccion);
      });

      if (duplicado) {
        setMensaje(MSG_DUPLICADO);
        return;
      }

      const pending: PendingNegocio = {
        nombre_comercio: nombreComercio.trim(),
        domicilio: domicilio.trim(),
        localidad: localidad.trim(),
        partido: partido.trim(),
        provincia: provincia.trim(),
        pais: pais.trim(),
        rubro: rubro.trim(),
        slug: slugNegocio,
        slugLocalidad,
      };

      let userId = user?.id;

      if (!userId) {
        if (!email.trim() || password.length < 6) {
          setMensaje('Completá email y contraseña (mínimo 6 caracteres).');
          return;
        }

        const origin = window.location.origin;
        const { data: signData, error: signError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { role: 'comercio' },
            emailRedirectTo: `${origin}/auth/callback?next=/cuenta`,
          },
        });

        if (signError) throw signError;

        if (!signData.session) {
          savePendingNegocio(pending);
          router.push(`/verificar-email?email=${encodeURIComponent(email.trim())}`);
          return;
        }

        userId = signData.user?.id;
      }

      if (!userId) {
        setMensaje('No se pudo obtener la sesión. Confirmá tu email e ingresá.');
        return;
      }

      // Si ya tenía negocio, no duplicar
      const existing = await findOwnedNegocio(supabase, userId, profile?.negocio_id);
      if (existing || profile?.negocio_id) {
        setMensaje('Ya tenés un comercio asociado a tu cuenta.');
        router.replace('/mi-negocio');
        return;
      }

      const done = await completarNegocioPendiente(pending, userId);
      setMensaje(`¡Negocio "${done.nombre_comercio}" registrado con éxito!`);
      setTimeout(() => {
        router.push('/mi-negocio');
      }, 800);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (/duplicate|unique|23505/i.test(message)) {
        setMensaje(MSG_DUPLICADO);
      } else {
        setMensaje('Error al registrar el comercio: ' + message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex-1 flex items-center justify-center p-4 bg-slate-950 text-white">
      <div className="w-full max-w-lg bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-white">
        <div className="text-center mb-6">
          <span className="text-xs uppercase tracking-widest bg-blue-600/30 text-blue-400 py-1 px-3 rounded-full font-semibold">
            Unite a la Red
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold mt-3 text-white">Sumá tu Negocio al Portal</h1>
          <p className="text-sm text-slate-400 mt-2">
            Creá tu cuenta con email. Te enviamos un enlace de confirmación.
          </p>
        </div>

        {mensaje && (
          <div
            className={`p-3 mb-4 rounded-xl text-sm text-center ${
              mensaje.includes('éxito')
                ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                : 'bg-red-500/20 text-red-300 border border-red-500/30'
            }`}
          >
            {mensaje}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!user && (
            <div className="grid grid-cols-1 gap-4 p-4 rounded-2xl bg-slate-950/50 border border-slate-800">
              <div>
                <label htmlFor="comercio-email" className={authLabelClassName}>
                  Email de acceso
                </label>
                <input
                  id="comercio-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="comercio@email.com"
                  className={authInputClassName}
                  autoComplete="email"
                />
              </div>
              <PasswordField
                id="comercio-password"
                value={password}
                onChange={setPassword}
                labelClassName={authLabelClassName}
                autoComplete="new-password"
              />
            </div>
          )}

          <div>
            <label htmlFor="nombre-comercio" className={authLabelClassName}>
              Nombre del Comercio
            </label>
            <input
              id="nombre-comercio"
              type="text"
              required
              value={nombreComercio}
              onChange={(e) => setNombreComercio(formatTitleCase(e.target.value))}
              placeholder="Ej: Kiosco Don Pedro"
              className={authInputClassName}
            />
          </div>

          <div>
            <label htmlFor="domicilio-comercio" className={authLabelClassName}>
              Domicilio (Calle y Número)
            </label>
            <input
              id="domicilio-comercio"
              type="text"
              required
              value={domicilio}
              onChange={(e) => setDomicilio(formatTitleCase(e.target.value))}
              placeholder="Ej: Av. Principal 123"
              className={authInputClassName}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={authLabelClassName}>
                Localidad / Ciudad
              </label>
              <input
                type="text"
                required
                value={localidad}
                onChange={(e) => setLocalidad(formatTitleCase(e.target.value))}
                placeholder="Ej: Garín"
                className={authInputClassName}
              />
            </div>
            <div>
              <label className={authLabelClassName}>
                Partido / Departamento
              </label>
              <input
                type="text"
                required
                value={partido}
                onChange={(e) => setPartido(formatTitleCase(e.target.value))}
                placeholder="Ej: Escobar"
                className={authInputClassName}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={authLabelClassName}>
                Provincia
              </label>
              <input
                type="text"
                required
                value={provincia}
                onChange={(e) => setProvincia(formatTitleCase(e.target.value))}
                className={authInputClassName}
              />
            </div>
            <div>
              <label className={authLabelClassName}>País</label>
              <input
                type="text"
                required
                value={pais}
                onChange={(e) => setPais(formatTitleCase(e.target.value))}
                className={authInputClassName}
              />
            </div>
          </div>

          <div>
            <label className={authLabelClassName}>
              Rubro Principal
            </label>
            <input
              type="text"
              required
              list="rubros-sugerencias"
              value={rubro}
              onChange={(e) => setRubro(formatTitleCase(e.target.value))}
              placeholder="Elegí o escribí tu rubro..."
              className={authInputClassName}
            />
            <datalist id="rubros-sugerencias">
              <option value="Kiosco / Almacén" />
              <option value="Verdulería / Frutería" />
              <option value="Carnicería / Granja" />
              <option value="Librería / Varios" />
              <option value="Farmacia" />
              <option value="Gastronomía / Restaurante" />
            </datalist>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3.5 rounded-xl transition shadow-lg shadow-blue-600/30 mt-2 disabled:opacity-50"
          >
            {loading ? 'Registrando...' : 'Registrar mi Comercio'}
          </button>
        </form>

        <p className="text-sm text-slate-400 text-center mt-5">
          ¿Ya tenés cuenta?{' '}
          <Link href="/login" className="text-blue-400 hover:underline">
            Ingresar
          </Link>
        </p>
      </div>
    </main>
  );
}
