// ---- Préstamos de recursos tecnológicos ----
// admin: registra, devuelve y anula. directivo: solo consulta.

let pagPre = 1;
let carrito = [];   // [{ bien_id, cantidad }]

function prEl(id){ return document.getElementById(id); }
function enCarrito(id){ const c = carrito.find(x => x.bien_id === id); return c ? c.cantidad : 0; }
function disponiblesDe(b){ return unidadesBien(b) - (prestadasMap[b.id] || 0) - enCarrito(b.id); }

function bienPorEntrada(texto){
  const codigo = String(texto || '').split(' · ')[0].trim().toUpperCase();
  return bienes.find(b => b.id.toUpperCase() === codigo);
}

function nombreBien(id){
  const b = bienes.find(x => x.id === id);
  return b ? b.denominacion : id;
}

function poblarListaBienes(){
  const dl = prEl('prBienesList');
  if(!dl) return;
  dl.innerHTML = bienes
    .filter(b => !b.baja && disponiblesDe(b) > 0)
    .map(b => {
      const extra = [b.marca, b.modelo].filter(Boolean).join(' ');
      const det = b.cantidad ? `${disponiblesDe(b)} disp.` : (b.serie || '');
      return `<option value="${escapeHtml(`${b.id} · ${b.denominacion}${extra ? ' ' + extra : ''}${det ? ' (' + det + ')' : ''}`)}"></option>`;
    }).join('');
}

function poblarDocentesPrestamo(){
  const sel = prEl('prDocente');
  if(!sel) return;
  const actual = sel.value;
  sel.innerHTML = '<option value="">Elige un docente…</option>' +
    docentes.map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join('');
  if(actual) sel.value = actual;
}

function renderCarrito(){
  const box = prEl('prCarrito');
  if(!box) return;
  box.innerHTML = carrito.length
    ? carrito.map((c, i) => {
        const b = bienes.find(x => x.id === c.bien_id);
        const txt = escapeHtml(nombreBien(c.bien_id)) + (b && b.cantidad ? ' × ' + c.cantidad : ' <span class="inv-code">' + escapeHtml(c.bien_id) + '</span>');
        return `<span class="pr-chip">${txt}<button type="button" onclick="${jsCall('quitarDelCarrito', i)}" aria-label="Quitar de la lista">×</button></span>`;
      }).join('')
    : '<span class="hint">Aún no agregaste bienes a esta lista.</span>';
}

function quitarDelCarrito(i){
  carrito.splice(i, 1);
  renderCarrito();
  poblarListaBienes();
}

function agregarAlCarrito(){
  const input = prEl('prBien');
  const b = bienPorEntrada(input.value);
  if(!b){ showToast('Elige un bien de la lista.', 'error'); return; }
  const disp = disponiblesDe(b);
  if(disp <= 0){ showToast('Ese bien no tiene unidades disponibles.', 'error'); return; }
  const q = b.cantidad ? Math.max(1, parseInt(prEl('prCant').value, 10) || 1) : 1;
  if(q > disp){ showToast(`Solo quedan ${disp} disponibles de ${b.denominacion}.`, 'error'); return; }
  const ya = carrito.find(c => c.bien_id === b.id);
  if(ya) ya.cantidad += q; else carrito.push({ bien_id: b.id, cantidad: q });
  input.value = ''; prEl('prCant').value = 1; prEl('prCant').disabled = true;
  renderCarrito();
  poblarListaBienes();
  input.focus();
}

async function registrarPrestamoUI(){
  if(!esAdmin()) return;
  const docente = prEl('prDocente').value;
  if(!carrito.length){ showToast('Agrega al menos un bien a la lista.', 'error'); return; }
  if(!docente){ showToast('Elige el docente que recibe el préstamo.', 'error'); return; }
  const btn = prEl('prRegistrarBtn');
  btn.disabled = true;
  const ok = await registrarPrestamoDB(docente, prEl('prAula').value.trim(), prEl('prHora').value, prEl('prObs').value.trim(), carrito);
  btn.disabled = false;
  if(!ok) return;
  carrito = [];
  prEl('prAula').value = ''; prEl('prHora').value = ''; prEl('prObs').value = '';
  await loadPrestamos();
  renderInventario();
  renderPrestamos();
  showToast('Préstamo registrado ✓', 'ok');
}

async function devolverPrestamoUI(id){
  if(!esAdmin()) return;
  if(await devolverPrestamoDB(id)){
    await loadPrestamos();
    renderInventario(); renderPrestamos();
    showToast('Devolución registrada ✓', 'ok');
  }
}

async function anularPrestamoUI(id){
  if(!esAdmin()) return;
  const r = await Swal.fire({
    title: '¿Anular este préstamo?',
    text: 'Úsalo solo si se registró por error. Los bienes quedarán disponibles y el movimiento queda en el historial.',
    icon: 'warning', showCancelButton: true, confirmButtonText: 'Sí, anular', cancelButtonText: 'Cancelar'
  });
  if(!r.isConfirmed) return;
  if(await anularPrestamoDB(id)){
    await loadPrestamos();
    renderInventario(); renderPrestamos();
    showToast('Préstamo anulado', 'ok');
  }
}

function estadoPrestamo(p){
  if(p.estado === 'devuelto') return ['Devuelto', 'entregada'];
  if(p.estado === 'anulado') return ['Anulado', 'cancelada'];
  return (p.fecha < todayStr()) ? ['Sin devolver', 'cancelada'] : ['Prestado', 'pendiente'];
}

