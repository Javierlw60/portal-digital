'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

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
    const slug = localidadInput.trim().toLowerCase().replace(/\s+/g, '-');
    router.push(`/${slug}`);
  };

  return (
    <main className="min-h-screen bg-slate-900 text-white flex flex-col justify-between">
      <header className="max-w-6xl mx-auto w-full p-6 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="bg-blue-500 text-white font-black text-xl px-3 py-1 rounded-xl">PD</span>
          <span className="text-xl font-bold tracking-tight">Portal Digital</span>
        </div>
        <a 
          href="/registro" 
          className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-xl font-medium transition shadow-lg shadow-blue-500/30"
        >
          Sumar mi Negocio
        </a>
      </header>

      <section className="max-w-4xl mx-auto text-center px-4 py-12">
        <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs px-4 py-1.5 rounded-full font-semibold uppercase tracking-wider">
          La Revista Comercial de tu Ciudad
        </span>
        <h1 className="text-4xl md:text-6xl font-extrabold mt-6 mb-6 tracking-tight">
          Encontrá los mejores precios y comercios <span className="text-blue-500">cerca tuyo</span>.
        </h1>
        <p className="text-slate-400 text-lg mb-8 max-w-2xl mx-auto">
          Kioscos, almacenes, verdulerías y negocios locales actualizados a diario con ofertas reales.
        </p>

        <form onSubmit={handleBuscarLocalidad} className="bg-slate-800 p-3 rounded-2xl border border-slate-700 max-w-xl mx-auto flex gap-3 shadow-2xl">
          <input 
            type="text" 
            placeholder="Escribí tu localidad (Ej: Garín, Tigre, Escobar)..." 
            value={localidadInput}
            onChange={(e) => setLocalidadInput(e.target.value)}
            className="bg-transparent flex-1 px-4 text-white placeholder-slate-400 focus:outline-none"
          />
          <button 
            type="submit" 
            className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-semibold transition"
          >
            Explorar
          </button>
        </form>
      </section>

      <section className="max-w-5xl mx-auto w-full px-4 mb-16">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Ofertas Destacadas de la Zona</h2>
          <span className="text-xs text-slate-500">Rotación automática cada 7s</span>
        </div>
        
        <div 
          onClick={() => router.push(`/${banners[activeBanner].localidad}`)}
          className={`cursor-pointer bg-gradient-to-r ${banners[activeBanner].color} p-8 rounded-3xl shadow-2xl transition-all duration-500 flex flex-col md:flex-row justify-between items-center`}
        >
          <div>
            <span className="bg-white/20 text-white text-xs px-3 py-1 rounded-full font-medium mb-3 inline-block">
              🔥 Oferta Destacada
            </span>
            <h3 className="text-3xl font-black mb-2">{banners[activeBanner].title}</h3>
            <p className="text-white/90 text-lg">{banners[activeBanner].offer}</p>
          </div>
          <div className="mt-6 md:mt-0 bg-white text-slate-900 px-6 py-3 rounded-xl font-bold hover:bg-slate-100 transition shadow-lg">
            Ver Negocio &rarr;
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-800 text-center py-6 text-slate-500 text-sm">
        &copy; 2026 Portal Digital. Todos los derechos reservados.
      </footer>
    </main>
  );
}