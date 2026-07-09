/* =========================================================================
   CloseClub Team — Cliente Supabase simplificado
   =========================================================================
   Funciones directas sin encadenamiento complejo.
   ========================================================================= */

const SUPABASE_URL = 'https://urtfcjpbpnxefzgbcnfu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVydGZjanBicG54ZWZ6Z2JjbmZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1NDM2NjIsImV4cCI6MjA5OTExOTY2Mn0.D4ALSHnDnQSLi6luQqalhlfhlKw_uTsOjsCnwf_Wr6w';

function sb(table) {
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  };

  async function req(method, path, body, prefer) {
    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);
    if (prefer) opts.headers = { ...headers, Prefer: prefer };
    if (method === 'GET' || method === 'DELETE') delete opts.body;
    const url = `${SUPABASE_URL}/rest/v1/${path}`;
    const res = await fetch(url, opts);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Supabase ${res.status}: ${text.slice(0, 200)}`);
    }
    if (res.status === 204) return null;
    const ct = res.headers.get('content-type') || '';
    return ct.includes('json') ? res.json() : null;
  }

  return {
    select: async (columns = '*', { order, ascending = true, limit } = {}) => {
      let path = `${table}?select=${encodeURIComponent(columns)}`;
      if (order) path += `&order=${encodeURIComponent(order)}.${ascending ? 'asc' : 'desc'}`;
      if (limit != null) path += `&limit=${limit}`;
      const data = await req('GET', path);
      return { data: data || [], error: null };
    },

    insert: async (values, { returning = true } = {}) => {
      const prefer = returning ? 'return=representation' : undefined;
      const data = await req('POST', `${table}?select=*`, values, prefer);
      return { data: Array.isArray(data) ? data[0] : data, error: null };
    },

    update: async (id, changes) => {
      const data = await req('PATCH', `${table}?id=eq.${encodeURIComponent(id)}&select=*`, changes, 'return=representation');
      return { data: Array.isArray(data) ? data[0] : data, error: null };
    },

    delete: async (id) => {
      await req('DELETE', `${table}?id=eq.${encodeURIComponent(id)}`);
      return { data: null, error: null };
    },

    upsert: async (values) => {
      await req('POST', `${table}?select=*`, values, 'resolution=merge-duplicates');
      return { data: null, error: null };
    },
  };
}

const supabaseClient = {
  sb,
  auth: {
    getUser: async () => ({ data: { user: null }, error: null }),
    signOut: async () => {},
  },
};

window.supabaseClient = supabaseClient;
console.info('CloseClub Team: ✅ conectado a Supabase.');
