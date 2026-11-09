'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let supabase: SupabaseClient | null = null;

export function getSupabaseBrowserClient() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!rawUrl || !anonKey) {
    throw new Error('Configura NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY.');
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

  if (!supabase) {
    supabase = createClient(supabaseUrl, anonKey);
  }

  return supabase;
}
