import { NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { ensureNegocioForUser } from '@/lib/owned-negocio';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const { searchParams, origin } = url;
  const code = searchParams.get('code');
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;

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
      // Crear/enlazar negocio desde metadata o owner_id; luego siempre al panel
      await ensureNegocioForUser(supabase, user);
      return NextResponse.redirect(`${origin}/mi-negocio`);
    }
  }

  // Sin sesión tras confirmar → login con mensaje claro
  return NextResponse.redirect(
    `${origin}/login?verified=1&next=${encodeURIComponent('/mi-negocio')}&mensaje=${encodeURIComponent(
      '¡Correo verificado con éxito! Por favor ingresa a tu cuenta.'
    )}`
  );
}
