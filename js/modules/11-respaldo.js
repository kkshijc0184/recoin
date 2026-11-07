// ---- Exportar / Respaldo ----
function exportExcel(){
  if(typeof XLSX === 'undefined'){
    alert('No se pudo cargar el m\u00f3dulo de Excel. Verifica tu conexi\u00f3n a internet e intenta de nuevo.');
    return;
  }
  if(records.length === 0){
    alert('Todav\u00eda no hay registros para exportar.');
    return;
  }
  const rows = [...records]
    .sort((a,b)=> (a.fecha||'').localeCompare(b.fecha||''))
    .map(r => ({
      'Fecha': r.fecha,
      'Docente': r.docente,
      '\u00c1rea': r.area,
      'Grado': r.grado,
      'Secci\u00f3n': r.seccion,
      'N\u00b0 copias': r.copias,
      'Caras por copia': r.caras,
      'Total caras': r.totalCaras,
      'Precio usado (S/)': precioDeRegistro(r),
      'Costo (S/)': +(r.totalCaras * precioDeRegistro(r)).toFixed(2)
    }));
  const totalCaras = records.reduce((s,r)=>s+r.totalCaras,0);
  const totalCosto = records.reduce((s,r)=>s + r.totalCaras * precioDeRegistro(r), 0);
  rows.push({});
  rows.push({'Fecha':'TOTAL', 'Total caras': totalCaras, 'Costo (S/)': +totalCosto.toFixed(2)});

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [{wch:12},{wch:32},{wch:16},{wch:8},{wch:9},{wch:11},{wch:14},{wch:12},{wch:12},{wch:12}];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Registros');
  const fecha = todayStr();
  XLSX.writeFile(wb, `registro_copias_${fecha}.xlsx`);
}

function downloadBlob(filename, content, mime){
  const blob = new Blob([content], {type: mime});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportJson(){
  const backup = {
    exportedAt: new Date().toISOString(),
    price, schoolName, schoolAddress, records, docentes, areas, secciones, cobros
  };
  downloadBlob(`respaldo_copias_${todayStr()}.json`, JSON.stringify(backup, null, 2), 'application/json');
}

async function importJson(file){
  if(!file) return;
  if(!confirm('Esto reemplazar\u00e1 todos los datos actuales en Supabase por los del archivo. \u00bfContinuar?')) return;
  try{
    const text = await file.text();
    const data = JSON.parse(text);
    if(!Array.isArray(data.records)) throw new Error('Archivo inv\u00e1lido');

    showToast('Importando datos\u2026', 'ok');

    // Config local
    docentes = data.docentes || docentes;
    areas = data.areas || areas;
    secciones = data.secciones || secciones;
    price = typeof data.price === 'number' ? data.price : price;
    schoolName = data.schoolName || schoolName;
    schoolAddress = data.schoolAddress || schoolAddress;
    await Promise.all([savePrice(), saveSchoolName(), saveSchoolAddress()]);

    // Borrar registros y cobros existentes en Supabase
    await sbFetch('registros?id=neq.NONE', { method: 'DELETE', prefer: 'return=minimal' });
    await sbFetch('cobros?id=neq.NONE', { method: 'DELETE', prefer: 'return=minimal' });

    // Reinsertar registros
    for(const rec of (data.records || [])){
      await insertRecord(rec);
    }

    // Reinsertar cobros
    for(const [key, val] of Object.entries(data.cobros || {})){
      const [ym, secKey] = key.split(/:(.+)/);
      if(ym && secKey) await upsertCobro(ym, secKey, val.pagado, val.monto, val.fecha);
    }

    document.getElementById('priceInput').value = price;
    document.getElementById('schoolNameInput').value = schoolName;
    document.getElementById('schoolAddressInput').value = schoolAddress;
    await Promise.all([loadRecords(), loadCobros()]);
    renderAll();
    renderConfig();
    showToast('\u2713 Respaldo restaurado correctamente', 'ok');
  }catch(e){
    console.error(e);
    showToast('Error al importar. Verifica el archivo.', 'error');
  }
}

document.getElementById('exportExcelBtn').addEventListener('click', exportExcel);
document.getElementById('exportJsonBtn').addEventListener('click', exportJson);
document.getElementById('createUserBtn')?.addEventListener('click', crearUsuario);
document.getElementById('reloadUsersBtn')?.addEventListener('click', cargarUsuarios);
document.getElementById('newUserRol')?.addEventListener('change', renderUserRoleOptions);

document.getElementById('importJsonInput').addEventListener('change', async (e)=>{
  const input = e.target;
  const file = input.files[0];
  input.disabled = true;
  try{
    await importJson(file);
  } finally {
    input.value = '';
    input.disabled = false;
  }
});

