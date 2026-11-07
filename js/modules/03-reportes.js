// ---- Registros table ----
function renderTable(){
  const wrap = document.getElementById('tableWrap');
  const totWrap = document.getElementById('filtroTotales');
  const searchD = document.getElementById('searchDocente').value.toLowerCase();
  const searchG = document.getElementById('searchGrado').value.toLowerCase();
  const desde = document.getElementById('searchDesde').value;
  const hasta = document.getElementById('searchHasta').value;

  let list = [...records].sort((a,b)=> (b.fecha||'').localeCompare(a.fecha||''));
  list = list.filter(r => {
    const matchD = r.docente.toLowerCase().includes(searchD);
    const matchG = (r.grado+' '+r.seccion).toLowerCase().includes(searchG);
    const matchDesde = !desde || (r.fecha||'') >= desde;
    const matchHasta = !hasta || (r.fecha||'') <= hasta;
    return matchD && matchG && matchDesde && matchHasta;
  });

  // Barra de totales del filtro actual
  const totalCarasFiltro = list.reduce((s,r)=> s + r.totalCaras, 0);
  const totalCostoFiltro = list.reduce((s,r)=> s + r.totalCaras * precioDeRegistro(r), 0);
  const hayFiltro = searchD || searchG || desde || hasta;
  if(hayFiltro && list.length > 0){
    totWrap.innerHTML = `
      <div class="filtro-totales">
        <span>\u{1F4CB} <b>${list.length}</b> registro(s)</span>
        <span>Total caras: <b>${totalCarasFiltro}</b></span>
        <span class="ft-costo">Total a cobrar: <b>S/ ${totalCostoFiltro.toFixed(2)}</b></span>
      </div>`;
  } else {
    totWrap.innerHTML = '';
  }

  if(list.length === 0){
    wrap.innerHTML = '<div class="empty">Sin registros para los filtros aplicados.</div>';
    document.getElementById('pagNavReg').innerHTML = '';
    document.getElementById('pagInfoReg').textContent = '';
    return;
  }

  const pageSize = parseInt(document.getElementById('pagSizeReg').value);
  const totalPages = Math.max(1, Math.ceil(list.length / pageSize));
  pagReg = Math.min(pagReg, totalPages);
  const start = (pagReg - 1) * pageSize;
  const pagList = pageSize >= 9999 ? list : list.slice(start, start + pageSize);

  document.getElementById('pagInfoReg').textContent =
    pageSize >= 9999 ? `${list.length} registros` : `${start+1}\u2013${Math.min(start+pageSize, list.length)} de ${list.length}`;

  let rows = pagList.map(r => `
    <tr class="${r.id===editingId ? 'editing-row' : ''}">
      <td>${r.fecha||''}</td>
      <td>${escapeHtml(r.docente)}</td>
      <td>${escapeHtml(r.area)}</td>
      <td>${escapeHtml(r.grado)} ${escapeHtml(r.seccion)}</td>
      <td class="num">${r.copias} x ${r.caras}</td>
      <td class="num">${r.totalCaras}</td>
      <td class="num">S/ ${(r.totalCaras*precioDeRegistro(r)).toFixed(2)}</td>
      <td class="acciones">${soloLectura() ? '' : `
        <button class="btn-edit" onclick="${jsCall('startEdit', r.id)}" title="Editar">&#9998;</button>
        <button class="btn-del" onclick="${jsCallWithThis('deleteRecord', r.id)}" title="Eliminar">\u2715</button>`}
      </td>
    </tr>
  `).join('');
  wrap.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Fecha</th><th>Docente</th><th>\u00c1rea</th><th>Grado</th>
          <th class="num">Copias x caras</th><th class="num">Total caras</th><th class="num">Costo</th><th></th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
  buildPagNav('pagNavReg', totalPages, pagReg, (p)=>{ pagReg=p; renderTable(); });
}

