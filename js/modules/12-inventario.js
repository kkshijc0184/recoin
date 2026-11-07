// ---- Inventario de bienes patrimoniales ----
// admin: agrega, edita, da de baja. directivo: solo ve y exporta.
// (La protección real está en las políticas RLS de Supabase.)

const CATEGORIAS_INV = ['Equipo de cómputo', 'Equipo de oficina', 'Unidades de transporte y maquinarias', 'Talleres'];
const INV_CABECERA = [
  'GOBIERNO REGIONAL DE SAN MARTÍN',
  'UNIDAD DE GESTIÓN EDUCATIVA LOCAL LAMAS',
  'INSTITUCIÓN EDUCATIVA N° 0773'
];
const INV_TITULO = 'INVENTARIO FÍSICO DE BIENES PATRIMONIALES';
const INV_SUBTITULO = '0773 JEC - BARRANQUITA';
const INV_COLUMNAS = ['DENOMINACIÓN', 'MARCA', 'MODELO', 'CARACTERÍSTICAS', 'COLOR', 'SERIE Y/O DIMENSIONES', 'ESTADO', 'OBSERVACIONES'];

let pagInv = 1, pagHis = 1;
let invVista = [];        // lista filtrada actual (la que se exporta)
let prestadasMap = {};    // { bien_id: unidades prestadas ahora }

function invEl(id){ return document.getElementById(id); }
function puedeEditarInventario(){ return esAdmin(); }
function unidadesBien(b){ return b.cantidad || 1; }
function formatoFecha(f){ return f ? String(f).slice(0,10).split('-').reverse().join('/') : ''; }
function codigoBien(n){ return 'JEC-' + String(n).padStart(4, '0'); }
function siguienteNumBien(){
  return bienes.reduce((m, b) => Math.max(m, parseInt(String(b.id).replace(/\D/g, ''), 10) || 0), 0) + 1;
}

function calcularPrestadas(){
  prestadasMap = {};
  prestamos.forEach(p => {
    if(p.estado !== 'prestado') return;
    (p.prestamo_items || []).forEach(i => {
      prestadasMap[i.bien_id] = (prestadasMap[i.bien_id] || 0) + i.cantidad;
    });
  });
}

async function loadInventarioDatos(){
  if(esDocente()) return;
  await Promise.all([loadBienes(), loadPrestamos()]);
}

function filtrarBienes(){
  const palabras = (invEl('invSearch').value || '').toLowerCase().trim().split(/\s+/).filter(Boolean);
  const cat = invEl('invCat').value;
  const sit = invEl('invSit').value;
  const soloSin = invEl('invSoloSinSerie').checked;
  return bienes.filter(b => {
    if(cat && b.categoria !== cat) return false;
    if(sit === 'A' && b.baja) return false;
    if(sit === 'B' && !b.baja) return false;
    if(soloSin && (b.serie || b.cantidad || b.baja)) return false;
    const t = [b.id, b.denominacion, b.marca, b.modelo, b.caracteristicas, b.color, b.serie].join(' ').toLowerCase();
    return palabras.every(w => t.includes(w));
  });
}

function renderInvStatsYResumen(){
  calcularPrestadas();
  let activos = 0, bajas = 0, prestadas = 0;
  bienes.forEach(b => {
    if(b.baja) bajas += unidadesBien(b);
    else { activos += unidadesBien(b); prestadas += prestadasMap[b.id] || 0; }
  });
  invEl('invStats').innerHTML =
    statCard('Bienes activos', activos, '🖥️', 'blue', 'En el inventario') +
    statCard('Disponibles', activos - prestadas, '✓', 'green', 'Listos para prestar') +
    statCard('Prestados', prestadas, '⏳', 'amber', prestadas ? 'Fuera del almacén' : 'Todo guardado') +
    statCard('De baja', bajas, '🗂️', 'red', 'Sin arreglo o retirados');

  let tot = 0, prest = 0, baja = 0, sinSerie = 0;
  invVista.forEach(b => {
    tot += unidadesBien(b);
    if(b.baja) baja += unidadesBien(b);
    else prest += prestadasMap[b.id] || 0;
    if(!b.serie && !b.cantidad && !b.baja) sinSerie++;
  });
  invEl('invResumen').innerHTML = `<div class="filtro-totales">
    <span>🖥️ <b>${tot}</b> equipo(s) en esta vista</span>
    <span>Disponibles: <b>${tot - prest - baja}</b></span>
    <span>Prestados: <b>${prest}</b></span>
    ${sinSerie ? `<span class="ft-costo">Sin serie: <b>${sinSerie}</b></span>` : ''}
    ${baja ? `<span>De baja: <b>${baja}</b></span>` : ''}
  </div>`;
}

