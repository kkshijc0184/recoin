// ============================================================
// SOLICITUDES DE COPIAS / NOTIFICACIONES
// ============================================================
function solicitudEstadoTexto(e){
  return ({pendiente:'Pendiente',en_proceso:'En proceso',lista:'Lista',entregada:'Entregada',cancelada:'Cancelada'})[e] || e || 'Pendiente';
}
function solicitudEstadoClase(e){
  return ['pendiente','en_proceso','lista','entregada','cancelada'].includes(e) ? e : 'pendiente';
}
function solicitudesNuevas(){ return records.filter(r=>r.solicitudNueva===true && r.estadoSolicitud==='pendiente'); }
function solicitudesPendientes(){ return records.filter(r=>['pendiente','en_proceso','lista'].includes(r.estadoSolicitud)); }

// ------------------------------------------------------------
// Sonido: los navegadores bloquean audio automatico. La primera
// interaccion del administrador desbloquea el reproductor y luego
// las nuevas solicitudes pueden sonar durante el polling.
// ------------------------------------------------------------
let notifAudioUnlocked = false;
function prepararSonidoNotificacion(){
  const audio=document.getElementById('notifSound');
  if(!audio || notifAudioUnlocked) return;
  try{
    audio.muted=true;
    const p=audio.play();
    if(p && typeof p.then==='function'){
      p.then(()=>{
        audio.pause();
        audio.currentTime=0;
        audio.muted=false;
        notifAudioUnlocked=true;
      }).catch(()=>{
        audio.muted=false;
      });
    }
  }catch(e){}
}
function reproducirSonidoNotificacion(){
  const audio=document.getElementById('notifSound');
  if(!audio) return;
  try{
    audio.currentTime=0;
    audio.muted=false;
    const p=audio.play();
    if(p && typeof p.catch==='function') p.catch(()=>{});
  }catch(e){}
}
['pointerdown','keydown','touchstart'].forEach(evt=>{
  document.addEventListener(evt, prepararSonidoNotificacion, {once:true, passive:true});
});

// IDs que ya fueron anunciados en este navegador. Asi una recarga no
// repite indefinidamente el mismo sonido, pero una solicitud nueva si suena.
function notifStorageKey(){ return 'copias:notified-request-ids:' + (session?.user?.id || 'admin'); }
function obtenerSolicitudesAnunciadas(){
  try{ return new Set(JSON.parse(localStorage.getItem(notifStorageKey()) || '[]')); }
  catch(e){ return new Set(); }
}
function guardarSolicitudesAnunciadas(ids){
  try{
    const arr=[...ids].slice(-300);
    localStorage.setItem(notifStorageKey(), JSON.stringify(arr));
  }catch(e){}
}

function actualizarIndicadoresSolicitudes(n){
  const bell=document.getElementById('notificationBell'), b=document.getElementById('notificationCount');
  const tb=document.getElementById('tabSolicitudesCount'), tab=document.getElementById('solicitudesTab');

  if(bell) bell.hidden=esDocente();
  if(tab) tab.hidden=false;
  if(esDocente()){
    [b,tb].forEach(x=>{ if(x){x.textContent='';x.hidden=true;} });
    return;
  }
  [b,tb].forEach(x=>{ if(x){x.textContent=n||0;x.hidden=!n;} });
  if(bell) bell.classList.toggle('has-notifications', n>0);
}

function renderDashboardSolicitudes(){
  const card=document.getElementById('dashboardSolicitudesCard');
  if(!card) return;
  if(esDocente()){card.hidden=true;return;}
  const n=solicitudesNuevas().length, p=solicitudesPendientes().length;
  card.hidden=p===0;
  document.getElementById('dashboardSolicitudesCount').textContent=p;
  document.getElementById('dashboardSolicitudesText').textContent=n
    ? `${n} solicitud(es) nueva(s) requieren revisión.`
    : `${p} solicitud(es) todavía están en atención.`;
  actualizarIndicadoresSolicitudes(n);
}

