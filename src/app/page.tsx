'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { normalizeSlug } from '@/lib/slug';

export default function Home() {
  const router = useRouter();
  const [localidadInput, setLocalidadInput] = useState('');

  const [activeBanner, setActiveBanner] = useState(0);
  const banners = [
    { title: "¡Supermercado Los Primos!", offer: "30% OFF en Fideos y Arroz", localidad: "garin", color: "from-blue-600 to-indigo-700" },
    { title: "Kiosco 24hs El Rápido", offer: "2x1 en Energizantes toda la semana", localidad: "garin", color: "from-emerald-600 to-teal-700" }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveBanner((prev) => (prev === 0 ? 1 : 0));
    }, 7000);
    return () => clearInterval(timer);
  }, []);

  const handleBuscarLocalidad = (e: React.FormEvent) => {
    e.preventDefault();
    if (!localidadInput.trim()) return;
    router.push(`/${normalizeSlug(localidadInput)}`);
  };

  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-slate-900 text-white flex flex-col justify-between">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 md:px-8 overflow-x-hidden flex flex-col flex-1">
        {/* HEADER */}
        <header className="w-full flex justify-between items-center gap-3 py-4 sm:py-6">
          <div className="flex items-center gap-2 min-w-0">
            <span className="bg-blue-500 text-white font-black text-sm sm:text-xl px-2.5 py-1 sm:px-3 rounded-xl shrink-0">
              PD
            </span>
            <span className="text-base sm:text-xl font-bold tracking-tight truncate">
              Portal Digital
            </span>
          </div>
          <a
            href="/registro"
            className="shrink-0 bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-2 sm:text-sm sm:px-4 sm:py-2.5 rounded-xl font-medium transition shadow-lg shadow-blue-500/30 whitespace-nowrap"
          >
            Sumar mi Negocio
          </a>
        </header>

        {/* HERO */}
        <section className="w-full max-w-4xl mx-auto text-center py-8 sm:py-12">
          <span className="inline-block bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] sm:text-xs px-3 sm:px-4 py-1.5 rounded-full font-semibold uppercase tracking-wider">
            La Revista Comercial de tu Ciudad
          </span>

          <h1 className="text-2xl sm:text-4xl md:text-5xl font-extrabold mt-4 sm:mt-6 mb-4 sm:mb-6 tracking-tight leading-tight px-1">
            Encontrá los mejores precios y comercios{' '}
            <span className="text-blue-500">cerca tuyo</span>.
          </h1>

          <p className="text-slate-400 text-sm sm:text-base md:text-lg mb-6 sm:mb-8 max-w-2xl mx-auto px-1">
            Kioscos, almacenes, verdulerías y negocios locales actualizados a diario con ofertas reales.
          </p>

          <form
            onSubmit={handleBuscarLocalidad}
            className="bg-slate-800 p-3 rounded-2xl border border-slate-700 w-full max-w-xl mx-auto flex flex-col gap-2 sm:flex-row sm:gap-3 shadow-2xl"
          >
            <input
              type="text"
              placeholder="Escribí tu localidad (Ej: Garín, Tigre...)"
              value={localidadInput}
              onChange={(e) => setLocalidadInput(e.target.value)}
              className="bg-transparent w-full min-w-0 flex-1 px-3 sm:px-4 py-2.5 sm:py-0 text-sm sm:text-base text-white placeholder-slate-400 focus:outline-none"
            />
            <button
              type="submit"
              className="w-full sm:w-auto shrink-0 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl text-sm sm:text-base font-semibold transition"
            >
              Explorar
            </button>
          </form>
        </section>

        {/* OFERTAS */}
        <section className="w-full max-w-5xl mx-auto mb-10 sm:mb-16">
          <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:items-center mb-4">
            <h2 className="text-xs sm:text-sm font-semibold text-slate-400 uppercase tracking-wider">
              Ofertas Destacadas de la Zona
            </h2>
            <span className="text-[11px] sm:text-xs text-slate-500">
              Rotación automática cada 7s
            </span>
          </div>

          <div
            onClick={() => router.push(`/${banners[activeBanner].localidad}`)}
            className={`cursor-pointer bg-gradient-to-r ${banners[activeBanner].color} p-5 sm:p-8 rounded-2xl sm:rounded-3xl shadow-2xl transition-all duration-500 flex flex-col md:flex-row justify-between items-start md:items-center gap-4`}
          >
            <div className="min-w-0">
              <span className="bg-white/20 text-white text-[10px] sm:text-xs px-3 py-1 rounded-full font-medium mb-3 inline-block">
                Oferta Destacada
              </span>
              <h3 className="text-xl sm:text-3xl font-black mb-2 break-words">
                {banners[activeBanner].title}
              </h3>
              <p className="text-white/90 text-sm sm:text-lg break-words">
                {banners[activeBanner].offer}
              </p>
            </div>
            <div className="w-full md:w-auto text-center mt-2 md:mt-0 bg-white text-slate-900 px-6 py-3 rounded-xl font-bold hover:bg-slate-100 transition shadow-lg shrink-0">
              Ver Negocio &rarr;
            </div>
          </div>
        </section>
      </div>

      <footer className="border-t border-slate-800 text-center py-6 px-4 text-slate-500 text-xs sm:text-sm">
        &copy; 2026 Portal Digital. Todos los derechos reservados.
      </footer>
    </main>
  );
}