function renderInventario(){
  if(!invEl('invTableWrap')) return;
  const editar = puedeEditarInventario();
  invEl('invAddBtn').hidden = !editar;
  invEl('invAvisoLectura').hidden = editar;

  calcularPrestadas();
  invVista = filtrarBienes();
  renderInvStatsYResumen();

  if(!invVista.length){
    invEl('invTableWrap').innerHTML = '<div class="empty">No hay bienes con esos filtros.</div>';
    invEl('pagNavInv').innerHTML = ''; invEl('pagInfoInv').textContent = '';
    return;
  }

  const ps = parseInt(invEl('pagSizeInv').value, 10) || 10;
  const totalPaginas = Math.max(1, Math.ceil(invVista.length / ps));
  pagInv = Math.min(Math.max(pagInv, 1), totalPaginas);
  const inicio = (pagInv - 1) * ps;
  const visibles = ps >= 9999 ? invVista : invVista.slice(inicio, inicio + ps);
  invEl('pagInfoInv').textContent = ps >= 9999 ? `${invVista.length} bienes` : `${inicio + 1}–${inicio + visibles.length} de ${invVista.length}`;

  const filas = visibles.map(b => {
    const pres = prestadasMap[b.id] || 0;
    let disp;
    if(b.baja) disp = '<span class="request-status cancelada">De baja</span>';
    else if(b.cantidad) disp = pres
      ? `<span class="request-status pendiente">Prestadas ${pres} de ${b.cantidad}</span>`
      : `<span class="request-status lista">${b.cantidad} disponibles</span>`;
    else disp = pres ? '<span class="request-status pendiente">Prestado</span>' : '<span class="request-status lista">Disponible</span>';

    let serie;
    if(b.serie) serie = `<span class="inv-code">${escapeHtml(b.serie)}</span>`;
    else if(b.baja || b.cantidad) serie = '—';
    else if(editar) serie = `<input class="inv-serie" placeholder="Escribir serie" onchange="${jsCallWithThis('guardarSerieInline', b.id)}" aria-label="Serie de ${escapeHtml(b.id)}">`;
    else serie = '<span class="inv-sinserie">Sin serie</span>';

    const notaBaja = b.baja
      ? `<br><small class="inv-nota">Baja: ${escapeHtml(b.baja_motivo || '')} · ${formatoFecha(b.baja_fecha)}${b.baja_obs ? ' · ' + escapeHtml(b.baja_obs) : ''}</small>` : '';
    const acciones = !editar ? '' : `
      <button class="btn small secondary" onclick="${jsCall('abrirBienDialog', b.id)}">Editar</button>
      ${b.baja
        ? `<button class="btn small secondary" onclick="${jsCall('reactivarBien', b.id)}">Reactivar</button>`
        : `<button class="btn small danger" onclick="${jsCall('darDeBaja', b.id)}">Dar de baja</button>`}`;

    return `<tr class="${b.baja ? 'inv-baja' : ''}">
      <td class="inv-code">${escapeHtml(b.id)}</td>
      <td>${escapeHtml(b.denominacion)}${b.cantidad ? ` <span class="inv-lote">Lote × ${b.cantidad}</span>` : ''}${notaBaja}</td>
      <td>${escapeHtml(((b.marca || '') + ' ' + (b.modelo || '')).trim() || '—')}</td>
      <td>${escapeHtml(b.caracteristicas || '')}</td>
      <td>${serie}</td>
      <td>${escapeHtml(b.baja ? 'Baja' : b.estado)}</td>
      <td>${disp}</td>
      <td class="inv-acciones">${acciones}</td>
    </tr>`;
  }).join('');

  invEl('invTableWrap').innerHTML = `<div class="inv-scroll"><table>
    <thead><tr><th>Código</th><th>Denominación</th><th>Marca / modelo</th><th>Caract.</th><th>Serie</th><th>Estado</th><th>Disponibilidad</th><th></th></tr></thead>
    <tbody>${filas}</tbody></table></div>`;
  buildPagNav('pagNavInv', totalPaginas, pagInv, (p)=>{ pagInv = p; renderInventario(); });
}

