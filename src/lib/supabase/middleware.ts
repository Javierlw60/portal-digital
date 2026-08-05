import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { ADMIN_EMAIL } from '@/lib/auth';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Refresca sesión
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Usuario autenticado jamás debe ver el formulario "Sumá tu Negocio"
  if (user && request.nextUrl.pathname === '/registro') {
    const url = request.nextUrl.clone();
    // Admin → panel; resto → su negocio / resolución de pending
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, email')
      .eq('id', user.id)
      .maybeSingle();
    const isAdmin =
      profile?.role === 'admin' ||
      (user.email || '').toLowerCase() === ADMIN_EMAIL ||
      (profile?.email || '').toLowerCase() === ADMIN_EMAIL;
    url.pathname = isAdmin ? '/admin' : '/mi-negocio';
    url.search = '';
    const redirectRes = NextResponse.redirect(url);
    redirectRes.headers.set('x-vercel-skip-toolbar', '1');
    return redirectRes;
  }

  // Ocultar Vercel Toolbar para visitantes (producción / preview)
  supabaseResponse.headers.set('x-vercel-skip-toolbar', '1');

  return supabaseResponse;
}
