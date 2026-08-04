import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { normalizeSlug } from '@/lib/slug';

function safeNextPath(next: string | null): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return '/cuenta';
  // Evitar volver al formulario "Unite a la red" tras confirmar email
  if (next === '/registro' || next.startsWith('/registro?')) return '/cuenta';
  return next;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const { searchParams, origin } = url;
  const code = searchParams.get('code');
  const next = safeNextPath(searchParams.get('next'));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, negocio_id')
          .eq('id', user.id)
          .maybeSingle();

        // Si ya tiene comercio asociado, ir a su ficha
        if (profile?.negocio_id) {
          const { data: negocio } = await supabase
            .from('negocios')
            .select('slug, localidad')
            .eq('id', profile.negocio_id)
            .maybeSingle();

          if (negocio?.slug) {
            const loc = normalizeSlug(negocio.localidad || 'local');
            const slug = normalizeSlug(negocio.slug);
            return NextResponse.redirect(`${origin}/${loc}/${slug}`);
          }
        }

        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  }

  // Sin sesión tras confirmar → login con mensaje claro
  return NextResponse.redirect(
    `${origin}/login?verified=1&mensaje=${encodeURIComponent(
      '¡Correo verificado con éxito! Por favor ingresa a tu cuenta.'
    )}`
  );
}