function horaSolicitud(r){
  if(!r.solicitudCreadaAt) return r.fecha||'—';
  const d=new Date(r.solicitudCreadaAt);
  return Number.isNaN(d.getTime()) ? (r.fecha||'—') :
    d.toLocaleString('es-PE',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
}

// Card del resumen de solicitudes: barra de titulo, numero grande,
// icono circular de color y una linea de contexto al pie.
function statCard(label, valor, icono, color, pie){
  return `<div class="request-stat">
    <div class="cap">${escapeHtml(label)}</div>
    <div class="body">
      <span class="n">${valor}</span>
      <span class="ico ${color}">${icono}</span>
    </div>
    <div class="foot">${escapeHtml(pie||'')}</div>
  </div>`;
}

// ------------------------------------------------------------
// Paginacion de la tabla de solicitudes. Reutiliza buildPagNav y
// el mismo marcado .pag-controls / .pag-nav de la pestana Registros
// para que se vea y se maneje igual en todo el sistema.
// ------------------------------------------------------------
function paginarSolicitudes(lista){
  const sel=document.getElementById('pagSizeSol');
  const ps=parseInt(sel?.value,10) || 10;
  const totalPaginas=Math.max(1, Math.ceil(lista.length/ps));
  pagSol=Math.min(Math.max(pagSol,1), totalPaginas);
  const inicio=(pagSol-1)*ps;
  const visibles=lista.slice(inicio, inicio+ps);
  aplicarPaginacionSolicitudes(lista.length, inicio, visibles.length, totalPaginas);
  return visibles;
}

function aplicarPaginacionSolicitudes(total, inicio, mostradas, totalPaginas=1){
  const ctrl=document.getElementById('solicitudesPagControls');
  const info=document.getElementById('pagInfoSol');
  const nav=document.getElementById('pagNavSol');
  // Con pocas solicitudes los controles solo estorban, asi que se ocultan.
  if(ctrl) ctrl.hidden = total <= 5;
  if(info) info.textContent = total ? `${inicio+1}\u2013${inicio+mostradas} de ${total}` : '';
  if(nav && total===0){ nav.innerHTML=''; return; }
  buildPagNav('pagNavSol', totalPaginas, pagSol, (p)=>{ pagSol=p; renderSolicitudes(); });
}

function renderSolicitudes(){
  const wrap=document.getElementById('solicitudesWrap'), sum=document.getElementById('solicitudesResumen');
  if(!wrap||!sum) return;

  if(esDocente()){
    renderMisSolicitudes();
    return;
  }

  const lista=[...records].filter(r=>r.estadoSolicitud && r.estadoSolicitud!=='atendida')
    .sort((a,b)=>new Date(b.solicitudCreadaAt||b.fecha||0)-new Date(a.solicitudCreadaAt||a.fecha||0));
  const p=lista.filter(r=>r.estadoSolicitud==='pendiente').length;
  const e=lista.filter(r=>r.estadoSolicitud==='en_proceso').length;
  const l=lista.filter(r=>r.estadoSolicitud==='lista').length;
  sum.innerHTML=
    statCard('Pendientes', p, '⏳', 'amber', p?'Sin tomar todavía':'Nada por tomar')+
    statCard('En proceso', e, '⚙️', 'blue', e?'En preparación':'Nada en curso')+
    statCard('Listas', l, '✓', 'green', l?'Por entregar':'Nada por entregar');
  if(!lista.length){
    wrap.innerHTML='<div class="empty">No hay solicitudes pendientes o en atención.</div>';
    aplicarPaginacionSolicitudes(0,0,0);
    return;
  }
  const pagina=paginarSolicitudes(lista);
  const rows=pagina.map(r=>{
    const s=solicitudEstadoClase(r.estadoSolicitud), nuevo=r.solicitudNueva;
    let actions='';
    if(s==='pendiente') actions=`<button class="btn small secondary" onclick="${jsCall('cambiarEstadoSolicitudUI',r.id,'en_proceso')}">Tomar</button>
      <button class="btn small" onclick="${jsCall('cambiarEstadoSolicitudUI',r.id,'cancelada')}">Cancelar</button>`;
    else if(s==='en_proceso') actions=`<button class="btn small" onclick="${jsCall('cambiarEstadoSolicitudUI',r.id,'lista')}">Marcar lista</button>`;
    else if(s==='lista') actions=`<button class="btn small" onclick="${jsCall('cambiarEstadoSolicitudUI',r.id,'entregada')}">Entregada</button>`;
    return `<tr class="${nuevo?'request-new-row':''}">
      <td>${nuevo?'<span class="request-new-dot"></span>':''}${escapeHtml(r.docente)}</td>
      <td>${escapeHtml(r.area)}</td><td>${escapeHtml(r.grado)} ${escapeHtml(r.seccion)}</td>
      <td class="num">${r.copias}</td><td class="num">${r.caras} / ${r.totalCaras}</td>
      <td>${escapeHtml(horaSolicitud(r))}</td>
      <td><span class="request-status ${s}">${escapeHtml(solicitudEstadoTexto(s))}</span></td>
      <td><div class="request-actions">${actions}</div></td></tr>`;
  }).join('');
  wrap.innerHTML=`<div class="card" style="padding:0;"><div class="request-table-wrap"><table class="request-table">
    <thead><tr><th>Docente</th><th>Área</th><th>Grado/Sección</th><th class="num">Copias</th><th class="num">Caras</th><th>Solicitada</th><th>Estado</th><th>Acción</th></tr></thead>
    <tbody>${rows}</tbody></table></div></div>`;
}

function renderMisSolicitudes(){
  const wrap=document.getElementById('solicitudesWrap'), sum=document.getElementById('solicitudesResumen');
  if(!wrap||!sum) return;
  const nombre=(perfil?.docente_nombre||'').trim().toLowerCase();
  const lista=[...records]
    .filter(r=>!nombre || (r.docente||'').trim().toLowerCase()===nombre)
    .sort((a,b)=>new Date(b.solicitudCreadaAt||b.fecha||0)-new Date(a.solicitudCreadaAt||a.fecha||0));

  const pendientes=lista.filter(r=>r.estadoSolicitud==='pendiente').length;
  const proceso=lista.filter(r=>r.estadoSolicitud==='en_proceso').length;
  const listas=lista.filter(r=>r.estadoSolicitud==='lista').length;
  const total=lista.length;

  const tabCount=document.getElementById('tabSolicitudesCount');
  const tabLabel=document.getElementById('solicitudesTabLabel');
  if(tabLabel) tabLabel.textContent='📋 Mis solicitudes';
  if(tabCount){ tabCount.textContent=total; tabCount.hidden=total===0; }

  sum.classList.add('teacher-summary');
  sum.innerHTML=
    statCard('Pendientes', pendientes, '⏳', 'amber', pendientes?'Esperando atención':'Nada pendiente')+
    statCard('En proceso', proceso, '⚙️', 'blue', proceso?'Se están sacando':'Nada en curso')+
    statCard('Listas', listas, '✓', 'green', listas?'Puedes recogerlas':'Nada por recoger')+
    statCard('Total solicitudes', total, '📋', 'gold', 'Historial completo');

  if(!lista.length){
    wrap.innerHTML='<div class="empty">Todavía no tienes solicitudes registradas.</div>';
    aplicarPaginacionSolicitudes(0,0,0);
    return;
  }

  const rows=paginarSolicitudes(lista).map(r=>{
    const s=solicitudEstadoClase(r.estadoSolicitud);
    return `<tr>
      <td>${escapeHtml(r.fecha||'—')}</td><td>${escapeHtml(r.area||'—')}</td>
      <td>${escapeHtml(r.grado||'')} ${escapeHtml(r.seccion||'')}</td>
      <td class="num">${r.copias}</td><td class="num">${r.caras} / ${r.totalCaras}</td>
      <td><span class="request-status ${s}">${escapeHtml(solicitudEstadoTexto(s))}</span></td>
    </tr>`;
  }).join('');

  wrap.innerHTML=`<div class="card" style="padding:0;"><div class="request-table-wrap"><table class="request-table teacher-request-table">
    <thead><tr><th>Fecha</th><th>Área</th><th>Grado/Sección</th><th class="num">Copias</th><th class="num">Caras</th><th>Estado</th></tr></thead>
    <tbody>${rows}</tbody></table></div></div>
    <p class="hint request-teacher-note">Aquí puedes consultar el estado de tus solicitudes. Solo tú puedes ver tus propios registros.</p>`;
}

async function cargarSolicitudes(avisar=true){
  const anteriores=solicitudesNuevas();
  const idsAntes=new Set(anteriores.map(r=>String(r.id)));
  await loadRecords();

  if(esDocente()){
    renderSolicitudes();
    return;
  }

  const nuevas=solicitudesNuevas();
  const idsNuevas=nuevas.map(r=>String(r.id));
  const anunciadas=obtenerSolicitudesAnunciadas();
  const recienLlegadas=nuevas.filter(r=>!idsAntes.has(String(r.id)) && !anunciadas.has(String(r.id)));

  // Si es la primera carga y ya habia solicitudes, tambien las anunciamos
  // una sola vez por navegador. Si el navegador no permite audio aun,
  // la campanita igualmente queda visible.
  if(avisar && recienLlegadas.length){
    showToast(`🔔 ${recienLlegadas.length} nueva(s) solicitud(es) de copias`,'info');
    reproducirSonidoNotificacion();
    recienLlegadas.forEach(r=>anunciadas.add(String(r.id)));
    guardarSolicitudesAnunciadas(anunciadas);
  }

  // Si el numero bajo, quitamos IDs ya resueltos del registro local de avisos.
  const pendientesIds=new Set(idsNuevas);
  for(const id of [...anunciadas]) if(!pendientesIds.has(id)) anunciadas.delete(id);
  guardarSolicitudesAnunciadas(anunciadas);

  solicitudesUltimoConteo=nuevas.length;
  actualizarIndicadoresSolicitudes(nuevas.length);
  renderSolicitudes();
  renderDashboardSolicitudes();
}

async function cambiarEstadoSolicitudUI(id,estado){
  if(esDocente()) return;
  const r=records.find(x=>x.id===id); if(!r)return;
  if(!(await atenderSolicitudDB(id,estado)))return;
  r.estadoSolicitud=estado; r.solicitudNueva=false;
  const anunciadas=obtenerSolicitudesAnunciadas();
  anunciadas.delete(String(id));
  guardarSolicitudesAnunciadas(anunciadas);
  showToast(`✓ Solicitud: ${solicitudEstadoTexto(estado)}`,'ok');
  actualizarIndicadoresSolicitudes(solicitudesNuevas().length); renderSolicitudes(); renderDashboardSolicitudes();
}

function iniciarPollingSolicitudes(){
  if(solicitudesPollingTimer) return;
  solicitudesPollingTimer=setInterval(()=>cargarSolicitudes(true),10000);
}

document.getElementById('notificationBell')?.addEventListener('click',async()=>{
  prepararSonidoNotificacion();
  document.querySelector('[data-tab="solicitudes"]')?.click();
  if(!esDocente()){
    const ids=solicitudesNuevas().map(r=>String(r.id));
    const anunciadas=obtenerSolicitudesAnunciadas();
    ids.forEach(id=>anunciadas.add(id));
    guardarSolicitudesAnunciadas(anunciadas);
    actualizarIndicadoresSolicitudes(solicitudesNuevas().length);
  }
});
document.getElementById('dashboardGoSolicitudesBtn')?.addEventListener('click',()=>document.querySelector('[data-tab="solicitudes"]')?.click());
document.getElementById('reloadSolicitudesBtn')?.addEventListener('click',async e=>{
  e.currentTarget.disabled=true; try{await cargarSolicitudes(false);showToast('✓ Solicitudes actualizadas','ok');}finally{e.currentTarget.disabled=false;}
});
document.getElementById('pagSizeSol')?.addEventListener('change',()=>{ pagSol=1; renderSolicitudes(); });
