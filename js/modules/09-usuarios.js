// ============================================================
// GESTIÓN DE USUARIOS Y ROLES
// ============================================================
let usuariosRows = [];

function renderUserRoleOptions(){
  const rol = document.getElementById('newUserRol');
  const docenteWrap = document.getElementById('newUserDocenteWrap');
  const docenteSelect = document.getElementById('newUserDocente');
  const note = document.getElementById('userRoleNote');
  if(!rol) return;

  const adminOption = rol.querySelector('option[value="admin"]');
  if(adminOption) adminOption.hidden = !esAdmin();
  if(!esAdmin() && rol.value === 'admin') rol.value = 'docente';

  const esDoc = rol.value === 'docente';
  if(docenteWrap) docenteWrap.hidden = !esDoc;
  if(docenteSelect && esDoc){
    const actual = docenteSelect.value;
    docenteSelect.innerHTML = '<option value="">Selecciona el docente</option>' +
      docentes.map(n=>`<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join('');
    if(actual && docentes.includes(actual)) docenteSelect.value = actual;
  }
  if(note){
    note.textContent = esAdmin()
      ? 'Como administrador puedes crear docentes, directivos y administradores.'
      : 'Como directivo puedes crear docentes y otros directivos, pero no administradores.';
  }
}

function nombreRolUsuario(rol){
  if(rol === 'admin') return 'Administrador';
  if(rol === 'directivo') return 'Directivo';
  return 'Docente';
}

function renderUsuarios(){
  if(!puedeGestionarUsuarios()) return;
  renderUserRoleOptions();
  const wrap = document.getElementById('usuariosTableWrap');
  if(!wrap) return;
  if(!usuariosRows.length){
    wrap.innerHTML = '<div class="empty">No hay usuarios para mostrar.</div>';
    document.getElementById('pagNavUsr').innerHTML = '';
    document.getElementById('pagInfoUsr').textContent = '';
    return;
  }

  const ps = parseInt(document.getElementById('pagSizeUsr').value);
  const totalPages = Math.max(1, Math.ceil(usuariosRows.length / ps));
  pagUsr = Math.min(pagUsr, totalPages);
  const start = (pagUsr - 1) * ps;
  const pagRows = ps >= 9999 ? usuariosRows : usuariosRows.slice(start, start + ps);

  document.getElementById('pagInfoUsr').textContent =
    ps >= 9999 ? `${usuariosRows.length} usuarios` : `${start+1}\u2013${Math.min(start+ps, usuariosRows.length)} de ${usuariosRows.length}`;

  wrap.innerHTML = `<div style="overflow:auto;"><table class="mini-table"><thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Docente asignado</th><th>Acciones</th></tr></thead><tbody>${
    pagRows.map(u=>{
      const esPropio = session?.user?.id === u.id;
      const puedeEditar = puedeGestionarUsuarios() && !esPropio && !(u.rol === 'admin' && !esAdmin());
      const puedeRestablecer = esAdmin() && !esPropio;
      const acciones = [];
      if(puedeEditar) acciones.push(`<button class="btn-user-role" onclick="cambiarRolUsuario('${u.id}')">Cambiar rol</button>`);
      if(puedeRestablecer) acciones.push(`<button class="btn secondary small" onclick="restablecerPasswordUsuario('${u.id}')">🔑 Restablecer</button>`);
      return `<tr><td>${escapeHtml(u.nombre || '')}${esPropio ? ' <span class="hint">(tú)</span>' : ''}</td><td>${escapeHtml(u.email || '')}</td><td><span class="role-badge ${escapeHtml(u.rol)}">${escapeHtml(nombreRolUsuario(u.rol))}</span></td><td>${escapeHtml(u.docente_nombre || '—')}</td><td class="user-actions">${acciones.join(' ') || '—'}</td></tr>`;
    }).join('')} </tbody></table></div>`;

  buildPagNav('pagNavUsr', totalPages, pagUsr, (p)=>{ pagUsr=p; renderUsuarios(); });
}

async function cargarUsuarios(){
  if(!puedeGestionarUsuarios()) return;
  try{
    const data = await gestionarUsuarios({action:'list'});
    usuariosRows = Array.isArray(data.users) ? data.users : [];
    renderUsuarios();
  }catch(e){
    console.error('Error cargando usuarios:', e);
    showToast(e.message || 'No se pudieron cargar los usuarios.', 'error');
  }
}

function generarPasswordTemporal(longitud = 10){
  const caracteres = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  const valores = new Uint32Array(longitud);
  crypto.getRandomValues(valores);
  return Array.from(valores, n => caracteres[n % caracteres.length]).join('');
}

async function crearUsuario(){
  if(!puedeGestionarUsuarios()) return;
  const nombre = document.getElementById('newUserNombre').value.trim();
  const email = document.getElementById('newUserEmail').value.trim().toLowerCase();
  let password = document.getElementById('newUserPassword').value.trim();
  if(!password){
    password = generarPasswordTemporal(12);
    document.getElementById('newUserPassword').value = password;
  }
  const rol = document.getElementById('newUserRol').value;
  const docenteNombre = document.getElementById('newUserDocente').value;
  const enviarCorreo = document.getElementById('sendCredentialsEmail')?.checked !== false;

  if(!nombre || !email || !password){ showToast('Completa nombre, correo y contraseña temporal.', 'error'); return; }
  if(password.length < 6){ showToast('La contraseña temporal debe tener al menos 6 caracteres.', 'error'); return; }
  if(rol === 'docente' && !docenteNombre){ showToast('Selecciona el docente que usará esta cuenta.', 'error'); return; }
  if(rol === 'admin' && !esAdmin()){ showToast('Solo el administrador puede crear administradores.', 'error'); return; }

  const btn = document.getElementById('createUserBtn'); btn.disabled = true;
  try{
    showToast('Creando usuario…', 'ok');
    const data = await gestionarUsuarios({action:'create', nombre, email, password, rol, docente_nombre: rol === 'docente' ? docenteNombre : null, send_email: enviarCorreo});
    document.getElementById('newUserNombre').value = ''; document.getElementById('newUserEmail').value = ''; document.getElementById('newUserPassword').value = ''; document.getElementById('newUserDocente').value = '';
    await cargarUsuarios();
    if(data.email_sent === false){
      await Swal.fire({
        title:'Usuario creado',
        html:`La cuenta quedó creada y marcada para <b>cambiar la contraseña en el primer ingreso</b>.<br><br><b>Contraseña temporal:</b><br><code>${escapeHtml(data.temporary_password || password)}</code>`,
        icon:'success',
        confirmButtonText:'Entendido'
      });
    }else if(enviarCorreo){
      showToast('✓ Usuario creado y credenciales enviadas.', 'ok');
    }else{
      await Swal.fire({
        title:'Usuario creado',
        html:`La cuenta quedó creada y marcada para <b>cambiar la contraseña en el primer ingreso</b>.<br><br><b>Contraseña temporal:</b><br><code>${escapeHtml(data.temporary_password || password)}</code>`,
        icon:'success',
        confirmButtonText:'Entendido'
      });
    }
  }catch(e){ console.error(e); showToast(e.message || 'No se pudo crear el usuario.', 'error'); }
  finally{ btn.disabled = false; }
}

async function restablecerPasswordUsuario(id){
  if(!esAdmin()){ showToast('Solo el administrador puede restablecer contraseñas.', 'error'); return; }
  const usuario = usuariosRows.find(u=>u.id===id); if(!usuario || id===session?.user?.id) return;
  const result = await Swal.fire({title:'¿Restablecer contraseña?',html:`Se generará una nueva contraseña temporal para <b>${escapeHtml(usuario.email || usuario.nombre || '')}</b>.<br><br>El usuario deberá cambiarla al iniciar sesión.`,icon:'warning',showCancelButton:true,confirmButtonText:'Sí, restablecer',cancelButtonText:'Cancelar'});
  if(!result.isConfirmed) return;
  try{
    const data=await gestionarUsuarios({action:'reset_password',id,send_email:true});
    if(data.email_sent===false){ await Swal.fire({title:'Contraseña restablecida',html:`No se pudo enviar el correo automáticamente.<br><br><b>Contraseña temporal:</b><br><code>${escapeHtml(data.temporary_password || '')}</code>`,icon:'warning',confirmButtonText:'Entendido'}); }
    else showToast('✓ Contraseña restablecida y enviada por correo.','ok');
  }catch(e){ console.error(e); showToast(e.message || 'No se pudo restablecer la contraseña.','error'); }
}

async function cambiarRolUsuario(id){
  const usuario = usuariosRows.find(u=>u.id===id);
  if(!usuario || id === session?.user?.id) return;
  const rolesPermitidos = esAdmin() ? ['docente','directivo','admin'] : ['docente','directivo'];
  const options = Object.fromEntries(rolesPermitidos.map(r=>[r,nombreRolUsuario(r)]));
  const result = await Swal.fire({
    title:'Cambiar rol',
    html:`Cuenta: <b>${escapeHtml(usuario.email || usuario.nombre || '')}</b>`,
    input:'select', inputOptions:options, inputValue:usuario.rol,
    showCancelButton:true, confirmButtonText:'Guardar', cancelButtonText:'Cancelar'
  });
  if(!result.isConfirmed || !result.value || result.value === usuario.rol) return;
  let docenteNombre = null;
  if(result.value === 'docente'){
    const r2 = await Swal.fire({
      title:'Docente asignado', input:'select',
      inputOptions:Object.fromEntries(docentes.map(n=>[n,n])),
      inputPlaceholder:'Selecciona el docente', showCancelButton:true, confirmButtonText:'Guardar', cancelButtonText:'Cancelar', inputValidator:v=>v?'': 'Selecciona un docente.'
    });
    if(!r2.isConfirmed) return;
    docenteNombre = r2.value;
  }
  try{
    await gestionarUsuarios({action:'update_role', id, rol:result.value, docente_nombre:docenteNombre});
    await cargarUsuarios();
    showToast('✓ Rol actualizado.', 'ok');
  }catch(e){
    console.error(e);
    showToast(e.message || 'No se pudo actualizar el rol.', 'error');
  }
}

async function toggleActivoDocente(id, estaActivo){
  if(soloLectura()){ showToast('Tu rol solo permite ver las asignaciones.', 'error'); return; }
  const accion = estaActivo ? 'desactivar' : 'activar';
  const fila = docentesRows.find(r => r.id === id);
  const nombre = fila ? fila.nombre : '';

  // Si es Nombrado y se intenta desactivar, advertir
  if(estaActivo && fila && (fila.tipo||'Contratado') === 'Nombrado'){
    const result = await Swal.fire({
      title: '\u00bfDesactivar docente nombrado?',
      html: `<b>${escapeHtml(nombre)}</b> es un docente <b>Nombrado</b>.<br>Los nombrados raramente cambian de I.E. \u00bfEst\u00e1s seguro?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'S\u00ed, desactivar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#a3273c'
    });
    if(!result.isConfirmed) return;
  }

  showToast((estaActivo ? 'Desactivando' : 'Activando') + '\u2026', 'ok');
  const ok = await toggleActivoDocenteDB(id, !estaActivo);
  if(!ok) return;

  // Actualizar localmente sin recargar todo
  const row = docentesRows.find(r => r.id === id);
  if(row) row.activo = !estaActivo;

  await loadDocentes();
  renderConfig();
  populateDocentesList();
    if(typeof renderUserRoleOptions === 'function') renderUserRoleOptions();
  showToast(`\u2713 ${nombre} ${!estaActivo ? 'activado' : 'desactivado'}`, 'ok');
}

