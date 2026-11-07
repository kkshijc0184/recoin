// ---- Docentes CRUD ----
async function insertDocente(nombre, area, grado, seccion, tipo='Contratado'){
  try{
    await sbFetch('docentes', {
      method: 'POST', prefer: 'return=minimal',
      body: { nombre:nombre.trim(), area:area.trim(), grado:grado.trim(),
              seccion:seccion.trim(), tipo, activo:true }
    });
    return true;
  }catch(e){
    console.error('Error insertando docente:', e);
    showToast('No se pudo agregar. Verifica tu conexi\u00f3n.', 'error');
    return false;
  }
}

async function updateDocente(id, nombre, area, grado, seccion, tipo){
  try{
    await sbFetch('docentes?id=eq.' + id, {
      method: 'PATCH', prefer: 'return=minimal',
      body: { nombre:nombre.trim(), area:area.trim(), grado:grado.trim(),
              seccion:seccion.trim(), tipo }
    });
    return true;
  }catch(e){
    console.error('Error actualizando docente:', e);
    showToast('No se pudo actualizar. Verifica tu conexi\u00f3n.', 'error');
    return false;
  }
}

async function toggleActivoDocenteDB(id, nuevoActivo){
  try{
    await sbFetch('docentes?id=eq.' + id, {
      method: 'PATCH', prefer: 'return=minimal',
      body: { activo: nuevoActivo }
    });
    return true;
  }catch(e){
    console.error('Error cambiando estado docente:', e);
    showToast('No se pudo cambiar el estado.', 'error');
    return false;
  }
}

async function deleteDocenteRow(id){
  try{
    await sbFetch('docentes?id=eq.' + id, { method: 'DELETE', prefer: 'return=minimal' });
    return true;
  }catch(e){
    showToast('No se pudo eliminar la asignaci\u00f3n.', 'error');
    return false;
  }
}