function buildPagNav(id, total, current, onPage){
  const nav = document.getElementById(id);
  if(total <= 1){ nav.innerHTML=''; return; }
  const MAX = 7;
  let pages = [];
  if(total <= MAX){
    for(let i=1;i<=total;i++) pages.push(i);
  } else {
    pages = [1];
    let lo = Math.max(2, current-2), hi = Math.min(total-1, current+2);
    if(lo > 2) pages.push('...');
    for(let i=lo;i<=hi;i++) pages.push(i);
    if(hi < total-1) pages.push('...');
    pages.push(total);
  }
  nav.innerHTML =
    `<button class="pag-btn" ${current===1?'disabled':''} onclick="(${onPage.toString()})(${current-1})">&laquo; Ant</button>` +
    pages.map(p => p==='...'
      ? `<span style="padding:5px 4px;font-size:0.8rem;color:var(--ink-soft)">\u2026</span>`
      : `<button class="pag-btn ${p===current?'active':''}" onclick="(${onPage.toString()})(${p})">${p}</button>`
    ).join('') +
    `<button class="pag-btn" ${current===total?'disabled':''} onclick="(${onPage.toString()})(${current+1})">Sig &raquo;</button>`;
}

document.getElementById('searchDocente').addEventListener('input', ()=>{ pagReg=1; renderTable(); });
document.getElementById('searchGrado').addEventListener('input', ()=>{ pagReg=1; renderTable(); });
document.getElementById('searchDesde').addEventListener('change', ()=>{ pagReg=1; renderTable(); });
document.getElementById('searchHasta').addEventListener('change', ()=>{ pagReg=1; renderTable(); });
document.getElementById('pagSizeReg').addEventListener('change', ()=>{ pagReg=1; renderTable(); });
document.getElementById('clearFiltersBtn').addEventListener('click', ()=>{
  document.getElementById('searchDocente').value = '';
  document.getElementById('searchGrado').value = '';
  document.getElementById('searchDesde').value = '';
  document.getElementById('searchHasta').value = '';
  pagReg=1; renderTable();
});

// ---- Ranking / reportes generales ----
function groupSum(list, keyFn){
  const map = {};
  list.forEach(r=>{
    const k = keyFn(r) || '(sin dato)';
    if(!map[k]) map[k] = { caras:0, costo:0, registros:0 };
    map[k].caras += Number(r.totalCaras) || 0;
    map[k].costo += (Number(r.totalCaras) || 0) * precioDeRegistro(r);
    map[k].registros += 1;
  });
  return Object.entries(map).sort((a,b)=> b[1].caras - a[1].caras);
}

const NOMBRES_MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

function obtenerClaveMes(fecha){
  return String(fecha || '').slice(0, 7);
}

function formatearMesRanking(claveMes){
  const [anio, mes] = claveMes.split('-');
  const indiceMes = Number(mes) - 1;
  return `${NOMBRES_MESES[indiceMes] || mes} ${anio}`;
}

function obtenerMesesRanking(){
  const meses = new Set();

  records.forEach(r => {
    const clave = obtenerClaveMes(r.fecha);
    if(/^\d{4}-\d{2}$/.test(clave)) meses.add(clave);
  });

  const hoy = new Date();
  const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
  meses.add(mesActual);

  return [...meses].sort((a,b)=> b.localeCompare(a));
}

function actualizarSelectorMesRanking(){
  const select = document.getElementById('selectMesRanking');
  if(!select) return;

  const valorActual = select.value;
  const meses = obtenerMesesRanking();
  const hoy = new Date();
  const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;

  select.innerHTML = meses.map(mes =>
    `<option value="${mes}">${formatearMesRanking(mes)}</option>`
  ).join('');

  if(meses.includes(valorActual)) {
    select.value = valorActual;
  } else if(meses.includes(mesActual)) {
    select.value = mesActual;
  } else if(meses.length) {
    select.value = meses[0];
  }
}

function obtenerRegistrosMesRanking(){
  const select = document.getElementById('selectMesRanking');
  const mesSeleccionado = select ? select.value : '';
  return records.filter(r => obtenerClaveMes(r.fecha) === mesSeleccionado);
}

