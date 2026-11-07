// ---- Inventario y préstamos (Supabase) ----
// Las reglas de permisos están en supabase_inventario.sql (RLS):
// admin modifica; directivo solo lee; docente no ve nada.

let bienes = [];
let prestamos = [];   // cada uno trae .prestamo_items = [{bien_id, cantidad}]
let historial = [];

// PostgREST devuelve máximo 1000 filas por consulta. Esta función pide
// por tandas para que el inventario no se corte cuando crezca.
async function sbFetchAll(path){
  const out = [];
  const sep = path.includes('?') ? '&' : '?';
  for(let offset = 0; ; offset += 1000){
    const lote = await sbFetch(`${path}${sep}limit=1000&offset=${offset}`);
    out.push(...lote);
    if(lote.length < 1000) break;
  }
  return out;
}

async function loadBienes(){
  try{
    bienes = await sbFetchAll('bienes?select=*&order=id.asc');
  }catch(e){
    console.error('Error cargando bienes:', e);
    showToast('No se pudo cargar el inventario.', 'error');
    bienes = [];
  }
}

async function loadPrestamos(){
  try{
    prestamos = await sbFetchAll('prestamos?select=*,prestamo_items(bien_id,cantidad)&order=created_at.desc');
  }catch(e){
    console.error('Error cargando préstamos:', e);
    showToast('No se pudieron cargar los préstamos.', 'error');
    prestamos = [];
  }
}

async function loadHistorial(){
  try{
    historial = await sbFetch('historial_bienes?select=*&order=created_at.desc&limit=1000');
  }catch(e){
    console.error('Error cargando historial:', e);
    showToast('No se pudo cargar el historial.', 'error');
    historial = [];
  }
}

async function insertBienesDB(filas){
  try{
    await sbFetch('bienes', { method:'POST', prefer:'return=minimal', body: filas });
    return true;
  }catch(e){
    console.error('Error guardando bienes:', e);
    showToast(mensajeErrorBien(e), 'error');
    return false;
  }
}

async function updateBienDB(id, cambios){
  try{
    await sbFetch('bienes?id=eq.' + encodeURIComponent(id), { method:'PATCH', prefer:'return=minimal', body: cambios });
    return true;
  }catch(e){
    console.error('Error actualizando bien:', e);
    showToast(mensajeErrorBien(e), 'error');
    return false;
  }
}

function mensajeErrorBien(e){
  const m = String(e && e.message || '');
  if(m.includes('bienes_serie_unica') || m.includes('duplicate key')) return 'Esa serie ya existe en otro bien.';
  if(m.includes('row-level security') || m.includes('42501')) return 'No tienes permiso para modificar el inventario.';
  return 'No se pudo guardar. Verifica tu conexión.';
}

function mensajeErrorRpc(e){
  const m = String(e && e.message || '');
  const f = m.match(/"message":"([^"]+)"/);
  if(f) return f[1];
  return 'No se pudo completar la operación. Verifica tu conexión.';
}

async function registrarPrestamoDB(docente, aula, hora, obs, items){
  try{
    await sbFetch('rpc/registrar_prestamo', {
      method:'POST', prefer:'return=minimal',
      body:{ p_docente:docente, p_aula:aula, p_hora:hora, p_obs:obs, p_items:items }
    });
    return true;
  }catch(e){
    console.error(e);
    showToast(mensajeErrorRpc(e), 'error');
    return false;
  }
}

async function devolverPrestamoDB(id){
  try{
    await sbFetch('rpc/devolver_prestamo', { method:'POST', prefer:'return=minimal', body:{ p_id:id } });
    return true;
  }catch(e){
    console.error(e);
    showToast(mensajeErrorRpc(e), 'error');
    return false;
  }
}

async function anularPrestamoDB(id){
  try{
    await sbFetch('rpc/anular_prestamo', { method:'POST', prefer:'return=minimal', body:{ p_id:id } });
    return true;
  }catch(e){
    console.error(e);
    showToast(mensajeErrorRpc(e), 'error');
    return false;
  }
}
