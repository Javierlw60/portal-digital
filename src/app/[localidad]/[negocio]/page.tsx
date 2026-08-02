'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

interface Producto {
  id?: number;
  codigo_barras: string;
  nombre_articulo: string;
  marca?: string | null;
  presentacion?: string | null;
  precio: number;
}

interface Negocio {
  id: number;
  nombre_comercio: string;
  domicilio: string;
  localidad: string;
  partido: string;
  provincia: string;
  pais: string;
  rubro: string;
}

export default function NegocioPaginaDefinitiva() {
  const params = useParams();

  const slugNegocio = params?.negocio as string;

  const [negocio, setNegocio] = useState<Negocio | null>(null);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);

  // Formulario
  const [codigoBarras, setCodigoBarras] = useState('');
  const [nombreProducto, setNombreProducto] = useState('');
  const [precioProducto, setPrecioProducto] = useState('');
  const [marcaProducto, setMarcaProducto] = useState('');
  const [presentacionProducto, setPresentacionProducto] = useState('');
  const [guardando, setGuardando] = useState(false);

  // Estado del Escáner de Cámara
  const [mostrarEscaner, setMostrarEscaner] = useState(false);
  const [espejoCamara, setEspejoCamara] = useState(false);

  // Auto-capitalización (Title Case)
  const formatTitleCase = (str: string) => {
    return str.replace(/\b\w/g, (char) => char.toUpperCase());
  };

  // 1. Cargar Negocio y Productos desde Supabase
  useEffect(() => {
    async function cargarDatos() {
      if (!slugNegocio) return;
      setLoading(true);

      const { data: negocioData, error: negocioError } = await supabase
        .from('negocios')
        .select('*')
        .eq('slug', slugNegocio)
        .single();

      if (negocioError || !negocioData) {
        console.error('Negocio no encontrado:', negocioError);
        setLoading(false);
        return;
      }

      setNegocio(negocioData);

      const { data: productosData } = await supabase
        .from('productos')
        .select('*')
        .eq('negocio_id', negocioData.id)
        .order('id', { ascending: false });

      if (productosData) setProductos(productosData);
      setLoading(false);
    }

    cargarDatos();
  }, [slugNegocio]);

  // 2. Control universal de cámara (móvil + laptop, espejo solo frontal)
  useEffect(() => {
    let html5QrCode: Html5Qrcode | null = null;
    let cancelled = false;

    if (!mostrarEscaner) {
      setEspejoCamara(false);
      return;
    }

    const formatsToSupport = [
      Html5QrcodeSupportedFormats.EAN_13,
      Html5QrcodeSupportedFormats.EAN_8,
      Html5QrcodeSupportedFormats.CODE_128,
      Html5QrcodeSupportedFormats.UPC_A,
      Html5QrcodeSupportedFormats.UPC_E,
      Html5QrcodeSupportedFormats.QR_CODE,
    ];

    // html5-qrcode: cameraIdOrConfig = string (deviceId) o { facingMode: 'user'|'environment' }.
    // Si hay videoConstraints en config, esa es la que usa getUserMedia (hay que incluir ahí el device).
    type CameraSource = string | { facingMode: 'environment' | 'user' };

    const baseConfig = {
      fps: 15,
      qrbox: { width: 300, height: 150 },
      aspectRatio: 16 / 9,
      experimentalFeatures: {
        useBarCodeDetectorIfSupported: true,
      },
    };

    const isMobileDevice = () =>
      /Android|webOS|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
      (navigator.maxTouchPoints > 1 &&
        typeof window !== 'undefined' &&
        window.matchMedia('(pointer: coarse)').matches);

    const isVirtualCamera = (label: string) => {
      const l = label.toLowerCase();
      return (
        l.includes('smart connect') ||
        l.includes('virtual') ||
        l.includes('obs') ||
        l.includes('manycam')
      );
    };

    const isBackCamera = (label: string) => {
      const l = label.toLowerCase();
      return (
        l.includes('back') ||
        l.includes('rear') ||
        l.includes('environment') ||
        l.includes('trasera') ||
        l.includes('facing back')
      );
    };

    const stopAndClear = async (scanner: Html5Qrcode | null) => {
      if (!scanner) return;
      try {
        if (scanner.isScanning) await scanner.stop();
      } catch {
        /* ignore */
      }
      try {
        scanner.clear();
      } catch {
        /* ignore */
      }
    };

    const createScanner = () =>
      new Html5Qrcode('reader', {
        formatsToSupport,
        verbose: false,
      });

    const buildVideoConstraints = (
      source: CameraSource
    ): MediaTrackConstraints => {
      const soft = {
        width: { ideal: 1280 },
        height: { ideal: 720 },
      };
      if (typeof source === 'string') {
        return { ...soft, deviceId: { exact: source } };
      }
      return { ...soft, facingMode: source.facingMode };
    };

    const startWith = async (
      cameraConfig: CameraSource,
      mirror: boolean
    ): Promise<boolean> => {
      await stopAndClear(html5QrCode);
      if (cancelled) return false;

      html5QrCode = createScanner();
      setEspejoCamara(mirror);

      await html5QrCode.start(
        cameraConfig,
        {
          ...baseConfig,
          videoConstraints: buildVideoConstraints(cameraConfig),
        },
        (decodedText) => {
          setCodigoBarras(decodedText);
          setMostrarEscaner(false);
          stopAndClear(html5QrCode);
        },
        () => {}
      );

      return !cancelled;
    };

    const iniciarCamara = async () => {
      type Intento = { source: CameraSource; mirror: boolean };
      const intentos: Intento[] = [];

      try {
        const devices = await Html5Qrcode.getCameras();
        const fisicas = (devices ?? []).filter(
          (d) => !isVirtualCamera(d.label || '')
        );

        if (isMobileDevice()) {
          intentos.push({ source: { facingMode: 'environment' }, mirror: false });
          intentos.push({ source: { facingMode: 'user' }, mirror: true });

          for (const d of fisicas) {
            intentos.push({
              source: d.id,
              mirror: !isBackCamera(d.label || ''),
            });
          }
        } else {
          const preferida = fisicas[0] ?? devices?.[0];
          if (preferida) {
            intentos.push({
              source: preferida.id,
              // Laptop: casi siempre frontal → espejo activo salvo cámara claramente trasera
              mirror: !isBackCamera(preferida.label || ''),
            });
          }

          intentos.push({ source: { facingMode: 'user' }, mirror: true });
          intentos.push({ source: { facingMode: 'environment' }, mirror: false });
        }
      } catch (listErr) {
        console.warn('No se pudieron listar cámaras:', listErr);
      }

      // Fallbacks finales universales
      intentos.push({ source: { facingMode: 'environment' }, mirror: false });
      intentos.push({ source: { facingMode: 'user' }, mirror: true });

      let lastError: unknown;
      for (const intento of intentos) {
        if (cancelled) return;
        try {
          const ok = await startWith(intento.source, intento.mirror);
          if (ok) return;
        } catch (err) {
          lastError = err;
          console.warn('Intento de cámara fallido, probando siguiente…', err);
        }
      }

      if (!cancelled) {
        console.error('Error al iniciar cámara:', lastError);
        alert('No se pudo acceder a la cámara. Verificá los permisos del navegador.');
        setMostrarEscaner(false);
      }
    };

    iniciarCamara();

    return () => {
      cancelled = true;
      stopAndClear(html5QrCode);
    };
  }, [mostrarEscaner]);

  // 3. Guardar Producto en Supabase
  const limpiarFormularioProducto = () => {
    setCodigoBarras('');
    setNombreProducto('');
    setPrecioProducto('');
    setMarcaProducto('');
    setPresentacionProducto('');
  };

  const handleAgregarProducto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!negocio) return;

    if (!nombreProducto.trim()) {
      alert('Completá el Nombre del Artículo.');
      return;
    }

    const nuevoPrecio = parseFloat(precioProducto);
    if (!precioProducto || Number.isNaN(nuevoPrecio) || nuevoPrecio < 0) {
      alert('Ingresá un Precio ($) válido.');
      return;
    }

    setGuardando(true);

    const { data, error } = await supabase
      .from('productos')
      .insert([
        {
          negocio_id: negocio.id,
          codigo_barras: codigoBarras.trim() || null,
          nombre_articulo: nombreProducto.trim(),
          marca: marcaProducto.trim() || null,
          presentacion: presentacionProducto.trim() || null,
          precio: nuevoPrecio,
        },
      ])
      .select();

    setGuardando(false);

    if (error) {
      console.error('Error al guardar producto:', error);
      const tipPermisos =
        error.code === '42501' || /permission|policy|rls/i.test(error.message)
          ? ' Verificá los permisos (RLS) de la tabla productos.'
          : '';
      alert(`Error al guardar: ${error.message}.${tipPermisos}`);
      return;
    }

    if (data && data.length > 0) {
      setProductos([data[0], ...productos]);
      limpiarFormularioProducto();
      alert('Producto guardado con éxito.');
    } else {
      alert('Error al guardar: no se recibió confirmación de Supabase. Verificá permisos.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <p className="animate-pulse text-lg font-medium">Cargando portal...</p>
      </div>
    );
  }

  if (!negocio) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-2xl font-bold mb-4">Comercio no encontrado</h1>
        <Link href="/registro" className="bg-blue-600 px-6 py-2.5 rounded-xl font-semibold">
          Registrar un nuevo comercio
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans">
      {/* NAVBAR */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-50 px-4 py-3">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <Link href="/" className="font-extrabold text-xl tracking-tight text-blue-400 flex items-center gap-2">
            <span>🌐</span> Portal Digital
          </Link>
          <nav className="flex items-center gap-3 text-sm">
            <Link href="/" className="text-slate-300 hover:text-white px-3 py-1.5 rounded-lg transition">
              Inicio
            </Link>
            <Link
              href="/registro"
              className="bg-blue-600 hover:bg-blue-500 text-white font-medium px-4 py-1.5 rounded-xl transition shadow-md shadow-blue-600/20"
            >
              + Sumar Comercio
            </Link>
          </nav>
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 md:p-8 space-y-6">
        {/* TARJETA DEL COMERCIO */}
        <section className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <span className="text-xs uppercase tracking-widest bg-blue-500/20 text-blue-400 py-1 px-3 rounded-full font-bold border border-blue-500/30">
              {negocio.rubro || 'Comercio'}
            </span>
            <h1 className="text-3xl md:text-4xl font-black mt-3">{formatTitleCase(negocio.nombre_comercio)}</h1>
            <p className="text-slate-400 text-sm mt-1 flex items-center gap-1">
              📍 {formatTitleCase(negocio.domicilio)}, {formatTitleCase(negocio.localidad)}, {formatTitleCase(negocio.partido)}, {formatTitleCase(negocio.provincia)}, {formatTitleCase(negocio.pais)}
            </p>
          </div>
          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-4 py-2 rounded-xl text-xs font-bold tracking-wide">
            ● Suscripción Activa
          </span>
        </section>

        {/* CARGA RÁPIDA DE PRODUCTOS */}
        <section className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-2xl space-y-4">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <h2 className="text-lg font-bold text-blue-400 flex items-center gap-2">
              ⚡ Carga Rápida de Productos
            </h2>
            <button
              type="button"
              onClick={() => setMostrarEscaner(!mostrarEscaner)}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2"
            >
              📷 {mostrarEscaner ? 'Cerrar Cámara' : 'Escanear con Cámara'}
            </button>
          </div>

          {/* VISOR DE CÁMARA */}
          {mostrarEscaner && (
            <div className="bg-slate-950 border border-slate-800 p-4 rounded-3xl max-w-xl mx-auto shadow-2xl">
              <div
                id="reader"
                className={`w-full overflow-hidden rounded-2xl ${
                  espejoCamara ? '[&_video]:-scale-x-100' : ''
                }`}
              />
              <p className="text-xs text-slate-400 text-center mt-3 font-medium">
                Apuntá el código de barras al centro del recuadro
              </p>
            </div>
          )}

          <form onSubmit={handleAgregarProducto} className="space-y-4">
            {/* Fila 1: Código de Barras + Precio */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="codigo-barras"
                  className="block text-xs font-medium text-slate-400 mb-1"
                >
                  Código de Barras
                </label>
                <input
                  id="codigo-barras"
                  type="text"
                  placeholder="Escáner o manual..."
                  value={codigoBarras}
                  onChange={(e) => setCodigoBarras(e.target.value)}
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label
                  htmlFor="precio-producto"
                  className="block text-xs font-medium text-slate-400 mb-1"
                >
                  Precio ($)
                </label>
                <input
                  id="precio-producto"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  placeholder="Ej: 1000"
                  value={precioProducto}
                  onChange={(e) => setPrecioProducto(e.target.value)}
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Fila 2: Nombre del Artículo */}
            <div>
              <label
                htmlFor="nombre-articulo"
                className="block text-xs font-medium text-slate-400 mb-1"
              >
                Nombre del Artículo
              </label>
              <input
                id="nombre-articulo"
                type="text"
                required
                placeholder="Ej: Palitos Salados"
                value={nombreProducto}
                onChange={(e) => setNombreProducto(formatTitleCase(e.target.value))}
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Fila 3: Marca + Presentación */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="marca-producto"
                  className="block text-xs font-medium text-slate-400 mb-1"
                >
                  Marca
                </label>
                <input
                  id="marca-producto"
                  type="text"
                  placeholder='Ej: "Si Diet", "Coca-Cola"'
                  value={marcaProducto}
                  onChange={(e) => setMarcaProducto(formatTitleCase(e.target.value))}
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label
                  htmlFor="presentacion-producto"
                  className="block text-xs font-medium text-slate-400 mb-1"
                >
                  Presentación / Contenido
                </label>
                <input
                  id="presentacion-producto"
                  type="text"
                  placeholder='Ej: "500 ml", "1 L", "Caja x 12"'
                  value={presentacionProducto}
                  onChange={(e) => setPresentacionProducto(e.target.value)}
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={guardando}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition shadow-lg shadow-blue-600/30 disabled:opacity-50"
            >
              {guardando ? 'Guardando...' : 'Agregar Producto'}
            </button>
          </form>
        </section>

        {/* CATÁLOGO ACTUALIZADO */}
        <section className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-2xl space-y-4">
          <h2 className="text-lg font-bold">Catálogo Actualizado ({productos.length})</h2>

          {productos.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-6">No hay productos registrados todavía.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {productos.map((prod) => (
                <div
                  key={prod.id ?? `${prod.codigo_barras}-${prod.nombre_articulo}-${prod.precio}`}
                  className="bg-slate-800/60 border border-slate-700/80 p-4 rounded-2xl flex justify-between items-start gap-3"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-white break-words">
                      {prod.nombre_articulo}
                    </p>
                    {(prod.marca || prod.presentacion) && (
                      <p className="text-xs text-slate-300 mt-1 break-words">
                        {[prod.marca, prod.presentacion].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    <p className="text-xs text-slate-400 mt-1">
                      Código: {prod.codigo_barras || 'Sin código'}
                    </p>
                  </div>
                  <span className="text-emerald-400 font-bold text-lg shrink-0">
                    ${prod.precio}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}