import { createClient } from '@supabase/supabase-js';
import { isAdminUser } from './admin';

export function getSupabaseServerClient() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!rawUrl || !serviceRoleKey) {
    throw new Error('Configura NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el servidor.');
  }

  let supabaseUrl: string;
  try {
    const parsedUrl = new URL(rawUrl);
    const isLocalHttp = parsedUrl.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsedUrl.hostname);
    if (!isLocalHttp && parsedUrl.protocol !== 'https:') {
      throw new Error('unsupported protocol');
    }
    supabaseUrl = parsedUrl.origin;
  } catch {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL no es una URL HTTPS válida del proyecto Supabase.');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function requireAdmin(request: Request) {
  const authorization = request.headers.get('authorization');
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) {
    return { user: null, error: 'Se requiere una sesión de administrador.' };
  }

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !isAdminUser(data.user)) {
    return { user: null, error: 'La sesión no tiene permisos de administrador.' };
  }

  return { user: data.user, error: null };
}
