/* =========================================================================
   CloseClub Team — Cliente Supabase vía REST API directa
   =========================================================================
   Sin dependencias externas. Usa fetch() para llamar la API REST.
   ========================================================================= */

const SUPABASE_URL = 'https://urtfcjpbpnxefzgbcnfu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVydGZjanBicG54ZWZ6Z2JjbmZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1NDM2NjIsImV4cCI6MjA5OTExOTY2Mn0.D4ALSHnDnQSLi6luQqalhlfhlKw_uTsOjsCnwf_Wr6w';

function supabaseFetch(path, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (options.prefer) headers.Prefer = options.prefer;

  const opts = {
    method: options.method || 'GET',
    headers,
  };
  if (options.body) opts.body = JSON.stringify(options.body);

  return fetch(url, opts).then(async (res) => {
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Supabase ${res.status}: ${text || res.statusText}`);
    }
    if (res.status === 204) return null;
    const ct = res.headers.get('content-type') || '';
    return ct.includes('json') ? res.json() : res.text();
  });
}

function qs(params) {
  return Object.entries(params)
    .filter(([, v]) => v != null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

const supabase = {
  from(table) {
    let _select = '*';
    let _filters = {};
    let _orderCol = null;
    let _orderDir = 'asc';
    let _limit = null;
    let _body = null;
    let _method = 'GET';
    let _prefer = null;

    function buildUrl() {
      let path = table;
      const params = {};
      if (_select) params.select = _select;
      if (_orderCol) params.order = `${_orderCol}.${_orderDir}`;
      if (_limit != null) params.limit = _limit;
      Object.entries(_filters).forEach(([k, v]) => { params[k] = v; });
      const q = qs(params);
      if (q) path += '?' + q;
      return path;
    }

    function thenable(fn) {
      return { then(resolve, reject) { fn().then(resolve, reject); } };
    }

    return {
      select(col) { _select = col || '*'; return this; },
      order(col, { ascending } = {}) { _orderCol = col; _orderDir = ascending ? 'asc' : 'desc'; return this; },
      limit(n) { _limit = n; return this; },

      then(resolve, reject) {
        _method = 'GET';
        supabaseFetch(buildUrl()).then(resolve, reject);
      },

      insert(values) {
        _method = 'POST';
        _body = Array.isArray(values) ? values : values;
        _prefer = 'return=representation';
        return {
          select: () => ({
            single: () => thenable(async () => {
              const data = await supabaseFetch(buildUrl(), { method: _method, body: _body, prefer: _prefer });
              return { data: Array.isArray(data) ? data[0] : data, error: null };
            }),
          }),
          then: (resolve, reject) => {
            supabaseFetch(buildUrl(), { method: _method, body: _body }).then(() => resolve({ data: null, error: null }), reject);
          },
        };
      },

      update(changes) {
        _method = 'PATCH';
        _body = changes;
        return {
          eq(col, val) {
            _filters[`${col}=eq`] = val;
            return {
              select: () => ({
                single: () => thenable(async () => {
                  _prefer = 'return=representation';
                  const data = await supabaseFetch(buildUrl(), { method: _method, body: _body, prefer: _prefer });
                  return { data: Array.isArray(data) ? data[0] : data, error: null };
                }),
              }),
              then: (resolve, reject) => {
                supabaseFetch(buildUrl(), { method: _method, body: _body }).then(() => resolve({ data: null, error: null }), reject);
              },
            };
          },
        };
      },

      delete() {
        _method = 'DELETE';
        return {
          eq(col, val) {
            _filters[`${col}=eq`] = val;
            return thenable(async () => {
              await supabaseFetch(buildUrl(), { method: _method });
              return { data: null, error: null };
            });
          },
        };
      },

      upsert(values) {
        _method = 'POST';
        _body = Array.isArray(values) ? values : values;
        _prefer = 'resolution=merge-duplicates';
        return thenable(async () => {
          await supabaseFetch(buildUrl(), { method: _method, body: _body, prefer: _prefer });
          return { data: null, error: null };
        });
      },
    };
  },

  auth: {
    getUser: async () => ({ data: { user: null }, error: null }),
    signOut: async () => {},
  },
};

window.supabaseClient = supabase;
console.info('CloseClub Team: ✅ conectado a Supabase (REST directo).');
