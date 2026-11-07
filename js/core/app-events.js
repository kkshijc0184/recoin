document.getElementById('schoolNameInput').addEventListener('change', async (e)=>{
  schoolName = e.target.value.trim();
  await saveSchoolName();
});
document.getElementById('schoolAddressInput').addEventListener('change', async (e)=>{
  schoolAddress = e.target.value.trim();
  await saveSchoolAddress();
});
document.getElementById('pagSizeCfg').addEventListener('change', ()=>{ pagCfg=1; renderConfig(); });
document.getElementById('pagSizeUsr').addEventListener('change', ()=>{ pagUsr=1; renderUsuarios(); });
document.getElementById('saveNewDocBtn').addEventListener('click', guardarDocente);
document.getElementById('cancelDocEditBtn').addEventListener('click', docFormReset);

document.getElementById('addDocenteBtn').addEventListener('click', async (e)=>{
  const btn = e.currentTarget;
  if(btn.disabled) return;
  const orig = btn.textContent;
  btn.disabled = true; btn.textContent = 'Recargando\u2026';
  try{
    showToast('Recargando docentes\u2026', 'ok');
    await loadDocentes();
    docFormReset();
    renderConfig(); renderAll();
    showToast('\u2713 Docentes actualizados', 'ok');
  } finally { btn.disabled=false; btn.textContent=orig; }
});

function renderAll(){
  populateDocentesList();
  populateAreas('');        // deshabilita area
  populateGradoSeccion('',''); // deshabilita seccion
  renderTable();
  renderReportes();
  renderMensual();
  renderCobros();
  renderDashboard();
  if(typeof renderInventario === 'function' && !esDocente()){ renderInventario(); renderPrestamos(); }
  updateCalc();
}

// ---- Eventos de respaldo ----
document.getElementById('exportExcelBtn')?.addEventListener('click', exportExcel);
document.getElementById('exportJsonBtn')?.addEventListener('click', exportJson);
document.getElementById('createUserBtn')?.addEventListener('click', crearUsuario);
document.getElementById('reloadUsersBtn')?.addEventListener('click', cargarUsuarios);
document.getElementById('newUserRol')?.addEventListener('change', renderUserRoleOptions);
document.getElementById('generateTempPasswordBtn')?.addEventListener('click', ()=>{ const input=document.getElementById('newUserPassword'); if(input){ input.value=generarPasswordTemporal(); input.type='text'; setTimeout(()=>{input.type='password';},2500); } });

document.getElementById('importJsonInput')?.addEventListener('change', async (e)=>{
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

function todayStr(){
  const d=new Date();
  const y=d.getFullYear();
  const m=String(d.getMonth()+1).padStart(2,'0');
  const day=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}

document.getElementById('logoutBtn')?.addEventListener('click', async ()=>{
  await signOut();
  records = []; docentes = []; areas = []; secciones = []; cobros = {}; DIRECTORIO = {}; perfil = null;
  window.location.replace('login.html');
});

async function init(){
  const restored = await restoreSession();

  if(!restored){
    window.location.replace('login.html');
    return;
  }

  await cargarEstadoCambioPassword();
  if(necesitaCambiarPassword()){ window.location.replace('cambiar-password.html'); return; }

  const appRoot = document.getElementById('appRoot');
  if(appRoot) appRoot.hidden = false;

  await loadData();
}
