'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function RegistroPage() {
  const router = useRouter();
  const [nombreComercio, setNombreComercio] = useState('');
  const [domicilio, setDomicilio] = useState('');
  const [localidad, setLocalidad] = useState('');
  const [partido, setPartido] = useState('');
  const [provincia, setProvincia] = useState('Buenos Aires');
  const [pais, setPais] = useState('Argentina');
  const [rubro, setRubro] = useState('');
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState('');

  // Función para capitalizar la primera letra de cada palabra automáticamente
  const formatTitleCase = (value: string) => {
    return value.replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMensaje('');

    try {
      const slugLocalidad = localidad.trim().toLowerCase().replace(/\s+/g, '-');
      const slugNegocio = nombreComercio.trim().toLowerCase().replace(/\s+/g, '-');

      const { error } = await supabase.from('negocios').insert([
        {
          nombre_comercio: nombreComercio,
          domicilio,
          localidad: slugLocalidad,
          partido,
          provincia,
          pais,
          rubro,
          slug: slugNegocio,
          tema_id: 1
        },
      ]);

      if (error) throw error;

      setMensaje(`¡Negocio "${nombreComercio}" registrado con éxito!`);
      setTimeout(() => {
        router.push(`/${slugLocalidad}/${slugNegocio}`);
      }, 1000);
    } catch (error: any) {
      console.error('Error al registrar:', error.message);
      setMensaje('Error al registrar el comercio: ' + error.message);
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-lg bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-3xl p-8 shadow-2xl text-white">
        <div className="text-center mb-6">
          <span className="text-xs uppercase tracking-widest bg-blue-600/30 text-blue-400 py-1 px-3 rounded-full font-semibold">
            Unite a la Red
          </span>
          <h1 className="text-3xl font-bold mt-3">Sumá tu Negocio al Portal</h1>
        </div>

        {mensaje && (
          <div className={`p-3 mb-4 rounded-xl text-sm text-center ${mensaje.includes('éxito') ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'}`}>
            {mensaje}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Nombre del Comercio</label>
            <input
              type="text"
              required
              value={nombreComercio}
              onChange={(e) => setNombreComercio(formatTitleCase(e.target.value))}
              placeholder="Ej: Kiosco Don Pedro"
              className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Domicilio (Calle y Número)</label>
            <input
              type="text"
              required
              value={domicilio}
              onChange={(e) => setDomicilio(formatTitleCase(e.target.value))}
              placeholder="Ej: Av. Principal 123"
              className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Localidad / Ciudad</label>
              <input
                type="text"
                required
                value={localidad}
                onChange={(e) => setLocalidad(formatTitleCase(e.target.value))}
                placeholder="Ej: Garín"
                className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Partido / Departamento</label>
              <input
                type="text"
                required
                value={partido}
                onChange={(e) => setPartido(formatTitleCase(e.target.value))}
                placeholder="Ej: Escobar"
                className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Provincia</label>
              <input
                type="text"
                required
                value={provincia}
                onChange={(e) => setProvincia(formatTitleCase(e.target.value))}
                placeholder="Ej: Buenos Aires"
                className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">País</label>
              <input
                type="text"
                required
                value={pais}
                onChange={(e) => setPais(formatTitleCase(e.target.value))}
                placeholder="Ej: Argentina"
                className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Rubro Principal</label>
            <input
              type="text"
              required
              list="rubros-sugerencias"
              value={rubro}
              onChange={(e) => setRubro(formatTitleCase(e.target.value))}
              placeholder="Elegí o escribí tu rubro..."
              className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
            />
            <datalist id="rubros-sugerencias">
              <option value="Kiosco / Almacén" />
              <option value="Verdulería / Frutería" />
              <option value="Carnicería / Granja" />
              <option value="Librería / Varios" />
              <option value="Farmacia" />
              <option value="Perfumería" />
              <option value="Cafetería" />
              <option value="Panchería" />
              <option value="Artículos de Limpieza" />
              <option value="Papelera" />
              <option value="Ferretería" />
              <option value="Pet Shop" />
              <option value="Heladería" />
              <option value="Panadería" />
              <option value="Indumentaria / Calzado" />
              <option value="Gastronomía / Restaurante" />
            </datalist>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3.5 rounded-xl transition shadow-lg shadow-blue-600/30 mt-6 disabled:opacity-50"
          >
            {loading ? 'Registrando...' : 'Registrar mi Comercio'}
          </button>
        </form>
      </div>
    </main>
  );
}