async function eliminarAsignacion(id, nombre){
  if(soloLectura()){ showToast('Tu rol solo permite ver las asignaciones.', 'error'); return; }
  const result = await Swal.fire({
    title: '\u00bfEliminar asignaci\u00f3n?',
    html: `Se eliminar\u00e1 permanentemente la asignaci\u00f3n de <b>${escapeHtml(nombre)}</b>.<br><small>Si fue un error, puedes volver a ingresarla.</small>`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'S\u00ed, eliminar',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#a3273c'
  });
  if(!result.isConfirmed) return;
  if(editingDocId === id) docFormReset();
  showToast('Eliminando\u2026', 'ok');
  const ok = await deleteDocenteRow(id);
  if(!ok) return;
  await loadDocentes();
  renderConfig();
  populateDocentesList();
  showToast('\u2713 Asignaci\u00f3n eliminada', 'ok');
}

async function guardarDocente(){
  if(!puedeGestionarDocentes()){ showToast('Tu rol no permite agregar asignaciones.', 'error'); return; }
  const nombre  = document.getElementById('newDocNombre').value.trim();
  const area    = document.getElementById('newDocArea').value.trim();
  const grado   = document.getElementById('newDocGrado').value.trim();
  const seccion = document.getElementById('newDocSeccion').value.trim();
  const tipo    = document.getElementById('newDocTipo').value;

  if(!nombre || !area || !grado || !seccion){
    showToast('Completa todos los campos antes de guardar.', 'error');
    return;
  }
  const existe = docentesRows.some(r =>
    r.id !== editingDocId &&
    r.nombre.toLowerCase() === nombre.toLowerCase() &&
    r.area.toLowerCase()   === area.toLowerCase() &&
    r.grado === grado && r.seccion === seccion
  );
  if(existe){
    showToast('Ya existe esa asignaci\u00f3n exacta.', 'error');
    return;
  }

  let ok = false;
  if(editingDocId !== null){
    showToast('Actualizando\u2026', 'ok');
    ok = await updateDocente(editingDocId, nombre, area, grado, seccion, tipo);
    if(ok) showToast('\u2713 Asignaci\u00f3n actualizada', 'ok');
  } else {
    showToast('Guardando\u2026', 'ok');
    ok = await insertDocente(nombre, area, grado, seccion, tipo);
    if(ok) showToast('\u2713 Asignaci\u00f3n guardada', 'ok');
  }
  if(!ok) return;
  docFormReset();
  await loadDocentes();
  renderConfig();
  populateDocentesList();
}


