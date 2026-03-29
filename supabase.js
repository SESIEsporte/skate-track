const SUPABASE_URL = 'https://knfockwyslspdxyuokvv.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_c_F2FA-vcunpHa6PQAgkgA_Frb6x00A';

if (!window.supabase || !window.supabase.createClient) {
  throw new Error('Supabase JS não foi carregado.');
}

window.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});
