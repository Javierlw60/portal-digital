import type { NextConfig } from 'next';

/**
 * Vercel Toolbar no está integrada (@vercel/toolbar no está en deps).
 * Desactivar también en el dashboard:
 * Project → Settings → General → Vercel Toolbar → Production = Off
 * Headers `x-vercel-skip-toolbar` se envían desde vercel.json y middleware.
 */
const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
