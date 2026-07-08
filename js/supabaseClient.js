/* =========================================================================
   CloseClub Team — Conexión Supabase
   =========================================================================
   INSTRUCCIONES:
   1. Crea un proyecto en https://supabase.com
   2. Ve a Project Settings → API
   3. Copia los valores en las dos constantes de abajo
   4. ¡Ya está!
   ========================================================================= */

const SUPABASE_URL = 'https://urtfcjpbpnxefzgbcnfu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_548tUIY8nOD5mFKwp3yEQQ__228Rd7t';

let supabase = null;

function initSupabase() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.info('CloseClub Team: ⏳ Supabase no configurado — usando localStorage.');
    return null;
  }

  if (typeof window.supabase === 'undefined') {
    console.warn('CloseClub Team: ⚠️ CDN de Supabase no cargado.');
    return null;
  }

  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  console.info('CloseClub Team: ✅ conectado a Supabase.');
  return client;
}

supabase = initSupabase();

window.supabaseClient = supabase;
