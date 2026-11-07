// ---- Registrar form ----

function findDocenteEnDirectorio(nombre){
  const lower = nombre.trim().toLowerCase();
  const key = Object.keys(DIRECTORIO).find(k => k.toLowerCase() === lower);
  return key ? DIRECTORIO[key] : null;
}

function populateDocentesList(){
  const dl = document.getElementById('docentesList');
  dl.innerHTML = docentes.map(nombre=>`<option value="${escapeHtml(nombre)}">`).join('');
}

function populateAreas(filtroDocente){
  const inputArea = document.getElementById('area');
  const dl = document.getElementById('areasList');
  if(!filtroDocente || filtroDocente.trim() === '' || !findDocenteEnDirectorio(filtroDocente)){
    dl.innerHTML = '';
    inputArea.value = '';
    inputArea.disabled = true;
    inputArea.placeholder = 'Primero elige un docente';
    return;
  }
  const info = findDocenteEnDirectorio(filtroDocente);
  const lista = Object.keys(info);
  dl.innerHTML = lista.map(a=>`<option value="${escapeHtml(a)}">`).join('');
  inputArea.disabled = false;
  inputArea.placeholder = 'Escribe o elige...';
  // Si solo tiene un area, autocompletar
  if(lista.length === 1){
    inputArea.value = lista[0];
    populateGradoSeccion(filtroDocente, lista[0]);
  }
}

function gradoSeccionText(s){
  return typeof s === 'string' ? s : `${s.grado} ${s.seccion}`;
}

function populateGradoSeccion(filtroDocente, filtroArea){
  const inputGs = document.getElementById('gradoSeccion');
  const dl = document.getElementById('gradoSeccionList');
  if(!filtroDocente || filtroDocente.trim() === '' || !filtroArea || filtroArea.trim() === ''){
    dl.innerHTML = '';
    inputGs.value = '';
    inputGs.disabled = true;
    inputGs.placeholder = 'Primero elige un docente y \u00e1rea';
    return;
  }
  const info = findDocenteEnDirectorio(filtroDocente);
  if(!info){
    dl.innerHTML = '';
    inputGs.disabled = true;
    return;
  }
  // Buscar el area en el directorio (case-insensitive)
  const areaKey = Object.keys(info).find(k => k.toLowerCase() === filtroArea.trim().toLowerCase());
  const lista = areaKey ? info[areaKey] : [];
  dl.innerHTML = lista.map(s=>`<option value="${escapeHtml(s)}">`).join('');
  inputGs.disabled = false;
  inputGs.placeholder = lista.length ? 'Escribe o elige...' : 'Sin secciones para esta \u00e1rea';
  // Si solo tiene una seccion, autocompletar
  if(lista.length === 1) inputGs.value = lista[0];
  else inputGs.value = '';
}

function parseGradoSeccion(text){
  const clean = text.trim();
  const parts = clean.split(/\s+/);
  if(parts.length >= 2) return { grado: parts.slice(0,-1).join(' '), seccion: parts[parts.length-1] };
  return { grado: clean, seccion: '' };
}

// Listener docente: filtra areas, limpia seccion
document.getElementById('docente').addEventListener('input', (e)=>{
  const val = e.target.value;
  populateAreas(val);
  // Limpiar area y seccion al cambiar docente
  const info = findDocenteEnDirectorio(val);
  if(!info){
    document.getElementById('area').value = '';
    populateGradoSeccion('', '');
  }
  document.getElementById('gradoSeccion').value = '';
});

// Listener area: filtra secciones segun docente + area
document.getElementById('area').addEventListener('input', (e)=>{
  const docente = document.getElementById('docente').value;
  populateGradoSeccion(docente, e.target.value);
});

// Cuando se esta editando un registro existente, el preview de costo debe
// mostrar el precio congelado de ESE registro, no el precio global actual
// (que puede haber cambiado desde que se creo).
let previewPrice = null;
function updateCalc(){
  const copias = parseFloat(document.getElementById('copias').value) || 0;
  const caras = parseFloat(document.getElementById('caras').value) || 0;
  const totalCaras = copias * caras;
  const precioUsado = previewPrice !== null ? previewPrice : price;
  document.getElementById('calcCaras').textContent = totalCaras;
  document.getElementById('calcCosto').textContent = 'S/ ' + (totalCaras * precioUsado).toFixed(2);
}
document.getElementById('copias').addEventListener('input', updateCalc);
document.getElementById('caras').addEventListener('input', updateCalc);
document.getElementById('priceInput').addEventListener('input', (e)=>{
  // Solo el administrador puede modificar el precio.
  if(!esAdmin()){
    e.target.value = price;
    updateCalc();
    return;
  }
  price = parseFloat(e.target.value) || 0;
  savePrice();
  updateCalc();
  renderAll();
});

function updateSubmitBtnLabel(){
  document.getElementById('entrySubmitBtn').textContent = editingId ? 'Actualizar registro' : 'Guardar registro';
}

