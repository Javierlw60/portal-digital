-- ==========================================================
-- ESQUEMA DE BASE DE DATOS: Portal Digital
-- ==========================================================

-- 1. Tabla de Localidades (Se autogenera por ciudad)
CREATE TABLE IF NOT EXISTS localidades (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    provincia VARCHAR(100) DEFAULT 'Buenos Aires',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabla de Negocios / Clientes (Multi-tenant)
CREATE TABLE IF NOT EXISTS negocios (
    id SERIAL PRIMARY KEY,
    localidad_id INT REFERENCES localidades(id) ON DELETE CASCADE,
    nombre_comercio VARCHAR(150) NOT NULL,
    slug VARCHAR(150) UNIQUE NOT NULL,
    rubro VARCHAR(50) NOT NULL,
    tema_id INT DEFAULT 1 CHECK (tema_id BETWEEN 1 AND 4),
    estado_suscripcion VARCHAR(20) DEFAULT 'inactivo', -- activo, inactivo, vencido
    mercadopago_subscription_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Catálogo Global de Códigos de Barras (Inteligente y compartido)
CREATE TABLE IF NOT EXISTS catalogo_global_barras (
    id SERIAL PRIMARY KEY,
    codigo_barras VARCHAR(50) UNIQUE NOT NULL,
    nombre_estandar VARCHAR(200) NOT NULL,
    marca VARCHAR(100),
    presentacion VARCHAR(100),
    foto_oficial_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Migración opcional catálogo global:
-- ALTER TABLE catalogo_global_barras ADD COLUMN IF NOT EXISTS marca VARCHAR(100);
-- ALTER TABLE catalogo_global_barras ADD COLUMN IF NOT EXISTS presentacion VARCHAR(100);

-- Storage: crear bucket público "productos-fotos" en Supabase Storage
-- (políticas: lectura pública + insert/update para anon/authenticated según tu RLS).

-- 4. Productos de cada Negocio
CREATE TABLE IF NOT EXISTS productos (
    id SERIAL PRIMARY KEY,
    negocio_id INT REFERENCES negocios(id) ON DELETE CASCADE,
    codigo_barras VARCHAR(50),
    nombre_articulo VARCHAR(200) NOT NULL,
    marca VARCHAR(100),
    presentacion VARCHAR(100),
    precio DECIMAL(10, 2) NOT NULL,
    foto_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Migración opcional si la tabla ya existía sin marca/presentacion:
-- ALTER TABLE productos ADD COLUMN IF NOT EXISTS marca VARCHAR(100);
-- ALTER TABLE productos ADD COLUMN IF NOT EXISTS presentacion VARCHAR(100);