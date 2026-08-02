import React from 'react';

// Esta página recibe el parámetro de la localidad desde la URL (ej: /garin)
export default async function LocalidadPage({ params }: { params: { localidad: string } }) {
  // En Next.js 15+, params puede ser una promesa, lo manejamos de forma segura:
  const resolvedParams = await params;
  const localidadNombre = resolvedParams.localidad
    .replace(/-/g, ' ')
    .toUpperCase();

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 p-8">
      <div className="max-w-6xl mx-auto">
        <header className="bg-white shadow-md rounded-xl p-6 mb-8 flex justify-between items-center">
          <div>
            <span className="text-sm font-semibold text-blue-600 uppercase tracking-wider">Portal Digital Local</span>
            <h1 className="text-3xl font-extrabold capitalize">{localidadNombre}</h1>
          </div>
          <div className="flex gap-4">
            <a 
              href="#comercios" 
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition"
            >
              Ver Comercios
            </a>
            <a 
              href="/registro" 
              className="border border-blue-600 text-blue-600 px-4 py-2 rounded-lg font-medium hover:bg-blue-50 transition"
            >
              Sumar mi Negocio
            </a>
          </div>
        </header>

        {/* Sección de Ofertas Destacadas (Las 2 ventanas con rotación) */}
        <section className="mb-12">
          <h2 className="text-xl font-bold mb-4">Ofertas Destacadas en {localidadNombre}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white p-8 rounded-2xl shadow-lg flex flex-col justify-between h-48">
              <span className="bg-white/20 text-xs px-3 py-1 rounded-full w-max">Oferta Premium</span>
              <div>
                <h3 className="text-2xl font-bold">¡Ventana de Ofertas 1!</h3>
                <p className="text-sm text-blue-100">Rotación automática configurable (Ej. 7 segundos)</p>
              </div>
            </div>
            <div className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white p-8 rounded-2xl shadow-lg flex flex-col justify-between h-48">
              <span className="bg-white/20 text-xs px-3 py-1 rounded-full w-max">Oferta Premium</span>
              <div>
                <h3 className="text-2xl font-bold">¡Ventana de Ofertas 2!</h3>
                <p className="text-sm text-emerald-100">Haz clic para ir al catálogo del local</p>
              </div>
            </div>
          </div>
        </section>

        {/* Listado de Comercios de la Localidad */}
        <section id="comercios">
          <h2 className="text-xl font-bold mb-4">Negocios y Kioscos Registrados</h2>
          <div className="bg-white rounded-xl shadow p-6 text-center text-gray-500">
            Aún no hay comercios cargados en esta localidad. ¡Sé el primero en registrarte!
          </div>
        </section>
      </div>
    </main>
  );
}