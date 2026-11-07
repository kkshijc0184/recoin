// ---- Configuraci\u00f3n ----
// ---- Config: estado formulario docentes ----
let editingDocId = null;

function docFormReset(){
  editingDocId = null;
  document.getElementById('newDocNombre').value  = '';
  document.getElementById('newDocArea').value    = '';
  document.getElementById('newDocGrado').value   = '';
  document.getElementById('newDocSeccion').value = '';
  document.getElementById('newDocTipo').value    = 'Contratado';
  document.getElementById('saveNewDocBtn').textContent = '+ Guardar asignaci\u00f3n';
  document.getElementById('cancelDocEditBtn').hidden = true;
  document.getElementById('docFormTitle').textContent = 'Agregar nueva asignaci\u00f3n';
}

function docFormLoadForEdit(fila){
  editingDocId = fila.id;
  document.getElementById('newDocNombre').value  = fila.nombre;
  document.getElementById('newDocArea').value    = fila.area;
  document.getElementById('newDocGrado').value   = fila.grado;
  document.getElementById('newDocSeccion').value = fila.seccion;
  document.getElementById('newDocTipo').value    = fila.tipo || 'Contratado';
  document.getElementById('saveNewDocBtn').textContent = '\u2713 Actualizar';
  document.getElementById('cancelDocEditBtn').hidden = false;
  document.getElementById('docFormTitle').textContent = 'Editando asignaci\u00f3n';
  document.getElementById('docFormCard').scrollIntoView({ behavior:'smooth', block:'start' });
}

function renderConfig(){
  document.getElementById('schoolNameInput').value = schoolName;

  const filas = [...docentesRows].sort((a,b) => a.nombre.localeCompare(b.nombre));

  const dWrap = document.getElementById('docentesTableWrap');
  if(filas.length === 0){
    dWrap.innerHTML = '<div class="empty">Sin docentes cargados. Verifica la conexi\u00f3n con Supabase.</div>';
    document.getElementById('pagNavCfg').innerHTML = '';
    document.getElementById('pagInfoCfg').textContent = '';
  } else {
    const ps = parseInt(document.getElementById('pagSizeCfg').value);
    const totalPages = Math.max(1, Math.ceil(filas.length / ps));
    pagCfg = Math.min(pagCfg, totalPages);
    const start = (pagCfg-1)*ps;
    const pagFilas = ps >= 9999 ? filas : filas.slice(start, start+ps);

    document.getElementById('pagInfoCfg').textContent =
      ps>=9999 ? `${filas.length} asignaciones` : `${start+1}\u2013${Math.min(start+ps, filas.length)} de ${filas.length}`;

    dWrap.innerHTML = `
      <table class="mini-table doc-table">
        <thead>
          <tr>
            <th>Docente</th><th>\u00c1rea</th><th>Grado</th><th>Secc.</th>
            <th>Tipo</th><th>Estado</th><th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${pagFilas.map(f=>`
            <tr class="${editingDocId===f.id ? 'fila-editando' : ''} ${!f.activo ? 'fila-inactivo' : ''}">
              <td>${escapeHtml(f.nombre)}</td>
              <td>${escapeHtml(f.area)}</td>
              <td>${escapeHtml(f.grado)}</td>
              <td>${escapeHtml(f.seccion)}</td>
              <td><span class="badge-tipo ${(f.tipo||'Contratado')==='Nombrado' ? 'nombrado':'contratado'}">${escapeHtml(f.tipo||'Contratado')}</span></td>
              <td><span class="badge-estado ${f.activo!==false ? 'activo':'inactivo'}">${f.activo!==false ? 'Activo':'Inactivo'}</span></td>
              <td class="doc-actions">${soloLectura() ? '' : `
                <button class="btn-edit-doc" onclick='docFormLoadForEdit(${JSON.stringify(f)})' title="Editar">\u270e</button>
                <button class="btn-toggle-doc ${f.activo!==false ? 'desactivar':'activar'}"
                  onclick="toggleActivoDocente(${f.id}, ${f.activo!==false})"
                  title="${f.activo!==false ? 'Desactivar':'Activar'}">
                  ${f.activo!==false ? '\u23f8':'&#9654;'}
                </button>
                <button class="btn-del-doc" onclick="eliminarAsignacion(${f.id}, '${escapeHtml(f.nombre)}')" title="Eliminar">\u2715</button>`}
              </td>
            </tr>`).join('')}
        </tbody>
      </table>`;

    buildPagNav('pagNavCfg', totalPages, pagCfg, (p)=>{ pagCfg=p; renderConfig(); });
  }

  // Resumen activos/inactivos
  const activos   = docentesRows.filter(r => r.activo !== false).length;
  const inactivos = docentesRows.length - activos;
  document.getElementById('docResumen').textContent =
    `${docentesRows.length} asignaciones \u2014 ${activos} activas, ${inactivos} inactivas`;

  // Secciones derivadas (solo activos)
  const sWrap = document.getElementById('seccionesChips');
  sWrap.innerHTML = secciones.length === 0
    ? '<div class="empty">Sin secciones activas.</div>'
    : secciones.map(s=>`<span class="chip">${escapeHtml(s.grado)} ${escapeHtml(s.seccion)}</span>`).join('');
}

