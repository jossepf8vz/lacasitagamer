'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let supabase: SupabaseClient | null = null;

export function getSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error('Configura NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL no es una URL válida. Usa la URL del proyecto Supabase.');
  }

  const isLocalHttp = parsedUrl.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsedUrl.hostname);
  if ((!isLocalHttp && parsedUrl.protocol !== 'https:') || parsedUrl.pathname !== '/' || parsedUrl.search || parsedUrl.hash) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL debe ser la URL HTTPS base del proyecto, sin rutas ni parámetros.');
  }

  if (!supabase) {
    supabase = createClient(parsedUrl.origin, anonKey);
  }

  return supabase;
}
