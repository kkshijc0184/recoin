// ---- Perfil (rol del usuario logueado) ----
// perfil = { rol: 'admin'|'directivo'|'docente', docente_nombre, nombre }
// Se carga despues de iniciar sesion. Si no existe fila en "perfiles"
// (por ejemplo un usuario nuevo al que aun no le asignaron rol), se
// asume el rol mas restringido ('docente' sin nombre asignado) para
// no dejar la app abierta por error.
let perfil = null;

async function loadPerfil(){
  try{
    const data = await sbFetch('perfiles?select=rol,docente_nombre,nombre&id=eq.' + session.user.id);
    perfil = data[0] || { rol: 'docente', docente_nombre: null, nombre: '' };
  }catch(e){
    console.error('Error cargando perfil:', e);
    perfil = { rol: 'docente', docente_nombre: null, nombre: '' };
  }
}

async function gestionarUsuarios(payload){
  if(!session || !session.access_token) throw new Error('Sesión no disponible.');
  const res = await fetch(SUPA_URL + '/functions/v1/gestion-usuarios', {
    method: 'POST',
    headers: {
      'apikey': SUPA_KEY,
      'Authorization': 'Bearer ' + session.access_token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload || {})
  });
  const data = await res.json().catch(()=>({}));
  if(!res.ok){
    throw new Error(data.error || data.message || 'No se pudo gestionar el usuario.');
  }
  return data;
}

async function sbFetch(path, opts={}){
  if(session) await ensureFreshSession();
  const token = session ? session.access_token : SUPA_KEY;
  const res = await fetch(SUPA_URL + '/rest/v1/' + path, {
    headers: {
      'apikey': SUPA_KEY,
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json',
      'Prefer': opts.prefer || 'return=representation',
      ...( opts.headers || {} )
    },
    method: opts.method || 'GET',
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  if(res.status === 401){
    clearSession();
    if(typeof onSessionExpired === 'function') onSessionExpired();
    throw new Error('Sesi\u00f3n expirada. Vuelve a iniciar sesi\u00f3n.');
  }
  if(!res.ok){
    const err = await res.text();
    throw new Error('Supabase error ' + res.status + ': ' + err);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : [];
}

