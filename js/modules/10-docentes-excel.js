// ============================================================
// IMPORTACIÓN DE DOCENTES DESDE EXCEL
// ============================================================
function escapeHtmlExcel(v){
  return String(v ?? '').replace(/[&<>"']/g, m => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[m]));
}

function normalizarTextoExcel(v){
  return String(v ?? '').trim().replace(/\s+/g, ' ');
}

function valorActivoExcel(v){
  const s = normalizarTextoExcel(v).toLowerCase();
  if(!s) return true;
  if(['si','sí','s','true','1','activo','activa','yes'].includes(s)) return true;
  if(['no','n','false','0','inactivo','inactiva'].includes(s)) return false;
  return null;
}

function descargarPlantillaDocentes(){
  if(!window.XLSX){
    showToast('No se pudo cargar el módulo de Excel. Recarga la página e inténtalo nuevamente.', 'error');
    return;
  }

  const filas = [
    {
      nombre: 'Juan Pérez',
      area: 'Matemática',
      grado: '1ro',
      seccion: 'A',
      tipo: 'Contratado',
      activo: 'SI'
    },
    {
      nombre: 'María López',
      area: 'Comunicación',
      grado: '2do',
      seccion: 'B',
      tipo: 'Nombrado',
      activo: 'SI'
    }
  ];

  const ws = XLSX.utils.json_to_sheet(filas, {
    header: ['nombre','area','grado','seccion','tipo','activo']
  });
  ws['!cols'] = [
    {wch:28},{wch:22},{wch:14},{wch:14},{wch:18},{wch:10}
  ];

  const instrucciones = [
    ['PLANTILLA DE DOCENTES - REGISTRO DE COPIAS'],
    [''],
    ['Columnas obligatorias: nombre, area, grado, seccion'],
    ['Columnas opcionales: tipo, activo'],
    ['activo acepta SI/NO. Si se deja vacío, se considera SI.'],
    ['No cambies los nombres de las columnas.'],
    ['Un docente puede aparecer varias veces si tiene distintas asignaciones.']
  ];
  const wi = XLSX.utils.aoa_to_sheet(instrucciones);
  wi['!cols'] = [{wch:90}];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Docentes');
  XLSX.utils.book_append_sheet(wb, wi, 'Instrucciones');
  XLSX.writeFile(wb, 'plantilla_docentes_registro_copias.xlsx');
  showToast('✓ Plantilla descargada', 'ok');
}

async function leerExcelDocentes(file){
  if(!window.XLSX) throw new Error('El módulo de Excel no está disponible.');
  if(!file) throw new Error('Selecciona un archivo Excel.');

  const extension = file.name.toLowerCase().split('.').pop();
  if(!['xlsx','xls'].includes(extension)){
    throw new Error('El archivo debe ser .xlsx o .xls.');
  }

  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, {type:'array'});
  const sheetName = wb.SheetNames.find(n => n.toLowerCase() === 'docentes') || wb.SheetNames[0];
  if(!sheetName) throw new Error('El Excel no contiene ninguna hoja.');

  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, {defval:'', raw:false});

  if(!rows.length) throw new Error('La hoja Docentes está vacía.');

  const keys = Object.keys(rows[0]).map(k => normalizarTextoExcel(k).toLowerCase());
  const required = ['nombre','area','grado','seccion'];
  const missing = required.filter(k => !keys.includes(k));
  if(missing.length){
    throw new Error('Faltan columnas obligatorias: ' + missing.join(', '));
  }

  const keyMap = {};
  Object.keys(rows[0]).forEach(k => keyMap[normalizarTextoExcel(k).toLowerCase()] = k);

  const validos = [];
  const errores = [];

  rows.forEach((raw, i) => {
    const fila = i + 2;
    const nombre = normalizarTextoExcel(raw[keyMap.nombre]);
    const area = normalizarTextoExcel(raw[keyMap.area]);
    const grado = normalizarTextoExcel(raw[keyMap.grado]);
    const seccion = normalizarTextoExcel(raw[keyMap.seccion]);
    const tipo = normalizarTextoExcel(raw[keyMap.tipo]) || 'Contratado';
    const activoRaw = keyMap.activo !== undefined ? raw[keyMap.activo] : '';
    const activo = valorActivoExcel(activoRaw);

    const faltan = [];
    if(!nombre) faltan.push('nombre');
    if(!area) faltan.push('area');
    if(!grado) faltan.push('grado');
    if(!seccion) faltan.push('seccion');

    if(faltan.length){
      errores.push({fila, motivo:'Falta: '+faltan.join(', ')});
      return;
    }
    if(activo === null){
      errores.push({fila, motivo:'activo debe ser SI o NO'});
      return;
    }

    validos.push({nombre, area, grado, seccion, tipo, activo});
  });

  return {validos, errores, total:rows.length};
}

