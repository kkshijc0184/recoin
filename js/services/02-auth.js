// ---- Autenticacion (Supabase Auth) ----
// session = { access_token, refresh_token, expires_at, user }
let session = null;

async function authRequest(grantType, body){
  const res = await fetch(SUPA_URL + '/auth/v1/token?grant_type=' + grantType, {
    method: 'POST',
    headers: { 'apikey': SUPA_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(()=>({}));
  if(!res.ok){
    throw new Error(data.error_description || data.msg || 'No se pudo autenticar');
  }
  return data;
}

function saveSession(data){
  session = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + (data.expires_in ? data.expires_in*1000 : 3600*1000),
    user: data.user || null
  };
  lcSet('copias:refresh_token', session.refresh_token);
}

function clearSession(){
  session = null;
  lcDel('copias:refresh_token');
}

async function signIn(email, password){
  const data = await authRequest('password', { email, password });
  saveSession(data);
  return session;
}

function necesitaCambiarPassword(){
  return session?.user?.user_metadata?.must_change_password === true;
}

// Fuente de verdad para el flujo de contraseña temporal: public.perfiles.
// Se sincroniza también con user_metadata para mantener compatible el resto
// de la aplicación, que consulta necesitaCambiarPassword() de forma síncrona.
async function cargarEstadoCambioPassword(){
  if(!session?.access_token || !session?.user?.id) return false;

  // No consultamos perfiles directamente porque RLS puede devolver [] aunque
  // la fila exista. Eso haría que el sistema interpretara el estado como false
  // y permitiera entrar sin cambiar la contraseña. La función RPC es SECURITY
  // DEFINER y consulta únicamente el estado del usuario autenticado.
  const res = await fetch(SUPA_URL + '/rest/v1/rpc/obtener_estado_cambio_password', {
    method: 'POST',
    headers: {
      'apikey': SUPA_KEY,
      'Authorization': 'Bearer ' + session.access_token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({})
  });
  const data = await res.json().catch(()=>null);
  if(!res.ok) throw new Error('No se pudo consultar el estado de la contraseña.');

  // PostgREST devuelve un booleano para una función scalar. Admitimos también
  // las formas de objeto/array por compatibilidad con distintas versiones.
  let debe;
  if(typeof data === 'boolean') debe = data;
  else if(data?.debe_cambiar_password !== undefined) debe = data.debe_cambiar_password === true;
  else if(Array.isArray(data) && data[0]?.debe_cambiar_password !== undefined) debe = data[0].debe_cambiar_password === true;
  else throw new Error('No se recibió un estado válido de la contraseña.');

  session.user.user_metadata = { ...(session.user.user_metadata || {}), must_change_password: debe };
  return debe;
}

async function obtenerUsuarioActual(){
  if(!session?.access_token) throw new Error('Sesión no disponible.');
  const res=await fetch(SUPA_URL+'/auth/v1/user',{
    method:'GET',
    headers:{
      'apikey':SUPA_KEY,
      'Authorization':'Bearer '+session.access_token
    }
  });
  const data=await res.json().catch(()=>({}));
  if(!res.ok || !data?.id){
    throw new Error(data.msg||data.error_description||'No se pudo obtener el usuario actual.');
  }
  session.user=data;
  return data;
}

async function cambiarPassword(nuevaPassword){
  if(!session || !session.access_token) throw new Error('Sesión no disponible.');
  if(!nuevaPassword || nuevaPassword.length < 8) throw new Error('La nueva contraseña debe tener al menos 8 caracteres.');

  const metadata={...(session.user?.user_metadata||{}),must_change_password:false};
  const res=await fetch(SUPA_URL+'/auth/v1/user',{
    method:'PUT',
    headers:{
      'apikey':SUPA_KEY,
      'Authorization':'Bearer '+session.access_token,
      'Content-Type':'application/json'
    },
    body:JSON.stringify({password:nuevaPassword,data:metadata})
  });
  const data=await res.json().catch(()=>({}));
  if(!res.ok){
    throw new Error(data.msg||data.error_description||data.message||'No se pudo cambiar la contraseña.');
  }

  if(data.user) session.user=data.user;
  else await obtenerUsuarioActual();

  // La bandera definitiva vive en public.perfiles. Se actualiza mediante
  // una función RPC SECURITY DEFINER para que el usuario solo pueda cambiar
  // su propio estado, sin obtener permiso para modificar su rol.
  const rpc = await fetch(SUPA_URL + '/rest/v1/rpc/marcar_password_cambiada', {
    method: 'POST',
    headers: {
      'apikey': SUPA_KEY,
      'Authorization': 'Bearer ' + session.access_token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({})
  });
  if(!rpc.ok){
    const err = await rpc.text().catch(()=> '');
    throw new Error('La contraseña se cambió, pero no se pudo actualizar el estado de la cuenta. ' + err);
  }

  await cargarEstadoCambioPassword();
  if(necesitaCambiarPassword()){
    throw new Error('La contraseña se cambió, pero la cuenta sigue marcada para cambio.');
  }

  return data;
}

async function signOut(){
  if(session && session.access_token){
    try{
      await fetch(SUPA_URL + '/auth/v1/logout', {
        method: 'POST',
        headers: { 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + session.access_token }
      });
    }catch(e){ /* ignorar errores al cerrar sesion */ }
  }
  clearSession();
}

// Intenta recuperar la sesion guardada al recargar la pagina.
// Devuelve true si quedo una sesion valida, false si hay que mostrar el login.
async function restoreSession(){
  const rt = lcGet('copias:refresh_token');
  if(!rt) return false;
  try{
    const data = await authRequest('refresh_token', { refresh_token: rt });
    saveSession(data);
    return true;
  }catch(e){
    clearSession();
    return false;
  }
}

// Asegura que el access_token siga vigente antes de cada peticion,
// refrescandolo si esta por vencer.
async function ensureFreshSession(){
  if(!session) return false;
  if(session.expires_at - Date.now() > 30000) return true;
  try{
    const data = await authRequest('refresh_token', { refresh_token: session.refresh_token });
    saveSession(data);
    return true;
  }catch(e){
    clearSession();
    return false;
  }
}

