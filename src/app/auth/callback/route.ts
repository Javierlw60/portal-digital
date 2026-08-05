import { NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { defaultPostAuthPath } from '@/lib/auth';
import { ensureNegocioForUser } from '@/lib/owned-negocio';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const { searchParams, origin } = url;
  const code = searchParams.get('code');
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = searchParams.get('next');

  const supabase = await createClient();
  let authed = false;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    authed = !error;
  } else if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });
    authed = !error;
  }

  if (authed) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, email, negocio_id')
        .eq('id', user.id)
        .maybeSingle();

      const negocio = await ensureNegocioForUser(supabase, user);

      const destination = defaultPostAuthPath({
        role: profile?.role,
        email: profile?.email ?? user.email,
        hasNegocio: Boolean(negocio || profile?.negocio_id),
        next,
      });

      return NextResponse.redirect(`${origin}${destination}`);
    }
  }

  // Sin sesión tras confirmar → login (el destino final se resuelve por rol al ingresar)
  return NextResponse.redirect(
    `${origin}/login?verified=1&mensaje=${encodeURIComponent(
      '¡Correo verificado con éxito! Por favor ingresa a tu cuenta.'
    )}`
  );
}
