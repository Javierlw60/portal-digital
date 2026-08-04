-- ==========================================================
-- ESQUEMA DE BASE DE DATOS: Portal Digital
-- Idempotente: seguro re-ejecutar en Supabase aunque las tablas ya existan.
-- ==========================================================

-- Auth SMTP (Supabase Dashboard → Authentication → Emails):
-- Remitente: noreply@portal-digital.com.ar
-- Habilitar "Confirm email" obligatorio.
-- Site URL: https://www.portal-digital.com.ar  (NO usar /registro)
-- Redirect URLs (Allow list):
--   http://localhost:3000/auth/callback
--   http://localhost:3000/auth/callback?next=/mi-negocio
--   https://www.portal-digital.com.ar/auth/callback
--   https://www.portal-digital.com.ar/auth/callback?next=/mi-negocio
--   (o comodín) http://localhost:3000/**  y  https://www.portal-digital.com.ar/**

-- Admin fijo: sermec@live.com.ar → profiles.role = 'admin'

-- 1. Localidades
CREATE TABLE IF NOT EXISTS localidades (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    provincia VARCHAR(100) DEFAULT 'Buenos Aires',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Negocios
CREATE TABLE IF NOT EXISTS negocios (
    id SERIAL PRIMARY KEY,
    nombre_comercio VARCHAR(150) NOT NULL,
    slug VARCHAR(150) UNIQUE NOT NULL,
    rubro VARCHAR(50) NOT NULL,
    tema_id INT DEFAULT 1,
    estado_suscripcion VARCHAR(20) DEFAULT 'inactivo',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Columnas que pueden faltar si la tabla ya existía
ALTER TABLE negocios ADD COLUMN IF NOT EXISTS localidad_id INT REFERENCES localidades(id) ON DELETE CASCADE;
ALTER TABLE negocios ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE negocios ADD COLUMN IF NOT EXISTS domicilio TEXT;
ALTER TABLE negocios ADD COLUMN IF NOT EXISTS localidad VARCHAR(100);
ALTER TABLE negocios ADD COLUMN IF NOT EXISTS partido VARCHAR(100);
ALTER TABLE negocios ADD COLUMN IF NOT EXISTS provincia VARCHAR(100);
ALTER TABLE negocios ADD COLUMN IF NOT EXISTS pais VARCHAR(100);
ALTER TABLE negocios ADD COLUMN IF NOT EXISTS mercadopago_subscription_id VARCHAR(100);
ALTER TABLE negocios ADD COLUMN IF NOT EXISTS tema_id INT DEFAULT 1;
ALTER TABLE negocios ADD COLUMN IF NOT EXISTS estado_suscripcion VARCHAR(20) DEFAULT 'inactivo';

-- 3. Catálogo global
CREATE TABLE IF NOT EXISTS catalogo_global_barras (
    id SERIAL PRIMARY KEY,
    codigo_barras VARCHAR(50) UNIQUE NOT NULL,
    nombre_estandar VARCHAR(200) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE catalogo_global_barras ADD COLUMN IF NOT EXISTS marca VARCHAR(100);
ALTER TABLE catalogo_global_barras ADD COLUMN IF NOT EXISTS presentacion VARCHAR(100);
ALTER TABLE catalogo_global_barras ADD COLUMN IF NOT EXISTS foto_oficial_url TEXT;

-- Storage: bucket público "productos-fotos"

-- 4. Productos
CREATE TABLE IF NOT EXISTS productos (
    id SERIAL PRIMARY KEY,
    negocio_id INT REFERENCES negocios(id) ON DELETE CASCADE,
    nombre_articulo VARCHAR(200) NOT NULL,
    precio DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE productos ADD COLUMN IF NOT EXISTS codigo_barras VARCHAR(50);
ALTER TABLE productos ADD COLUMN IF NOT EXISTS marca VARCHAR(100);
ALTER TABLE productos ADD COLUMN IF NOT EXISTS presentacion VARCHAR(100);
ALTER TABLE productos ADD COLUMN IF NOT EXISTS foto_url TEXT;

-- 5. Perfiles (Auth)
-- Crear mínimo si no existe; luego asegurar columnas (evita error 42703)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'usuario';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS negocio_id INT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- FK negocio_id (solo si aún no existe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_negocio_id_fkey'
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_negocio_id_fkey
      FOREIGN KEY (negocio_id) REFERENCES negocios(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Check de roles (si no existe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_role_check'
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_role_check
      CHECK (role IN ('usuario', 'comercio', 'admin'));
  END IF;
END $$;

UPDATE profiles SET role = 'usuario' WHERE role IS NULL;

CREATE INDEX IF NOT EXISTS profiles_negocio_id_idx ON profiles(negocio_id);
CREATE INDEX IF NOT EXISTS profiles_role_idx ON profiles(role);

-- 6. Favoritos
CREATE TABLE IF NOT EXISTS favoritos (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE favoritos ADD COLUMN IF NOT EXISTS negocio_id INT;
ALTER TABLE favoritos ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE favoritos ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'favoritos_negocio_id_fkey'
  ) THEN
    ALTER TABLE favoritos
      ADD CONSTRAINT favoritos_negocio_id_fkey
      FOREIGN KEY (negocio_id) REFERENCES negocios(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'favoritos_user_id_negocio_id_key'
  ) THEN
    ALTER TABLE favoritos
      ADD CONSTRAINT favoritos_user_id_negocio_id_key UNIQUE (user_id, negocio_id);
  END IF;
END $$;

-- ==========================================================
-- Helpers RLS (después de asegurar columns)
-- ==========================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (p.role = 'admin' OR lower(p.email) = 'sermec@live.com.ar')
  );
$$;

CREATE OR REPLACE FUNCTION public.owns_negocio(nid INT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        p.role = 'admin'
        OR lower(p.email) = 'sermec@live.com.ar'
        OR p.negocio_id = nid
      )
  )
  OR EXISTS (
    SELECT 1 FROM public.negocios n
    WHERE n.id = nid AND n.owner_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested_role TEXT := coalesce(NEW.raw_user_meta_data->>'role', 'usuario');
  final_role TEXT;
BEGIN
  IF lower(NEW.email) = 'sermec@live.com.ar' THEN
    final_role := 'admin';
  ELSIF requested_role IN ('usuario', 'comercio', 'admin') THEN
    IF requested_role = 'admin' THEN
      final_role := 'usuario';
    ELSE
      final_role := requested_role;
    END IF;
  ELSE
    final_role := 'usuario';
  END IF;

  INSERT INTO public.profiles (id, email, role)
  VALUES (NEW.id, NEW.email, final_role)
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==========================================================
-- RLS
-- ==========================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.negocios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favoritos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalogo_global_barras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_select_own_or_admin" ON public.profiles
  FOR SELECT USING (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "profiles_update_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_update_own_or_admin" ON public.profiles
  FOR UPDATE USING (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "negocios_select_public" ON public.negocios;
CREATE POLICY "negocios_select_public" ON public.negocios
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "negocios_insert_auth" ON public.negocios;
CREATE POLICY "negocios_insert_auth" ON public.negocios
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id OR public.is_admin());

DROP POLICY IF EXISTS "negocios_update_owner_admin" ON public.negocios;
CREATE POLICY "negocios_update_owner_admin" ON public.negocios
  FOR UPDATE USING (public.owns_negocio(id));

DROP POLICY IF EXISTS "productos_select_public" ON public.productos;
CREATE POLICY "productos_select_public" ON public.productos
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "productos_insert_owner" ON public.productos;
CREATE POLICY "productos_insert_owner" ON public.productos
  FOR INSERT TO authenticated
  WITH CHECK (public.owns_negocio(negocio_id));

DROP POLICY IF EXISTS "productos_update_owner" ON public.productos;
CREATE POLICY "productos_update_owner" ON public.productos
  FOR UPDATE USING (public.owns_negocio(negocio_id));

DROP POLICY IF EXISTS "productos_delete_owner" ON public.productos;
CREATE POLICY "productos_delete_owner" ON public.productos
  FOR DELETE USING (public.owns_negocio(negocio_id));

DROP POLICY IF EXISTS "catalogo_select_public" ON public.catalogo_global_barras;
CREATE POLICY "catalogo_select_public" ON public.catalogo_global_barras
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "catalogo_upsert_auth" ON public.catalogo_global_barras;
CREATE POLICY "catalogo_upsert_auth" ON public.catalogo_global_barras
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "favoritos_select_own" ON public.favoritos;
CREATE POLICY "favoritos_select_own" ON public.favoritos
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "favoritos_insert_own" ON public.favoritos;
CREATE POLICY "favoritos_insert_own" ON public.favoritos
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "favoritos_delete_own" ON public.favoritos;
CREATE POLICY "favoritos_delete_own" ON public.favoritos
  FOR DELETE USING (auth.uid() = user_id OR public.is_admin());
