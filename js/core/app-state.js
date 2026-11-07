// ---- Estado global de la aplicación ----
let records = [];
let editingId = null;
let price = 0.10;
let docentes = [];
let areas = [];

let secciones = [];
let schoolName = 'I.E.';
let schoolAddress = '';
let cobros = {};
let solicitudesUltimoConteo = null;
let solicitudesPollingTimer = null;

// Devuelve el precio por cara que corresponde a un registro: el que se
// congelo cuando se creo (r.precio), o el precio global actual como
// respaldo unicamente para registros antiguos guardados antes de agregar
// la columna "precio" en Supabase (r.precio === null/undefined).
// Los calculos de costo SIEMPRE deben pasar por esta funcion en vez de
// usar la variable "price" directamente, para no alterar el historial
// cuando cambie el precio configurado.
function precioDeRegistro(r){
  return (typeof r.precio === 'number') ? r.precio : price;
}

// Estado de paginacion
let pagReg = 1, pagDoc = 1, pagGrad = 1, pagCfg = 1, pagUsr = 1, pagSol = 1;

// ---- Seguridad: escape de texto antes de insertarlo en el DOM ----
// Cualquier dato que venga de un input del usuario o de Supabase se pasa
// por aqui antes de insertarse con innerHTML, para que no se interprete
// como HTML/JS (por ejemplo si alguien escribe "<img onerror=...>" como
// nombre de docente).
function escapeHtml(str){
  if(str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Genera de forma segura un atributo onclick="fn(arg1,arg2,...)":
// los argumentos se convierten a literales JS validos (JSON.stringify)
// y el resultado completo se escapa para poder insertarse como valor
// de un atributo HTML sin riesgo de que alguien "rompa" el atributo.
function jsCall(fnName, ...args){
  const argsStr = args.map(a => JSON.stringify(a)).join(',');
  return escapeHtml(`${fnName}(${argsStr})`);
}

// Igual que jsCall, pero le pasa el propio boton (this) como primer argumento
// para poder desactivarlo mientras la accion esta en curso (evita doble clic).
function jsCallWithThis(fnName, ...args){
  const argsStr = ['this', ...args.map(a => JSON.stringify(a))].join(',');
  return escapeHtml(`${fnName}(${argsStr})`);
}


// directorio construido desde Supabase: { nombre: { area: [seccion, ...] } }
let DIRECTORIO = {};

// Si Supabase devuelve 401, el usuario vuelve a la pantalla de login.
function onSessionExpired(){
  records = []; docentes = []; areas = []; secciones = []; cobros = {}; DIRECTORIO = {}; perfil = null;
  window.location.replace('login.html');
}

// ---- Carga inicial ----
async function loadData(){
  // Inicializar fechas
  document.getElementById('fecha').value = todayStr();
  document.getElementById('monthPicker').value = todayStr().slice(0,7);

  showToast('Conectando con la base de datos\u2026', 'ok');

  const pVal = lcGet('copias:price');
  if(pVal){ price = parseFloat(pVal); document.getElementById('priceInput').value = price; }
  const snVal = lcGet('copias:schoolName');
  if(snVal){ schoolName = snVal; }
  document.getElementById('schoolNameInput').value = schoolName;
  const saVal = lcGet('copias:schoolAddress');
  if(saVal){ schoolAddress = saVal; }
  document.getElementById('schoolAddressInput').value = schoolAddress;

  await loadPerfil();
  await Promise.all([loadDocentes(), loadRecords(), loadCobros(), loadInventarioDatos()]);
  await cargarSolicitudes(false);
  iniciarPollingSolicitudes();

  showToast('Datos cargados correctamente \u2713', 'ok');
  renderAll();
  applyRoleUI();
}

// ---- Adaptar la interfaz segun el rol del usuario logueado ----
// admin / directivo: ven todo, igual que antes.
// docente: solo ve la pestaña "Registrar", con su nombre fijo y bloqueado.
const TABS_OCULTAS_PARA_DOCENTE = ['dashboard', 'registros', 'reportes', 'mensual', 'inventario', 'prestamos', 'config'];

function esDocente(){
  return !!perfil && perfil.rol === 'docente';
}

function esAdmin(){
  return !!perfil && perfil.rol === 'admin';
}

function esDirectivo(){
  return !!perfil && perfil.rol === 'directivo';
}

// El directivo (director/subdirectora) ve TODO el sistema, pero solo
// puede operar (crear/editar/marcar) dentro de "Reporte mensual": ahi
// se administra el cobro, que es su responsabilidad. En el resto de
// pestanas queda en modo solo lectura. Esto es una comodidad de
// interfaz; la proteccion real de los datos la hacen las politicas
// RLS en Supabase (ver supabase_directivo_solo_lectura.sql).
function soloLectura(){
  return esDirectivo();
}

// El directivo (director/subdirector) SI puede agregar docentes/asignaciones
// nuevas desde "Configuracion > Docentes y asignaciones", igual que el
// administrador (aunque siga sin poder editar/eliminar asignaciones
// existentes ni crear registros de copias, que se mantienen solo-lectura).
function puedeGestionarDocentes(){
  return esAdmin() || esDirectivo();
}

function puedeGestionarUsuarios(){
  return esAdmin() || esDirectivo();
}

// Texto legible para cada valor de "rol" guardado en la base de datos.
function nombreRol(rol){
  if(rol === 'admin') return 'Administrador';
  if(rol === 'directivo') return 'Directivo';
  if(rol === 'docente') return 'Docente';
  return rol || '';
}

// Muestra en el header quien tiene la sesion iniciada y con que rol,
// para que nunca quede la duda de con que cuenta se esta trabajando.
function actualizarBadgeUsuario(){
  const badge = document.getElementById('userBadge');
  if(!badge) return;
  if(!perfil){ badge.hidden = true; badge.textContent = ''; return; }
  const nombre = perfil.nombre || (session && session.user && session.user.email) || '';
  badge.textContent = (nombre ? nombre + ' \u00b7 ' : '') + nombreRol(perfil.rol);
  badge.classList.toggle('rol-docente', perfil.rol === 'docente');
  badge.hidden = false;
}

function applyRoleUI(){
  actualizarBadgeUsuario();

  document.querySelectorAll('nav.tabs button').forEach(btn=>{
    btn.hidden = esDocente() && TABS_OCULTAS_PARA_DOCENTE.includes(btn.dataset.tab);
  });

  const docenteInput = document.getElementById('docente');
  const fechaInput = document.getElementById('fecha');
  const fechaHint = document.getElementById('fechaHint');
  const solicitudesTab = document.getElementById('solicitudesTab');
  const solicitudesTabLabel = document.getElementById('solicitudesTabLabel');

  if(esDocente()){
    docenteInput.readOnly = true;
    docenteInput.style.background = '#eee';
    docenteInput.style.cursor = 'not-allowed';

    // El docente solo puede registrar la solicitud con la fecha real del día.
    // El campo queda deshabilitado visualmente y el submit vuelve a imponer
    // la fecha actual para evitar que el usuario la cambie desde el navegador.
    fechaInput.value = todayStr();
    fechaInput.disabled = true;
    fechaInput.title = 'La fecha se establece automáticamente con la fecha de hoy.';
    if(fechaHint) fechaHint.hidden = false;

    if(!perfil.docente_nombre){
      showToast('Tu cuenta no tiene un docente asignado. Avisa al administrador.', 'error');
    }
    resetDocenteFieldForRole();

    // El docente puede consultar únicamente sus propias solicitudes.
    if(solicitudesTab) solicitudesTab.hidden = false;
    if(solicitudesTabLabel) solicitudesTabLabel.textContent = '📋 Mis solicitudes';
    const solicitudesTitle = document.getElementById('solicitudesTitle');
    const solicitudesSubtitle = document.getElementById('solicitudesSubtitle');
    if(solicitudesTitle) solicitudesTitle.textContent = 'Mis solicitudes';
    if(solicitudesSubtitle) solicitudesSubtitle.textContent = 'Consulta el estado de las copias que has solicitado.';
    document.querySelector('[data-tab="registrar"]').click();
  } else {
    docenteInput.readOnly = false;
    docenteInput.style.background = '';
    docenteInput.style.cursor = '';
    fechaInput.disabled = false;
    fechaInput.title = '';
    if(fechaHint) fechaHint.hidden = true;
    if(solicitudesTabLabel) solicitudesTabLabel.textContent = '🔔 Solicitudes';
    const solicitudesTitle = document.getElementById('solicitudesTitle');
    const solicitudesSubtitle = document.getElementById('solicitudesSubtitle');
    if(solicitudesTitle) solicitudesTitle.textContent = 'Solicitudes de copias';
    if(solicitudesSubtitle) solicitudesSubtitle.textContent = 'Solicitudes enviadas por docentes desde celular o tableta.';
  }

  const usuariosTab = document.getElementById('configUsuariosTab');
  if(usuariosTab) usuariosTab.hidden = !puedeGestionarUsuarios();
  if(!puedeGestionarUsuarios() && document.getElementById('config-usuarios')?.classList.contains('active')){
    document.querySelector('[data-subtab="config-respaldo"]')?.click();
  }

  aplicarModoSoloLectura();
}

// Bloquea la creacion/edicion en todas las pestanas EXCEPTO "Reporte
// mensual" para el rol directivo: puede ver todo el sistema, pero la
// unica seccion donde puede guardar cambios es la de cobros (marcar
// pagos, emitir boletas), que es su responsabilidad. Se vuelve a
// llamar en cada render de esas tablas para que las acciones no
// reaparezcan al refrescar la lista.
function aplicarModoSoloLectura(){
  const bloqueado = soloLectura();

  // Formulario "Registrar"
  // El campo "fecha" se excluye de este bucle generico: su estado de
  // bloqueo no depende solo de si el rol es "solo lectura" (directivo),
  // sino tambien de si el usuario es docente (que NUNCA debe poder
  // cambiar la fecha). Si se dejara en el bucle, aqui se volveria a
  // habilitar para el docente (bloqueado=false) justo despues de que
  // applyRoleUI() la hubiera deshabilitado.
  document.getElementById('entryForm').querySelectorAll('input, button[type="submit"]').forEach(el=>{
    if(el.id === 'fecha') return;
    el.disabled = bloqueado;
  });
  const fechaInput = document.getElementById('fecha');
  if(fechaInput) fechaInput.disabled = bloqueado || esDocente();

  let aviso = document.getElementById('avisoSoloLectura');
  if(!aviso){
    aviso = document.createElement('p');
    aviso.id = 'avisoSoloLectura';
    aviso.className = 'hint';
    aviso.style.color = '#a3273c';
    aviso.style.fontWeight = '600';
    aviso.textContent = '\u{1F441}\ufe0f Modo solo lectura: como directivo puedes ver todo el sistema, pero solo puedes registrar cambios en "Reporte mensual" (cobros y boletas).';
    document.getElementById('entryFormTitle').insertAdjacentElement('afterend', aviso);
  }
  aviso.hidden = !bloqueado;

  // Configuracion: precio, datos del colegio, docentes y respaldo
  const priceInput = document.getElementById('priceInput');
  if(priceInput) priceInput.disabled = !esAdmin();
  const schoolNameInput = document.getElementById('schoolNameInput');
  if(schoolNameInput) schoolNameInput.disabled = bloqueado;
  const schoolAddressInput = document.getElementById('schoolAddressInput');
  if(schoolAddressInput) schoolAddressInput.disabled = bloqueado;
  const importJsonInput = document.getElementById('importJsonInput');
  if(importJsonInput) importJsonInput.disabled = bloqueado;
  const docFormCard = document.getElementById('docFormCard');
  if(docFormCard) docFormCard.style.display = puedeGestionarDocentes() ? '' : 'none';

  // Re-pintar tablas que muestran botones de accion, para que se
  // oculten o vuelvan a aparecer segun corresponda.
  if(typeof renderTable === 'function') renderTable();
  if(typeof renderConfig === 'function') renderConfig();
}

// Pone el campo "docente" en su estado correcto segun el rol: fijo con el
// nombre del docente logueado, o vacio y editable para admin/directivo.
// Se usa tanto al cargar la app como cada vez que se limpia el formulario
// (despues de guardar un registro o al cancelar una edicion).
function resetDocenteFieldForRole(){
  const docenteInput = document.getElementById('docente');
  if(esDocente() && perfil.docente_nombre){
    docenteInput.value = perfil.docente_nombre;
    populateAreas(perfil.docente_nombre);
  } else {
    docenteInput.value = '';
    populateAreas('');
  }
}

// docentesRows: todas las filas con { id, nombre, area, grado, seccion, tipo, activo }
let docentesRows = [];

async function loadDocentes(){
  try{
    // Traer todos (activos e inactivos) para la tabla de configuracion
    const data = await sbFetch('docentes?select=id,nombre,area,grado,seccion,tipo,activo&order=nombre.asc');
    docentesRows = data;

    // Solo activos para el autocompletado del formulario de registro
    const activos = data.filter(r => r.activo !== false);
    docentes = [...new Set(activos.map(r => r.nombre))];
    DIRECTORIO = {};
    activos.forEach(r => {
      if(!DIRECTORIO[r.nombre]) DIRECTORIO[r.nombre] = {};
      if(!DIRECTORIO[r.nombre][r.area]) DIRECTORIO[r.nombre][r.area] = [];
      DIRECTORIO[r.nombre][r.area].push(r.grado + ' ' + r.seccion);
    });
    secciones = [...new Map(activos.map(r => [r.grado+'|'+r.seccion, {grado:r.grado, seccion:r.seccion}])).values()]
      .sort((a,b)=> a.grado.localeCompare(b.grado,'es',{numeric:true}) || a.seccion.localeCompare(b.seccion));
  }catch(e){
    console.error('Error cargando docentes:', e);
    showToast('Error al cargar docentes de Supabase.', 'error');
    docentes = []; docentesRows = []; DIRECTORIO = {}; secciones = [];
  }
}


// Tabs
document.querySelectorAll('nav.tabs button').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('nav.tabs button').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('section.panel').forEach(p=>p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('panel-'+btn.dataset.tab).classList.add('active');
    if(btn.dataset.tab === 'dashboard') renderDashboard();
    if(btn.dataset.tab === 'solicitudes') renderSolicitudes();
    if(btn.dataset.tab === 'reportes') renderReportes();
    if(btn.dataset.tab === 'registros') renderTable();
    if(btn.dataset.tab === 'inventario') renderInventario();
    if(btn.dataset.tab === 'prestamos') renderPrestamos();
    if(btn.dataset.tab === 'mensual'){ renderMensual(); renderCobros(); }
    if(btn.dataset.tab === 'config'){ renderConfig(); if(puedeGestionarUsuarios()) cargarUsuarios(); }
  });
});

// Sub-pestañas dentro de un panel (Ranking, Reporte mensual, Configuración)
document.querySelectorAll('nav.subtabs button').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const nav = btn.closest('nav.subtabs');
    const panel = btn.closest('section.panel');
    nav.querySelectorAll('button').forEach(b=>b.classList.remove('active'));
    panel.querySelectorAll(':scope > .subpanel').forEach(p=>p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.subtab).classList.add('active');
  });
});
