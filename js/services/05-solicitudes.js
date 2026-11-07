// ---- Solicitudes de copias ----
async function atenderSolicitudDB(id, estado){
  try{
    await sbFetch('rpc/atender_solicitud', {
      method:'POST', prefer:'return=minimal',
      body:{p_id:id, p_estado:estado}
    });
    return true;
  }catch(e){
    console.error(e);
    showToast('No se pudo actualizar la solicitud.','error');
    return false;
  }
}
async function marcarSolicitudVistaDB(id){
  try{
    await sbFetch('rpc/marcar_solicitud_vista', {
      method:'POST', prefer:'return=minimal', body:{p_id:id}
    });
    return true;
  }catch(e){ console.error(e); return false; }
}