function renderReportes(){
  actualizarSelectorMesRanking();

  const selectMes = document.getElementById('selectMesRanking');
  const mesSeleccionado = selectMes ? selectMes.value : '';
  const nombreMes = mesSeleccionado ? formatearMesRanking(mesSeleccionado) : 'mes seleccionado';
  const monthRecords = obtenerRegistrosMesRanking();

  const totalCaras = monthRecords.reduce((s,r)=> s + (Number(r.totalCaras) || 0), 0);
  const totalCopias = monthRecords.reduce((s,r)=> s + (Number(r.copias) || 0), 0);
  const totalCosto = monthRecords.reduce((s,r)=> s + (Number(r.totalCaras) || 0) * precioDeRegistro(r), 0);

  document.getElementById('totalGeneral').textContent = 'S/ ' + totalCosto.toFixed(2);
  document.getElementById('statRegistros').textContent = monthRecords.length;
  document.getElementById('statCopias').textContent = totalCopias;
  document.getElementById('statCaras').textContent = totalCaras;
  document.getElementById('tituloTotalGeneral').textContent = `Total general - ${nombreMes}`;
  document.getElementById('tituloRankingDocentes').textContent = `Ranking por docente - ${nombreMes}`;
  document.getElementById('tituloRankingGrados').textContent = `Por grado y sección - ${nombreMes}`;

  const byDocente = groupSum(monthRecords, r=>r.docente);
  const maxCaras = byDocente.length ? byDocente[0][1].caras : 1;
  const psDoc = parseInt(document.getElementById('pagSizeDoc').value);
  const totalPagesDoc = Math.max(1, Math.ceil(byDocente.length / psDoc));
  pagDoc = Math.min(pagDoc, totalPagesDoc);
  const startDoc = (pagDoc-1)*psDoc;
  const pageDoc = psDoc >= 9999 ? byDocente : byDocente.slice(startDoc, startDoc+psDoc);

  document.getElementById('pagInfoDoc').textContent = byDocente.length === 0
    ? ''
    : (psDoc>=9999 ? `${byDocente.length} docentes` : `${startDoc+1}–${Math.min(startDoc+psDoc,byDocente.length)} de ${byDocente.length}`);

  const rankDoc = document.getElementById('rankDocentes');
  rankDoc.innerHTML = byDocente.length === 0
    ? `<div class="empty">Sin datos para ${nombreMes}.</div>`
    : pageDoc.map(([name, v], i) => `
      <div class="rank-item">
        <div class="rank-num">${startDoc+i+1}</div>
        <div style="flex:1">
          <div class="rank-name">${escapeHtml(name)}</div>
          <div class="rank-sub">${v.registros} registro(s) · ${v.caras} caras</div>
          <div class="rank-bar-wrap"><div class="rank-bar" style="width:${(v.caras/maxCaras*100).toFixed(0)}%"></div></div>
        </div>
        <div class="rank-amt">S/ ${v.costo.toFixed(2)}</div>
      </div>
    `).join('');
  buildPagNav('pagNavDoc', totalPagesDoc, pagDoc, (p)=>{ pagDoc=p; renderReportes(); });

  const byGrado = groupSum(monthRecords, r=> (r.grado+' '+r.seccion).trim());
  const psGrad = parseInt(document.getElementById('pagSizeGrad').value);
  const totalPagesGrad = Math.max(1, Math.ceil(byGrado.length / psGrad));
  pagGrad = Math.min(pagGrad, totalPagesGrad);
  const startGrad = (pagGrad-1)*psGrad;
  const pageGrad = psGrad >= 9999 ? byGrado : byGrado.slice(startGrad, startGrad+psGrad);

  document.getElementById('pagInfoGrad').textContent = byGrado.length === 0
    ? ''
    : (psGrad>=9999 ? `${byGrado.length} secciones` : `${startGrad+1}–${Math.min(startGrad+psGrad,byGrado.length)} de ${byGrado.length}`);

  const rankGr = document.getElementById('rankGrados');
  rankGr.innerHTML = byGrado.length === 0
    ? `<div class="empty">Sin datos para ${nombreMes}.</div>`
    : pageGrad.map(([name, v], i) => `
      <div class="rank-item">
        <div class="rank-num">${startGrad+i+1}</div>
        <div class="rank-name" style="flex:1">${escapeHtml(name)}
          <div class="rank-sub">${v.registros} registro(s) · ${v.caras} caras</div>
        </div>
        <div class="rank-amt">S/ ${v.costo.toFixed(2)}</div>
      </div>
    `).join('');
  buildPagNav('pagNavGrad', totalPagesGrad, pagGrad, (p)=>{ pagGrad=p; renderReportes(); });
}

document.getElementById('selectMesRanking').addEventListener('change', ()=>{
  pagDoc = 1;
  pagGrad = 1;
  renderReportes();
});
document.getElementById('pagSizeDoc').addEventListener('change', ()=>{ pagDoc=1; renderReportes(); });
document.getElementById('pagSizeGrad').addEventListener('change', ()=>{ pagGrad=1; renderReportes(); });
