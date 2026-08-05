-- ==========================================================
-- Portal Digital — RLS idempotente (pegar en SQL Editor)
-- Corrige alerta: rls_disabled_in_public
-- Seguro re-ejecutar.
-- ==========================================================

-- Helpers (necesarios para políticas de dueño/admin)
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

-- 1) Activar RLS en TODAS las tablas del schema public
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.relname AS tablename
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r' -- tablas normales
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',
      r.tablename
    );
  END LOOP;
END $$;

-- ==========================================================
-- 2) Políticas por tabla
-- ==========================================================

-- ---------- localidades (catálogo público; escritura admin) ----------
DROP POLICY IF EXISTS "localidades_select_public" ON public.localidades;
CREATE POLICY "localidades_select_public" ON public.localidades
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "localidades_insert_admin" ON public.localidades;
CREATE POLICY "localidades_insert_admin" ON public.localidades
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "localidades_update_admin" ON public.localidades;
CREATE POLICY "localidades_update_admin" ON public.localidades
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "localidades_delete_admin" ON public.localidades;
CREATE POLICY "localidades_delete_admin" ON public.localidades
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ---------- profiles ----------
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_select_own_or_admin" ON public.profiles
  FOR SELECT
  USING (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "profiles_update_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_update_own_or_admin" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id OR public.is_admin())
  WITH CHECK (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "profiles_delete_admin" ON public.profiles;
CREATE POLICY "profiles_delete_admin" ON public.profiles
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ---------- negocios (lectura pública; escritura dueño/admin) ----------
DROP POLICY IF EXISTS "negocios_select_public" ON public.negocios;
CREATE POLICY "negocios_select_public" ON public.negocios
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "negocios_insert_auth" ON public.negocios;
CREATE POLICY "negocios_insert_auth" ON public.negocios
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id OR public.is_admin());

DROP POLICY IF EXISTS "negocios_update_owner_admin" ON public.negocios;
CREATE POLICY "negocios_update_owner_admin" ON public.negocios
  FOR UPDATE
  USING (public.owns_negocio(id))
  WITH CHECK (public.owns_negocio(id));

DROP POLICY IF EXISTS "negocios_delete_owner_admin" ON public.negocios;
CREATE POLICY "negocios_delete_owner_admin" ON public.negocios
  FOR DELETE TO authenticated
  USING (public.owns_negocio(id));

-- ---------- productos (lectura pública; escritura dueño del negocio) ----------
DROP POLICY IF EXISTS "productos_select_public" ON public.productos;
CREATE POLICY "productos_select_public" ON public.productos
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "productos_insert_owner" ON public.productos;
CREATE POLICY "productos_insert_owner" ON public.productos
  FOR INSERT TO authenticated
  WITH CHECK (public.owns_negocio(negocio_id));

DROP POLICY IF EXISTS "productos_update_owner" ON public.productos;
CREATE POLICY "productos_update_owner" ON public.productos
  FOR UPDATE
  USING (public.owns_negocio(negocio_id))
  WITH CHECK (public.owns_negocio(negocio_id));

DROP POLICY IF EXISTS "productos_delete_owner" ON public.productos;
CREATE POLICY "productos_delete_owner" ON public.productos
  FOR DELETE
  USING (public.owns_negocio(negocio_id));

-- ---------- catalogo_global_barras ----------
DROP POLICY IF EXISTS "catalogo_select_public" ON public.catalogo_global_barras;
CREATE POLICY "catalogo_select_public" ON public.catalogo_global_barras
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "catalogo_upsert_auth" ON public.catalogo_global_barras;
DROP POLICY IF EXISTS "catalogo_insert_auth" ON public.catalogo_global_barras;
DROP POLICY IF EXISTS "catalogo_update_auth" ON public.catalogo_global_barras;
DROP POLICY IF EXISTS "catalogo_delete_admin" ON public.catalogo_global_barras;

CREATE POLICY "catalogo_insert_auth" ON public.catalogo_global_barras
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "catalogo_update_auth" ON public.catalogo_global_barras
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "catalogo_delete_admin" ON public.catalogo_global_barras
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ---------- favoritos (privados del usuario) ----------
DROP POLICY IF EXISTS "favoritos_select_own" ON public.favoritos;
CREATE POLICY "favoritos_select_own" ON public.favoritos
  FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "favoritos_insert_own" ON public.favoritos;
CREATE POLICY "favoritos_insert_own" ON public.favoritos
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "favoritos_update_own" ON public.favoritos;
CREATE POLICY "favoritos_update_own" ON public.favoritos
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "favoritos_delete_own" ON public.favoritos;
CREATE POLICY "favoritos_delete_own" ON public.favoritos
  FOR DELETE
  USING (auth.uid() = user_id OR public.is_admin());

-- ==========================================================
-- 3) Verificación rápida (opcional): tablas public sin RLS
-- ==========================================================
-- SELECT c.relname AS tabla_sin_rls
-- FROM pg_class c
-- JOIN pg_namespace n ON n.oid = c.relnamespace
-- WHERE n.nspname = 'public'
--   AND c.relkind = 'r'
--   AND NOT c.relrowsecurity;
