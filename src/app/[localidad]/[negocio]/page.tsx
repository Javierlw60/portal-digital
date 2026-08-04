'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { compressImageFile } from '@/lib/compressImage';
import { normalizeSlug } from '@/lib/slug';
import { useAuth } from '@/components/AuthProvider';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

const supabase = createClient();

const BUCKET_FOTOS = 'productos-fotos';

interface Producto {
  id?: number;
  codigo_barras: string | null;
  nombre_articulo: string;
  marca?: string | null;
  presentacion?: string | null;
  precio: number;
  foto_url?: string | null;
}

interface Negocio {
  id: number;
  nombre_comercio: string;
  slug?: string;
  domicilio: string;
  localidad: string;
  partido: string;
  provincia: string;
  pais: string;
  rubro: string;
}

export default function NegocioPaginaDefinitiva() {
  const params = useParams();
  const { canManageNegocio, loading: authLoading } = useAuth();

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
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [fotoBlob, setFotoBlob] = useState<Blob | null>(null);
  const [fotoUrlActual, setFotoUrlActual] = useState<string | null>(null);
  const [productoEditandoId, setProductoEditandoId] = useState<number | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [procesandoFoto, setProcesandoFoto] = useState(false);
  const [autocompletando, setAutocompletando] = useState(false);

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

      const slugRaw = decodeURIComponent(slugNegocio);
      const slugNorm = normalizeSlug(slugRaw);

      // Match exacto, luego sin tildes (librería-loly → libreria-loly)
      let negocioData: Negocio | null = null;

      const intentoExacto = await supabase
        .from('negocios')
        .select('*')
        .eq('slug', slugRaw)
        .maybeSingle();

      if (intentoExacto.data) {
        negocioData = intentoExacto.data;
      } else {
        const intentoNorm = await supabase
          .from('negocios')
          .select('*')
          .eq('slug', slugNorm)
          .maybeSingle();

        if (intentoNorm.data) {
          negocioData = intentoNorm.data;
        } else {
          const { data: candidatos, error: candidatosError } = await supabase
            .from('negocios')
            .select('*')
            .limit(200);

          if (candidatosError) {
            console.error('Negocio no encontrado:', candidatosError);
          }

          negocioData =
            candidatos?.find((n) => normalizeSlug(n.slug || '') === slugNorm) ??
            null;

          if (!negocioData) {
            console.error('Negocio no encontrado:', {
              slugRaw,
              slugNorm,
              error: intentoExacto.error || intentoNorm.error,
            });
          }
        }
      }

      if (!negocioData) {
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

  // Autocompletado global por código de barras
  useEffect(() => {
    const codigo = codigoBarras.trim();
    if (codigo.length < 6 || productoEditandoId) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      setAutocompletando(true);
      try {
        const { data: comunidad } = await supabase
          .from('productos')
          .select('nombre_articulo, marca, presentacion, foto_url')
          .eq('codigo_barras', codigo)
          .not('nombre_articulo', 'is', null)
          .order('id', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (cancelled) return;

        if (comunidad) {
          if (!nombreProducto.trim() && comunidad.nombre_articulo) {
            setNombreProducto(comunidad.nombre_articulo);
          }
          if (!marcaProducto.trim() && comunidad.marca) {
            setMarcaProducto(comunidad.marca);
          }
          if (!presentacionProducto.trim() && comunidad.presentacion) {
            setPresentacionProducto(comunidad.presentacion);
          }
          if (!fotoPreview && !fotoBlob && comunidad.foto_url) {
            setFotoUrlActual(comunidad.foto_url);
            setFotoPreview(comunidad.foto_url);
          }
          return;
        }

        const { data: catalogo } = await supabase
          .from('catalogo_global_barras')
          .select('nombre_estandar, marca, presentacion, foto_oficial_url')
          .eq('codigo_barras', codigo)
          .maybeSingle();

        if (cancelled || !catalogo) return;

        if (!nombreProducto.trim() && catalogo.nombre_estandar) {
          setNombreProducto(catalogo.nombre_estandar);
        }
        if (!marcaProducto.trim() && catalogo.marca) {
          setMarcaProducto(catalogo.marca);
        }
        if (!presentacionProducto.trim() && catalogo.presentacion) {
          setPresentacionProducto(catalogo.presentacion);
        }
        if (!fotoPreview && !fotoBlob && catalogo.foto_oficial_url) {
          setFotoUrlActual(catalogo.foto_oficial_url);
          setFotoPreview(catalogo.foto_oficial_url);
        }
      } catch (err) {
        console.warn('Autocompletado por código falló:', err);
      } finally {
        if (!cancelled) setAutocompletando(false);
      }
    }, 450);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // Solo reacciona al código; no reescribe campos ya editados a mano salvo que estén vacíos
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codigoBarras, productoEditandoId]);

  // 3. Guardar / actualizar producto en Supabase
  const limpiarFormularioProducto = () => {
    if (fotoPreview?.startsWith('blob:')) {
      URL.revokeObjectURL(fotoPreview);
    }
    setCodigoBarras('');
    setNombreProducto('');
    setPrecioProducto('');
    setMarcaProducto('');
    setPresentacionProducto('');
    setFotoPreview(null);
    setFotoBlob(null);
    setFotoUrlActual(null);
    setProductoEditandoId(null);
  };

  const handleSeleccionarFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Seleccioná un archivo de imagen válido.');
      return;
    }

    setProcesandoFoto(true);
    try {
      const { blob, previewUrl } = await compressImageFile(file);
      if (fotoPreview?.startsWith('blob:')) {
        URL.revokeObjectURL(fotoPreview);
      }
      setFotoBlob(blob);
      setFotoPreview(previewUrl);
    } catch (err) {
      console.error(err);
      alert('No se pudo procesar la foto. Probá con otra imagen.');
    } finally {
      setProcesandoFoto(false);
    }
  };

  const subirFotoSiHay = async (): Promise<string | null> => {
    if (!fotoBlob || !negocio) return fotoUrlActual;

    const path = `${negocio.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_FOTOS)
      .upload(path, fotoBlob, {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (uploadError) {
      throw new Error(
        `Error al subir la foto: ${uploadError.message}. Verificá el bucket "${BUCKET_FOTOS}" y sus permisos.`
      );
    }

    const { data } = supabase.storage.from(BUCKET_FOTOS).getPublicUrl(path);
    return data.publicUrl;
  };

  const sincronizarCatalogoGlobal = async (
    codigo: string,
    fotoUrl: string | null
  ) => {
    if (!codigo) return;

    const payload = {
      codigo_barras: codigo,
      nombre_estandar: nombreProducto.trim(),
      marca: marcaProducto.trim() || null,
      presentacion: presentacionProducto.trim() || null,
      foto_oficial_url: fotoUrl,
    };

    const { error } = await supabase.from('catalogo_global_barras').upsert(payload, {
      onConflict: 'codigo_barras',
    });

    if (error) {
      console.warn('No se pudo actualizar el catálogo global:', error.message);
    }
  };

  const handleEditarProducto = (prod: Producto) => {
    if (!prod.id) return;
    if (fotoPreview?.startsWith('blob:')) {
      URL.revokeObjectURL(fotoPreview);
    }
    setProductoEditandoId(prod.id);
    setCodigoBarras(prod.codigo_barras || '');
    setNombreProducto(prod.nombre_articulo || '');
    setPrecioProducto(String(prod.precio ?? ''));
    setMarcaProducto(prod.marca || '');
    setPresentacionProducto(prod.presentacion || '');
    setFotoUrlActual(prod.foto_url || null);
    setFotoPreview(prod.foto_url || null);
    setFotoBlob(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleGuardarProducto = async (e: React.FormEvent) => {
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

    try {
      const fotoUrl = await subirFotoSiHay();
      const codigo = codigoBarras.trim() || null;

      const payload = {
        negocio_id: negocio.id,
        codigo_barras: codigo,
        nombre_articulo: nombreProducto.trim(),
        marca: marcaProducto.trim() || null,
        presentacion: presentacionProducto.trim() || null,
        precio: nuevoPrecio,
        foto_url: fotoUrl,
      };

      let data: Producto[] | null = null;
      let errorMessage = '';

      if (productoEditandoId) {
        const { data: updated, error } = await supabase
          .from('productos')
          .update(payload)
          .eq('id', productoEditandoId)
          .select();

        if (error) {
          errorMessage = error.message;
          if (error.code === '42501' || /permission|policy|rls/i.test(error.message)) {
            errorMessage += ' Verificá los permisos (RLS) de la tabla productos.';
          }
        } else {
          data = updated;
        }
      } else {
        const { data: inserted, error } = await supabase
          .from('productos')
          .insert([payload])
          .select();

        if (error) {
          errorMessage = error.message;
          if (error.code === '42501' || /permission|policy|rls/i.test(error.message)) {
            errorMessage += ' Verificá los permisos (RLS) de la tabla productos.';
          }
        } else {
          data = inserted;
        }
      }

      if (errorMessage) {
        alert(`Error al guardar: ${errorMessage}`);
        return;
      }

      if (data && data.length > 0) {
        const guardado = data[0];
        const eraEdicion = Boolean(productoEditandoId);

        if (eraEdicion) {
          setProductos((prev) =>
            prev.map((p) => (p.id === productoEditandoId ? guardado : p))
          );
        } else {
          setProductos((prev) => [guardado, ...prev]);
        }

        if (codigo) {
          await sincronizarCatalogoGlobal(codigo, fotoUrl);
        }

        limpiarFormularioProducto();
        alert(eraEdicion ? 'Producto actualizado con éxito.' : 'Producto guardado con éxito.');
      } else {
        alert('Error al guardar: no se recibió confirmación de Supabase. Verificá permisos.');
      }
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Error al guardar el producto.');
    } finally {
      setGuardando(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 bg-slate-950 text-white flex items-center justify-center">
        <p className="animate-pulse text-lg font-medium">Cargando portal...</p>
      </div>
    );
  }

  if (!negocio) {
    return (
      <div className="flex-1 bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-2xl font-bold mb-4">Comercio no encontrado</h1>
        <Link href="/" className="bg-blue-600 px-6 py-2.5 rounded-xl font-semibold">
          Volver al inicio
        </Link>
      </div>
    );
  }

  const puedeGestionar = !authLoading && canManageNegocio(negocio.id);

  return (
    <div className="flex-1 bg-slate-950 text-white flex flex-col font-sans">
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
              {formatTitleCase(negocio.domicilio)}, {formatTitleCase(negocio.localidad)}, {formatTitleCase(negocio.partido)}, {formatTitleCase(negocio.provincia)}, {formatTitleCase(negocio.pais)}
            </p>
          </div>
          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-4 py-2 rounded-xl text-xs font-bold tracking-wide">
            Catalogo publico
          </span>
        </section>

        {/* CARGA RÁPIDA — solo dueño / admin */}
        {puedeGestionar && (
        <section className="bg-slate-900 border border-slate-800 p-4 sm:p-6 rounded-3xl shadow-2xl space-y-4">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <div>
              <h2 className="text-lg font-bold text-blue-400">
                Carga Rápida de Productos
              </h2>
              {productoEditandoId && (
                <p className="text-xs text-amber-400 mt-1">
                  Editando producto #{productoEditandoId}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {productoEditandoId && (
                <button
                  type="button"
                  onClick={limpiarFormularioProducto}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-2 rounded-xl text-xs font-bold transition"
                >
                  Cancelar
                </button>
              )}
              <button
                type="button"
                onClick={() => setMostrarEscaner(!mostrarEscaner)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition"
              >
                {mostrarEscaner ? 'Cerrar Cámara' : 'Escanear'}
              </button>
            </div>
          </div>

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

          <form onSubmit={handleGuardarProducto} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="codigo-barras"
                  className="block text-xs font-medium text-slate-400 mb-1"
                >
                  Código de Barras
                  {autocompletando && (
                    <span className="ml-2 text-blue-400 font-normal">buscando…</span>
                  )}
                </label>
                <input
                  id="codigo-barras"
                  type="text"
                  inputMode="numeric"
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

            {/* Foto */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-16 h-16 rounded-xl bg-slate-800 border border-slate-700 overflow-hidden shrink-0 flex items-center justify-center">
                  {fotoPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={fotoPreview}
                      alt="Vista previa del producto"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-[10px] text-slate-500 px-1 text-center">Sin foto</span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-300">Foto del producto</p>
                  <p className="text-[11px] text-slate-500">
                    Se comprime a máx. 800px / JPEG 75%
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 sm:ml-auto">
                <label className="cursor-pointer bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-4 py-2.5 rounded-xl text-xs font-bold transition">
                  {procesandoFoto ? 'Procesando…' : 'Tomar / Subir Foto'}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    disabled={procesandoFoto || guardando}
                    onChange={handleSeleccionarFoto}
                  />
                </label>
                {fotoPreview && (
                  <button
                    type="button"
                    onClick={() => {
                      if (fotoPreview?.startsWith('blob:')) {
                        URL.revokeObjectURL(fotoPreview);
                      }
                      setFotoPreview(null);
                      setFotoBlob(null);
                      setFotoUrlActual(null);
                    }}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-3 py-2.5 rounded-xl text-xs font-bold transition"
                  >
                    Quitar
                  </button>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={guardando || procesandoFoto}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition shadow-lg shadow-blue-600/30 disabled:opacity-50"
            >
              {guardando
                ? 'Guardando...'
                : productoEditandoId
                  ? 'Actualizar Producto'
                  : 'Agregar Producto'}
            </button>
          </form>
        </section>
        )}

        {/* CATÁLOGO ACTUALIZADO */}
        <section className="bg-slate-900 border border-slate-800 p-4 sm:p-6 rounded-3xl shadow-2xl space-y-4">
          <h2 className="text-lg font-bold">Catálogo ({productos.length})</h2>

          {productos.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-6">
              No hay productos registrados todavía.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {productos.map((prod) => (
                <div
                  key={prod.id ?? `${prod.codigo_barras}-${prod.nombre_articulo}-${prod.precio}`}
                  className="bg-slate-800/60 border border-slate-700/80 p-4 rounded-2xl flex gap-3"
                >
                  <div className="w-14 h-14 rounded-xl bg-slate-900 border border-slate-700 overflow-hidden shrink-0 flex items-center justify-center">
                    {prod.foto_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={prod.foto_url}
                        alt={prod.nombre_articulo}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-[10px] text-slate-600">N/A</span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-white break-words">
                      {prod.nombre_articulo}
                    </p>
                    {(prod.marca || prod.presentacion) && (
                      <p className="text-xs text-slate-300 mt-0.5 break-words">
                        {[prod.marca, prod.presentacion].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    <p className="text-xs text-slate-400 mt-1">
                      Código: {prod.codigo_barras || 'Sin código'}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className="text-emerald-400 font-bold text-lg">
                      ${prod.precio}
                    </span>
                    {puedeGestionar && (
                      <button
                        type="button"
                        onClick={() => handleEditarProducto(prod)}
                        className="text-xs font-bold text-slate-300 hover:text-white bg-slate-900/80 border border-slate-700 px-2.5 py-1.5 rounded-lg transition"
                        title="Editar producto"
                        aria-label={`Editar ${prod.nombre_articulo}`}
                      >
                        Editar
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}