// ---- Cobros CRUD ----
async function loadCobros(){
  try{
    const data = await sbFetch('cobros?select=*');
    cobros = {};
    data.forEach(c=>{
      cobros[c.mes + ':' + c.grado_seccion] = { pagado: c.pagado, monto: c.monto, fecha: c.fecha_pago || '' };
    });
  }catch(e){ cobros = {}; }
}

async function upsertCobro(ym, secKey, pagado, monto, fecha){
  try{
    await sbFetch('cobros', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body: { id: ym+':'+secKey, mes: ym, grado_seccion: secKey,
              pagado, monto: parseFloat(monto)||0, fecha_pago: fecha||null,
              updated_at: new Date().toISOString() }
    });
    return true;
  }catch(e){
    showToast('No se pudo guardar el cobro.', 'error');
    return false;
  }
}

async function deleteCobro(ym, secKey){
  try{
    await sbFetch('cobros?id=eq.' + encodeURIComponent(ym+':'+secKey), { method: 'DELETE', prefer: 'return=minimal' });
    return true;
  }catch(e){ return false; }
}

