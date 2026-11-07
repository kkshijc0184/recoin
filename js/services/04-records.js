// ---- Records CRUD ----
function normalizarEstadoSolicitud(valor){
  const v=String(valor ?? '').trim().toLowerCase();
  const aliases={
    pendiente:'pendiente',
    pending:'pendiente',
    en_proceso:'en_proceso',
    'en proceso':'en_proceso',
    proceso:'en_proceso',
    lista:'lista',
    listo:'lista',
    entregada:'entregada',
    entregado:'entregada',
    atendida:'atendida',
    cancelada:'cancelada',
    cancelado:'cancelada'
  };
  return aliases[v] || (v ? v : 'atendida');
}

async function loadRecords(){
  try{
    const data = await sbFetch('registros?select=*&order=fecha.desc');
    records = data.map(r=>({
      id: r.id, fecha: r.fecha, docente: r.docente, area: r.area,
      grado: r.grado, seccion: r.seccion, copias: r.copias,
      caras: r.caras, totalCaras: r.total_caras,
      // precio por cara vigente cuando se creo el registro. Puede venir null
      // en registros creados antes de agregar esta columna; en ese caso
      // precioDeRegistro() en app.js usa el precio global como respaldo.
      precio: (typeof r.precio === 'number') ? r.precio : null,
      estadoSolicitud: normalizarEstadoSolicitud(r.estado_solicitud),
      solicitudNueva: r.solicitud_nueva === true || r.solicitud_nueva === 'true' || r.solicitud_nueva === 1 || r.solicitud_nueva === '1',
      solicitudCreadaAt: r.solicitud_creada_at || r.created_at || null
    }));
  }catch(e){
    console.error('Error cargando registros:', e);
    showToast('Error al conectar con Supabase.', 'error');
    records = [];
  }
}

async function insertRecord(rec){
  try{
    const esSolicitud = rec.solicitudNueva === true || rec.estadoSolicitud === 'pendiente';
    const solicitudAt = rec.solicitudCreadaAt || new Date().toISOString();
    await sbFetch('registros', {
      method: 'POST', prefer: 'return=minimal',
      body: { id: rec.id, fecha: rec.fecha, docente: rec.docente, area: rec.area,
              grado: rec.grado, seccion: rec.seccion, copias: rec.copias,
              caras: rec.caras, total_caras: rec.totalCaras,
              precio: (typeof rec.precio === 'number') ? rec.precio : price,
              estado_solicitud: esSolicitud ? 'pendiente' : (rec.estadoSolicitud || 'atendida'),
              solicitud_nueva: esSolicitud,
              solicitud_creada_at: solicitudAt }
    });

    // Confirmamos lo que realmente quedo guardado. Esto evita que un trigger,
    // valor por defecto o una version antigua de la tabla convierta una
    // solicitud docente en un registro normal.
    if(esSolicitud){
      const check = await sbFetch('registros?id=eq.' + encodeURIComponent(rec.id) + '&select=id,estado_solicitud,solicitud_nueva,solicitud_creada_at');
      const row = check?.[0];
      const estadoOk = normalizarEstadoSolicitud(row?.estado_solicitud) === 'pendiente';
      const nuevaOk = row?.solicitud_nueva === true || row?.solicitud_nueva === 'true' || row?.solicitud_nueva === 1 || row?.solicitud_nueva === '1';
      if(!estadoOk || !nuevaOk){
        await sbFetch('registros?id=eq.' + encodeURIComponent(rec.id), {
          method:'PATCH', prefer:'return=minimal',
          body:{estado_solicitud:'pendiente', solicitud_nueva:true, solicitud_creada_at:solicitudAt}
        });
      }
    }
    return true;
  }catch(e){
    console.error('Error guardando registro:', e);
    showToast('No se pudo guardar. Verifica tu conexi\u00f3n.', 'error');
    return false;
  }
}

async function updateRecord(id, rec){
  try{
    await sbFetch('registros?id=eq.' + id, {
      method: 'PATCH', prefer: 'return=minimal',
      body: { fecha: rec.fecha, docente: rec.docente, area: rec.area,
              grado: rec.grado, seccion: rec.seccion, copias: rec.copias,
              caras: rec.caras, total_caras: rec.totalCaras,
              precio: (typeof rec.precio === 'number') ? rec.precio : price }
    });
    return true;
  }catch(e){
    console.error('Error actualizando registro:', e);
    showToast('No se pudo actualizar. Verifica tu conexi\u00f3n.', 'error');
    return false;
  }
}

async function deleteRecordDB(id){
  try{
    await sbFetch('registros?id=eq.' + id, { method: 'DELETE', prefer: 'return=minimal' });
    return true;
  }catch(e){
    showToast('No se pudo eliminar.', 'error');
    return false;
  }
}