function renderPreviewExcelDocentes(resultado){
  const box = document.getElementById('docExcelPreview');
  if(!box) return;

  const {validos, errores, total} = resultado;
  let html = `
    <div class="card" style="margin:0;">
      <strong>Vista previa de importación</strong>
      <p class="hint" style="margin:6px 0;">
        ${total} filas leídas · ${validos.length} correctas · ${errores.length} con errores
      </p>
  `;

  if(errores.length){
    html += `<div style="max-height:180px;overflow:auto;margin-top:8px;">
      <table class="data-table">
        <thead><tr><th>Fila</th><th>Problema</th></tr></thead><tbody>`;
    errores.slice(0,100).forEach(e=>{
      html += `<tr><td>${e.fila}</td><td>${escapeHtmlExcel(e.motivo)}</td></tr>`;
    });
    html += `</tbody></table></div>`;
  }

  if(validos.length){
    html += `<div style="max-height:220px;overflow:auto;margin-top:10px;">
      <table class="data-table">
        <thead><tr><th>Nombre</th><th>Área</th><th>Grado</th><th>Sección</th><th>Tipo</th><th>Activo</th></tr></thead><tbody>`;
    validos.slice(0,100).forEach(r=>{
      html += `<tr>
        <td>${escapeHtmlExcel(r.nombre)}</td>
        <td>${escapeHtmlExcel(r.area)}</td>
        <td>${escapeHtmlExcel(r.grado)}</td>
        <td>${escapeHtmlExcel(r.seccion)}</td>
        <td>${escapeHtmlExcel(r.tipo)}</td>
        <td>${r.activo ? 'SI' : 'NO'}</td>
      </tr>`;
    });
    html += `</tbody></table></div>`;
  }

  if(validos.length && !errores.length){
    html += `<div style="margin-top:10px;">
      <button class="btn primary small" id="confirmDocExcelBtn" type="button">
        ✓ Confirmar importación de ${validos.length} asignaciones
      </button>
    </div>`;
  } else if(validos.length && errores.length){
    html += `<p class="hint" style="margin-top:10px;color:#a3273c;font-weight:600;">
      Corrige las filas con errores y vuelve a importar el archivo. No se realizará una importación parcial.
    </p>`;
  }

  html += `</div>`;
  box.innerHTML = html;

  const confirm = document.getElementById('confirmDocExcelBtn');
  if(confirm) confirm.addEventListener('click', async ()=>{
    await importarDocentesExcel(validos);
  });
}

async function importarDocentesExcel(filas){
  if(!filas?.length) return;
  if(!esAdmin() && !esDirectivo()){
    showToast('No tienes permisos para importar docentes.', 'error');
    return;
  }

  const confirm = await Swal.fire({
    icon:'question',
    title:'¿Importar docentes?',
    text:`Se agregarán ${filas.length} asignaciones. Las filas existentes no se eliminarán.`,
    showCancelButton:true,
    confirmButtonText:'Sí, importar',
    cancelButtonText:'Cancelar'
  });
  if(!confirm.isConfirmed) return;

  const btn = document.getElementById('confirmDocExcelBtn');
  if(btn){ btn.disabled=true; btn.textContent='Importando…'; }

  try{
    let insertadas = 0;
    const errores = [];

    for(let i=0; i<filas.length; i++){
      const r = filas[i];
      try{
        const ok = await insertDocente(r.nombre, r.area, r.grado, r.seccion, r.tipo, r.activo);
        if(ok) insertadas++;
        else errores.push(`${r.nombre} (${r.area} / ${r.grado}-${r.seccion})`);
      }catch(err){
        errores.push(`${r.nombre}: ${err?.message || 'error desconocido'}`);
      }
    }

    await loadDocentes();
    renderConfig();
    populateDocentesList();

    document.getElementById('docExcelPreview').innerHTML = `
      <div class="card" style="margin:0;">
        <strong>✓ Importación terminada</strong>
        <p class="hint">${insertadas} asignaciones importadas${errores.length ? ` · ${errores.length} no se pudieron guardar` : ''}.</p>
        ${errores.length ? `<details><summary>Ver errores</summary><ul>${errores.map(e=>`<li>${escapeHtmlExcel(e)}</li>`).join('')}</ul></details>` : ''}
      </div>`;

    showToast(`✓ ${insertadas} asignaciones importadas`, errores.length ? 'error' : 'ok');
  }catch(err){
    showToast(err?.message || 'No se pudo importar el Excel.', 'error');
  }finally{
    if(btn){ btn.disabled=false; btn.textContent='✓ Confirmar importación'; }
  }
}

async function prepararImportacionDocentesExcel(){
  const input = document.getElementById('docExcelInput');
  const file = input?.files?.[0];
  if(!file){
    showToast('Selecciona primero un archivo Excel.', 'error');
    return;
  }

  const btn = document.getElementById('importDocExcelBtn');
  if(btn){ btn.disabled=true; btn.textContent='Validando…'; }

  try{
    const resultado = await leerExcelDocentes(file);
    renderPreviewExcelDocentes(resultado);
  }catch(err){
    showToast(err?.message || 'No se pudo leer el Excel.', 'error');
    const box=document.getElementById('docExcelPreview');
    if(box) box.innerHTML='';
  }finally{
    if(btn){ btn.disabled=false; btn.textContent='📤 Importar Excel'; }
  }
}

document.getElementById('downloadDocTemplateBtn')?.addEventListener('click', descargarPlantillaDocentes);
document.getElementById('importDocExcelBtn')?.addEventListener('click', prepararImportacionDocentesExcel);