function itemsTexto(p){
  return (p.prestamo_items || []).map(i => {
    const b = bienes.find(x => x.id === i.bien_id);
    return escapeHtml(nombreBien(i.bien_id)) + (b && b.cantidad ? ' × ' + i.cantidad : ' <span class="inv-code">' + escapeHtml(i.bien_id) + '</span>');
  }).join('<br>');
}

function renderPrestamos(){
  const wrap = prEl('prTableWrap');
  if(!wrap) return;
  const editar = esAdmin();
  calcularPrestadas();

  prEl('prFormCard').hidden = !editar;
  prEl('prAvisoLectura').hidden = editar;
  if(editar){ poblarDocentesPrestamo(); poblarListaBienes(); renderCarrito(); }

  const hoy = todayStr();
  const pend = prestamos.filter(p => p.estado === 'prestado');
  const atrasados = pend.filter(p => p.fecha < hoy);
  prEl('prStats').innerHTML =
    statCard('Por devolver', pend.length, '⏳', 'amber', pend.length ? 'Préstamos abiertos' : 'Todo devuelto') +
    statCard('De días anteriores', atrasados.length, '⚠️', 'red', atrasados.length ? 'Sin devolver' : 'Ninguno pendiente') +
    statCard('Devueltos', prestamos.filter(p => p.estado === 'devuelto').length, '✓', 'green', 'En el historial');

  prEl('prAlerta').innerHTML = atrasados.length
    ? `<div class="pr-alerta">⚠️ <b>${atrasados.length}</b> préstamo(s) de días anteriores siguen sin devolverse: ${
        atrasados.slice(0, 5).map(p => escapeHtml(p.docente) + ' (' + (p.prestamo_items || []).map(i => escapeHtml(nombreBien(i.bien_id))).join(', ') + ', ' + formatoFecha(p.fecha) + ')').join(' · ')
      }${atrasados.length > 5 ? ' …' : ''}</div>` : '';

  const estado = prEl('prEstado').value;
  const palabras = (prEl('prBuscar').value || '').toLowerCase().trim().split(/\s+/).filter(Boolean);
  const lista = prestamos.filter(p => {
    if(estado && p.estado !== estado) return false;
    if(!palabras.length) return true;
    const t = [p.docente, p.aula, p.observacion, ...(p.prestamo_items || []).map(i => i.bien_id + ' ' + nombreBien(i.bien_id))].join(' ').toLowerCase();
    return palabras.every(w => t.includes(w));
  });

  if(!lista.length){
    wrap.innerHTML = '<div class="empty">No hay préstamos para mostrar.</div>';
    prEl('pagNavPre').innerHTML = ''; prEl('pagInfoPre').textContent = '';
    return;
  }

  const ps = parseInt(prEl('pagSizePre').value, 10) || 10;
  const totalPaginas = Math.max(1, Math.ceil(lista.length / ps));
  pagPre = Math.min(Math.max(pagPre, 1), totalPaginas);
  const inicio = (pagPre - 1) * ps;
  const vis = ps >= 9999 ? lista : lista.slice(inicio, inicio + ps);
  prEl('pagInfoPre').textContent = ps >= 9999 ? `${lista.length} préstamos` : `${inicio + 1}–${inicio + vis.length} de ${lista.length}`;

  wrap.innerHTML = `<div class="inv-scroll"><table>
    <thead><tr><th>Fecha / hora</th><th>Bienes</th><th>Docente / aula</th><th>Estado</th><th></th></tr></thead>
    <tbody>${vis.map(p => {
      const [txt, cls] = estadoPrestamo(p);
      const acc = (editar && p.estado === 'prestado')
        ? `<button class="btn small" onclick="${jsCallWithThis('devolverPrestamoBtn', p.id)}">Marcar devuelto</button>
           <button class="btn small danger" onclick="${jsCall('anularPrestamoUI', p.id)}">Anular</button>` : '';
      return `<tr>
        <td>${formatoFecha(p.fecha)}<br><small class="inv-nota">${escapeHtml(p.hora_salida || '')}${p.hora_devolucion ? ' – ' + escapeHtml(p.hora_devolucion) : ''}</small></td>
        <td>${itemsTexto(p)}${p.observacion ? `<br><small class="inv-nota">${escapeHtml(p.observacion)}</small>` : ''}</td>
        <td>${escapeHtml(p.docente)}${p.aula ? `<br><small class="inv-nota">${escapeHtml(p.aula)}</small>` : ''}</td>
        <td><span class="request-status ${cls}">${txt}</span></td>
        <td class="inv-acciones">${acc}</td></tr>`;
    }).join('')}</tbody></table></div>`;
  buildPagNav('pagNavPre', totalPaginas, pagPre, (p)=>{ pagPre = p; renderPrestamos(); });
}

async function devolverPrestamoBtn(btn, id){
  btn.disabled = true;
  await devolverPrestamoUI(id);
  btn.disabled = false;
}

// ---------- Eventos ----------
prEl('prBien')?.addEventListener('input', (e) => {
  const b = bienPorEntrada(e.target.value);
  const cant = prEl('prCant');
  cant.disabled = !(b && b.cantidad);
  if(cant.disabled) cant.value = 1;
});
prEl('prAddBtn')?.addEventListener('click', agregarAlCarrito);
prEl('prRegistrarBtn')?.addEventListener('click', registrarPrestamoUI);
prEl('prBuscar')?.addEventListener('input', () => { pagPre = 1; renderPrestamos(); });
['prEstado', 'pagSizePre'].forEach(id => prEl(id)?.addEventListener('change', () => { pagPre = 1; renderPrestamos(); }));