// ---------- Serie escrita directamente en la fila ----------
async function guardarSerieInline(el, id){
  const v = (el.value || '').trim();
  if(!v) return;
  const dup = bienes.find(x => x.id !== id && (x.serie || '').toLowerCase() === v.toLowerCase());
  if(dup){
    el.classList.add('inv-dup');
    showToast('Esa serie ya existe en ' + dup.id, 'error');
    return;
  }
  el.disabled = true;
  const ok = await updateBienDB(id, { serie: v });
  if(!ok){ el.disabled = false; return; }
  const b = bienes.find(x => x.id === id);
  if(b) b.serie = v;
  el.parentNode.innerHTML = `<span class="inv-code">${escapeHtml(v)}</span>`;
  renderInvStatsYResumen();
  showToast('Serie guardada en ' + id, 'ok');
}

// ---------- Agregar / editar ----------
function campoTexto(id, etiqueta, valor, extra=''){
  return `<div class="${extra}"><label>${etiqueta}</label><input id="${id}" value="${escapeHtml(valor || '')}"></div>`;
}

async function abrirBienDialog(id){
  if(!puedeEditarInventario()) return;
  const b = id ? bienes.find(x => x.id === id) : null;
  const cats = CATEGORIAS_INV.map(c => `<option ${b && b.categoria === c ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('');
  const estados = ['Bueno', 'Regular', 'Malo'].map(e => `<option ${b && b.estado === e ? 'selected' : ''}>${e}</option>`).join('');
  const extra = b
    ? (b.cantidad ? '' : campoTexto('bfSerie', 'Serie y/o dimensiones', b.serie, 'full'))
    : `<div><label>Cantidad (misma marca y modelo)</label><input id="bfCant" type="number" min="1" max="500" value="1"></div>
       <div class="inv-check"><label><input type="checkbox" id="bfLote"> Un solo lote (ej. 22 calculadoras sin serie)</label></div>`;

  const { value } = await Swal.fire({
    title: b ? 'Editar ' + b.id : 'Agregar bien',
    width: 560,
    html: `<div class="inv-form">
      ${campoTexto('bfDen', 'Denominación', b && b.denominacion, 'full')}
      ${campoTexto('bfMarca', 'Marca', b && b.marca)}
      ${campoTexto('bfModelo', 'Modelo', b && b.modelo)}
      ${campoTexto('bfCaract', 'Características', b && b.caracteristicas)}
      ${campoTexto('bfColor', 'Color', b && b.color)}
      <div><label>Categoría</label><select id="bfCat">${cats}</select></div>
      <div><label>Estado</label><select id="bfEstado">${estados}</select></div>
      ${extra}
    </div>`,
    showCancelButton: true, confirmButtonText: 'Guardar', cancelButtonText: 'Cancelar', focusConfirm: false,
    preConfirm: () => {
      const g = (i) => (document.getElementById(i)?.value || '').trim();
      if(!g('bfDen')){ Swal.showValidationMessage('Escribe la denominación del bien'); return false; }
      const datos = {
        denominacion: g('bfDen'), marca: g('bfMarca'), modelo: g('bfModelo'),
        caracteristicas: g('bfCaract'), color: g('bfColor'), categoria: g('bfCat'), estado: g('bfEstado')
      };
      if(b){
        if(document.getElementById('bfSerie')){
          datos.serie = g('bfSerie');
          const dup = datos.serie && bienes.find(x => x.id !== b.id && (x.serie || '').toLowerCase() === datos.serie.toLowerCase());
          if(dup){ Swal.showValidationMessage('Esa serie ya existe en ' + dup.id); return false; }
        }
      } else {
        datos.cantidad = Math.max(1, Math.min(500, parseInt(g('bfCant'), 10) || 1));
        datos.lote = !!document.getElementById('bfLote')?.checked;
      }
      return datos;
    }
  });
  if(!value) return;

  if(b){
    if(await updateBienDB(b.id, value)){
      await loadBienes(); renderInventario(); showToast('Cambios guardados', 'ok');
    }
    return;
  }

  const { cantidad, lote, ...base } = value;
  const primero = siguienteNumBien();
  let filas = [];
  if(lote && cantidad > 1) filas = [{ ...base, serie: '', id: codigoBien(primero), cantidad }];
  else for(let i = 0; i < cantidad; i++) filas.push({ ...base, serie: '', id: codigoBien(primero + i), cantidad: null });

  if(await insertBienesDB(filas)){
    await loadBienes();
    if(cantidad > 1 && !lote){
      invEl('invSoloSinSerie').checked = true;
      invEl('invSearch').value = ''; invEl('invCat').value = ''; invEl('invSit').value = 'A';
    }
    pagInv = 1; renderInventario();
    showToast(cantidad > 1 && !lote ? `${cantidad} bienes agregados. Completa las series en la tabla.` : 'Bien agregado', 'ok');
  }
}

// ---------- Baja / reactivación ----------
async function darDeBaja(id){
  if(!puedeEditarInventario()) return;
  const b = bienes.find(x => x.id === id);
  if(!b) return;
  if(prestadasMap[id] > 0){
    await Swal.fire({ title: 'Bien prestado', text: 'Primero registra la devolución de este bien.', icon: 'info', confirmButtonText: 'Entendido' });
    return;
  }
  const { value } = await Swal.fire({
    title: `Dar de baja ${b.id}`,
    html: `<p style="margin:0 0 10px">${escapeHtml(b.denominacion)}. El bien no se borra: queda en el inventario con su motivo y fecha.</p>
      <div class="inv-form">
        <div class="full"><label>Motivo</label><select id="bjMotivo"><option>Sin reparación</option><option>Obsoleto</option><option>Pérdida o robo</option><option>Otro</option></select></div>
        <div class="full"><label>Observación</label><input id="bjObs" placeholder="Ej. Parlante quemado"></div>
      </div>`,
    showCancelButton: true, confirmButtonText: 'Confirmar baja', cancelButtonText: 'Cancelar',
    preConfirm: () => ({
      motivo: document.getElementById('bjMotivo').value,
      obs: document.getElementById('bjObs').value.trim()
    })
  });
  if(!value) return;
  const ok = await updateBienDB(id, { baja: true, estado: 'Baja', baja_motivo: value.motivo, baja_obs: value.obs, baja_fecha: todayStr() });
  if(ok){ await loadBienes(); renderInventario(); showToast(id + ' dado de baja', 'ok'); }
}

async function reactivarBien(id){
  if(!puedeEditarInventario()) return;
  const r = await Swal.fire({ title: '¿Reactivar ' + id + '?', text: 'Volverá al inventario activo con estado Regular.', icon: 'question', showCancelButton: true, confirmButtonText: 'Sí, reactivar', cancelButtonText: 'Cancelar' });
  if(!r.isConfirmed) return;
  const ok = await updateBienDB(id, { baja: false, estado: 'Regular', baja_motivo: null, baja_obs: null, baja_fecha: null });
  if(ok){ await loadBienes(); renderInventario(); showToast(id + ' reactivado', 'ok'); }
}

// ---------- Exportar (lo que se ve filtrado, todas las páginas) ----------
function filasExportBienes(lista){
  return lista.map(b => [
    b.denominacion + (b.cantidad ? ` (${b.cantidad} unidades)` : ''),
    b.marca || '', b.modelo || '', b.caracteristicas || '', b.color || '', b.serie || '',
    b.baja ? 'Baja' : b.estado,
    b.baja ? (b.baja_motivo || '') + (b.baja_obs ? ': ' + b.baja_obs : '') : ''
  ]);
}

function categoriasMarcadas(lista){
  const h = {};
  lista.forEach(b => { h[b.categoria] = true; });
  return [
    ['EQUIPO DE OFICINA', h['Equipo de oficina']],
    ['UNIDADES DE TRANSPORTE, MAQUINARIAS', h['Unidades de transporte y maquinarias']],
    ['EQUIPO DE COMPUTO', h['Equipo de cómputo']],
    ['TALLERES', h['Talleres']]
  ];
}

function exportarInventarioExcel(){
  if(typeof XLSX === 'undefined'){ showToast('No se pudo cargar el módulo de Excel.', 'error'); return; }
  if(!invVista.length){ showToast('No hay bienes para exportar.', 'error'); return; }
  const a = [...INV_CABECERA.map(t => [t]), [], [INV_TITULO], [INV_SUBTITULO], []];
  categoriasMarcadas(invVista).forEach(c => a.push([c[0], c[1] ? 'X' : '']));
  a.push([], INV_COLUMNAS, ...filasExportBienes(invVista));
  const ws = XLSX.utils.aoa_to_sheet(a);
  ws['!cols'] = [{wch:38},{wch:12},{wch:20},{wch:18},{wch:10},{wch:24},{wch:10},{wch:28}];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Inventario');
  XLSX.writeFile(wb, `inventario_${todayStr()}.xlsx`);
}

function exportarInventarioPDF(){
  if(!invVista.length){ showToast('No hay bienes para exportar.', 'error'); return; }
  const w = window.open('', '_blank');
  if(!w){ showToast('Permite las ventanas emergentes para generar el PDF.', 'error'); return; }
  const cats = categoriasMarcadas(invVista)
    .map(c => `<tr><td>${c[0]}</td><td class="x">${c[1] ? 'X' : ''}</td></tr>`).join('');
  const filas = filasExportBienes(invVista)
    .map(r => `<tr>${r.map(v => `<td>${escapeHtml(v)}</td>`).join('')}</tr>`).join('');
  w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Inventario ${todayStr()}</title>
    <style>
      @page{size:A4 landscape;margin:12mm}
      body{font:11px 'Segoe UI',Arial,sans-serif;color:#111;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .cab{text-align:center;border:1px solid #0f4a33;border-top:5px solid #0f4a33;padding:8px;margin-bottom:10px;line-height:1.5}
      h2{text-align:center;font-size:14px;margin:10px 0;color:#0f4a33}
      table{width:100%;border-collapse:collapse}
      .cat{width:auto;margin:6px 0 12px}.cat td{padding:2px 8px}.cat .x{border:1px solid #0f4a33;width:30px;text-align:center;font-weight:bold}
      .tab th,.tab td{border:1px solid #9bb5a6;padding:4px 6px;font-size:10px;text-align:left}
      .tab th{background:#0f4a33;color:#fff;border-color:#0f4a33}
      .tab tbody tr:nth-child(even) td{background:#f1f7f3}
    </style></head><body>
    <div class="cab"><b>${INV_CABECERA[0]}</b><br>${INV_CABECERA[1]}<br>${INV_CABECERA[2]}</div>
    <h2>${INV_TITULO}</h2><p><b>${INV_SUBTITULO}</b></p>
    <table class="cat">${cats}</table>
    <table class="tab"><thead><tr>${INV_COLUMNAS.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>${filas}</tbody></table>
    <p>Fecha: ${formatoFecha(todayStr())}</p></body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
}

// ---------- Historial de cambios ----------
const ETIQUETAS_HIS = {
  denominacion: 'Denominación', marca: 'Marca', modelo: 'Modelo', caracteristicas: 'Características',
  color: 'Color', serie: 'Serie', categoria: 'Categoría', estado: 'Estado', cantidad: 'Cantidad',
  baja_motivo: 'Motivo de baja', baja_obs: 'Observación de baja', baja_fecha: 'Fecha de baja'
};
const ACCIONES_HIS = {
  alta: ['Alta', 'lista'], edicion: ['Edición', 'en_proceso'], baja: ['Baja', 'cancelada'],
  reactivacion: ['Reactivación', 'lista'], prestamo: ['Préstamo', 'pendiente'],
  devolucion: ['Devolución', 'entregada'], anulacion: ['Anulación', 'cancelada'], eliminacion: ['Eliminación', 'cancelada']
};

function valorHis(v){ return (v === null || v === undefined || v === '') ? '—' : String(v); }

function detalleHistorial(h){
  const d = h.detalle || {};
  if(h.accion === 'alta') return `Se registró «${d.denominacion || ''}»` + (d.cantidad ? ` (lote de ${d.cantidad})` : '');
  if(h.accion === 'prestamo') return `${d.docente || ''}${d.aula ? ' · ' + d.aula : ''}${d.cantidad > 1 ? ' · ' + d.cantidad + ' unidades' : ''}`;
  if(h.accion === 'devolucion') return d.cantidad > 1 ? d.cantidad + ' unidades devueltas' : 'Devuelto';
  if(h.accion === 'anulacion') return d.motivo || '';
  return Object.entries(d)
    .filter(([k]) => ETIQUETAS_HIS[k])
    .map(([k, v]) => `${ETIQUETAS_HIS[k]}: ${valorHis(v.antes)} → ${valorHis(v.despues)}`)
    .join(' · ');
}

function renderHistorial(){
  const wrap = invEl('hisTableWrap');
  if(!wrap) return;
  const q = (invEl('hisSearch').value || '').toLowerCase().trim();
  const mapa = {}; bienes.forEach(b => { mapa[b.id] = b.denominacion; });
  let lista = historial.filter(h => {
    if(!q) return true;
    const t = [h.bien_id, mapa[h.bien_id], h.usuario_nombre, h.accion, detalleHistorial(h)].join(' ').toLowerCase();
    return q.split(/\s+/).every(w => t.includes(w));
  });
  if(!lista.length){
    wrap.innerHTML = '<div class="empty">Sin movimientos para mostrar.</div>';
    invEl('pagNavHis').innerHTML = ''; invEl('pagInfoHis').textContent = '';
    return;
  }
  const ps = parseInt(invEl('pagSizeHis').value, 10) || 10;
  const totalPaginas = Math.max(1, Math.ceil(lista.length / ps));
  pagHis = Math.min(Math.max(pagHis, 1), totalPaginas);
  const inicio = (pagHis - 1) * ps;
  const vis = lista.slice(inicio, inicio + ps);
  invEl('pagInfoHis').textContent = `${inicio + 1}–${inicio + vis.length} de ${lista.length}`;
  wrap.innerHTML = `<div class="inv-scroll"><table><thead><tr><th>Fecha y hora</th><th>Usuario</th><th>Bien</th><th>Acción</th><th>Detalle</th></tr></thead><tbody>${
    vis.map(h => {
      const [txt, cls] = ACCIONES_HIS[h.accion] || [h.accion, 'pendiente'];
      return `<tr>
        <td>${new Date(h.created_at).toLocaleString('es-PE')}</td>
        <td>${escapeHtml(h.usuario_nombre || '')}</td>
        <td><span class="inv-code">${escapeHtml(h.bien_id || '')}</span> ${escapeHtml(mapa[h.bien_id] || '')}</td>
        <td><span class="request-status ${cls}">${escapeHtml(txt)}</span></td>
        <td>${escapeHtml(detalleHistorial(h))}</td></tr>`;
    }).join('')}</tbody></table></div>`;
  buildPagNav('pagNavHis', totalPaginas, pagHis, (p)=>{ pagHis = p; renderHistorial(); });
}

async function mostrarHistorial(){
  await loadHistorial();
  pagHis = 1;
  renderHistorial();
}

// ---------- Eventos ----------
['invSearch'].forEach(id => invEl(id)?.addEventListener('input', () => { pagInv = 1; renderInventario(); }));
['invCat', 'invSit', 'invSoloSinSerie', 'pagSizeInv'].forEach(id => invEl(id)?.addEventListener('change', () => { pagInv = 1; renderInventario(); }));
invEl('invAddBtn')?.addEventListener('click', () => abrirBienDialog());
invEl('invExcelBtn')?.addEventListener('click', exportarInventarioExcel);
invEl('invPdfBtn')?.addEventListener('click', exportarInventarioPDF);
invEl('hisSearch')?.addEventListener('input', () => { pagHis = 1; renderHistorial(); });
invEl('pagSizeHis')?.addEventListener('change', () => { pagHis = 1; renderHistorial(); });
document.querySelector('[data-subtab="inv-historial"]')?.addEventListener('click', mostrarHistorial);
invEl('hisReloadBtn')?.addEventListener('click', mostrarHistorial);
invEl('invCat') && (invEl('invCat').innerHTML = '<option value="">Todas las categorías</option>' + CATEGORIAS_INV.map(c => `<option>${escapeHtml(c)}</option>`).join(''));