// Carga los datos de un registro existente en el formulario de "Registrar"
// para poder corregirlo, en vez de tener que eliminarlo y volver a crearlo.
function startEdit(id){
  if(soloLectura()){ showToast('Tu rol solo permite ver los registros.', 'error'); return; }
  const rec = records.find(r=>r.id === id);
  if(!rec) return;
  editingId = id;

  // El docente nunca debe poder cambiar la fecha, ni siquiera al editar un
  // registro existente: se fuerza la fecha de hoy y se mantiene deshabilitado.
  const fechaInputEdit = document.getElementById('fecha');
  if(esDocente()){
    fechaInputEdit.value = todayStr();
    fechaInputEdit.disabled = true;
  } else {
    fechaInputEdit.value = rec.fecha || '';
  }
  document.getElementById('docente').value = rec.docente || '';
  populateAreas(rec.docente);
  document.getElementById('area').value = rec.area || '';
  populateGradoSeccion(rec.docente, rec.area);
  document.getElementById('gradoSeccion').value = `${rec.grado||''} ${rec.seccion||''}`.trim();
  document.getElementById('copias').value = rec.copias;
  document.getElementById('caras').value = rec.caras;
  previewPrice = precioDeRegistro(rec);
  updateCalc();

  document.getElementById('entryFormTitle').textContent = 'Editar registro';
  document.getElementById('editBanner').hidden = false;
  updateSubmitBtnLabel();

  document.querySelector('[data-tab="registrar"]').click();
  document.getElementById('docente').focus();
  showToast('\u270e Editando registro', 'info');
}

function cancelEdit(notify){
  const wasEditing = !!editingId;
  editingId = null;
  previewPrice = null;
  document.getElementById('fecha').value = todayStr();
  document.getElementById('copias').value = 1;
  document.getElementById('caras').value = 1;
  resetDocenteFieldForRole();
  populateGradoSeccion('','');
  updateCalc();

  document.getElementById('entryFormTitle').textContent = 'Nuevo registro';
  document.getElementById('editBanner').hidden = true;
  updateSubmitBtnLabel();

  if(notify && wasEditing) showToast('Edici\u00f3n cancelada', 'info');
}
document.getElementById('cancelEditBtn').addEventListener('click', ()=>cancelEdit(true));

document.getElementById('entryForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  if(soloLectura()){ showToast('Tu rol solo permite ver los registros, no crearlos.', 'error'); return; }
  const submitBtn = document.getElementById('entrySubmitBtn');
  if(submitBtn.disabled) return; // ya se esta guardando, ignorar clics extra
  submitBtn.disabled = true;
  submitBtn.textContent = editingId ? 'Actualizando\u2026' : 'Guardando\u2026';
  try{
    const copias = parseFloat(document.getElementById('copias').value) || 0;
    const caras = parseFloat(document.getElementById('caras').value) || 0;
    const gs = parseGradoSeccion(document.getElementById('gradoSeccion').value);
    // Precio congelado: si es un registro nuevo, se usa el precio configurado
    // ahora mismo. Si se esta editando uno existente, se conserva su precio
    // original (no el global actual) para no alterar el historial ya cerrado.
    let precioRegistro = price;
    if(editingId){
      const origRec = records.find(r=>r.id === editingId);
      precioRegistro = origRec ? precioDeRegistro(origRec) : price;
    }
    const datos = {
      fecha: esDocente() ? todayStr() : document.getElementById('fecha').value,
      docente: document.getElementById('docente').value.trim(),
      area: document.getElementById('area').value.trim(),
      grado: gs.grado,
      seccion: gs.seccion,
      copias, caras,
      totalCaras: copias * caras,
      precio: precioRegistro
    };

    if(editingId){
      showToast('Actualizando\u2026', 'ok');
      const ok = await updateRecord(editingId, datos);
      if(!ok) return;
      const idx = records.findIndex(r=>r.id === editingId);
      if(idx !== -1) records[idx] = { id: editingId, ...datos };
      showToast('\u2713 Registro actualizado', 'ok');
      cancelEdit();
      renderAll();
      if(!esDocente()){
        document.querySelector('[data-tab="registros"]').click();
      }
    } else {
      const rec = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2,6),
        ...datos,
        estadoSolicitud: esDocente() ? 'pendiente' : 'atendida',
        solicitudNueva: esDocente()
      };
      showToast('Guardando\u2026', 'ok');
      const ok = await insertRecord(rec);
      if(!ok) return;
      records.unshift(rec);
      document.getElementById('copias').value=1;
      document.getElementById('caras').value=1;
      resetDocenteFieldForRole();
      populateGradoSeccion('','');
      updateCalc();
      showToast('\u2713 Registro guardado', 'ok');
      renderAll();
      resetDocenteFieldForRole();
      if(!esDocente()){
        document.querySelector('[data-tab="registros"]').click();
      }
    }
  } finally {
    submitBtn.disabled = false;
    updateSubmitBtnLabel();
  }
});

async function deleteRecord(btn, id){
  if(soloLectura()){ showToast('Tu rol solo permite ver los registros.', 'error'); return; }
  const result = await Swal.fire({
    title: '\u00bfEliminar este registro?',
    text: 'Esta acci\u00f3n no se puede deshacer.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'S\u00ed, eliminar',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: 'var(--red)',
    cancelButtonColor: 'var(--ink-soft)',
    reverseButtons: true
  });
  if(!result.isConfirmed) return;
  if(btn) btn.disabled = true;
  showToast('Eliminando\u2026', 'ok');
  const ok = await deleteRecordDB(id);
  if(!ok){ if(btn) btn.disabled = false; return; }
  records = records.filter(r=>r.id !== id);
  if(editingId === id) cancelEdit(); // si justo se estaba editando este registro, salir del modo edicion
  showToast('\u2713 Registro eliminado', 'ok');
  renderAll();
}


