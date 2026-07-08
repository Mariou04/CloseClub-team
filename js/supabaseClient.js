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
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVydGZjanBicG54ZWZ6Z2JjbmZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1NDM2NjIsImV4cCI6MjA5OTExOTY2Mn0.D4ALSHnDnQSLi6luQqalhlfhlKw_uTsOjsCnwf_Wr6w';

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
