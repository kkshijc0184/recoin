// ---- Historial de cobros ----
async function marcarCobro(btn, ym, secKey, pagado, monto, fecha){
  if(btn) btn.disabled = true;
  showToast('Guardando cobro\u2026', 'ok');
  if(pagado){
    const ok = await upsertCobro(ym, secKey, true, monto, fecha);
    if(!ok){ if(btn) btn.disabled = false; return; }
    cobros[ym+':'+secKey] = { pagado:true, monto: parseFloat(monto)||0, fecha };
  } else {
    const ok = await deleteCobro(ym, secKey);
    if(!ok){ if(btn) btn.disabled = false; return; }
    delete cobros[ym+':'+secKey];
  }
  showToast('\u2713 Cobro actualizado', 'ok');
  renderCobros();
}

function renderCobros(){
  const ym = document.getElementById('monthPicker').value || todayStr().slice(0,7);
  const monthRecords = records.filter(r=>(r.fecha||'').slice(0,7)===ym);

  // Construir mapa grado|seccion -> { caras, debe }. La deuda se acumula
  // registro por registro con SU precio congelado (precioDeRegistro), no
  // con el precio global actual, para que cuadre con lo que ya se cobro.
  const totalsMap = {};
  secciones.forEach(s=>{ totalsMap[`${s.grado} ${s.seccion}`] = { caras:0, debe:0 }; });
  monthRecords.forEach(r=>{
    const k = `${r.grado} ${r.seccion}`.trim();
    if(!(k in totalsMap)) totalsMap[k] = { caras:0, debe:0 };
    totalsMap[k].caras += r.totalCaras;
    totalsMap[k].debe += r.totalCaras * precioDeRegistro(r);
  });

  const filas = Object.entries(totalsMap)
    .filter(([,v])=> v.caras > 0)
    .sort(([a],[b])=> a.localeCompare(b,'es',{numeric:true}));

  const resWrap = document.getElementById('cobrosResumen');
  const tabWrap = document.getElementById('cobrosTabla');

  if(filas.length === 0){
    resWrap.innerHTML = '';
    tabWrap.innerHTML = '<div class="empty">Sin registros de copias en este mes.</div>';
    return;
  }

  let totalDebe = 0, totalPagado = 0, countPagado = 0, countPendiente = 0;
  filas.forEach(([k, v])=>{
    const debe = v.debe;
    const cobro = cobros[ym+':'+k];
    if(cobro && cobro.pagado){ totalPagado += cobro.monto || debe; countPagado++; }
    else { totalDebe += debe; countPendiente++; }
  });

  resWrap.innerHTML = `
    <div class="cobros-resumen">
      <div class="cobro-stat pagado">
        <div class="n">${countPagado}</div>
        <div class="l">Secciones pagadas</div>
      </div>
      <div class="cobro-stat pendiente">
        <div class="n">${countPendiente}</div>
        <div class="l">Por cobrar</div>
      </div>
      <div class="cobro-stat pagado">
        <div class="n">S/${totalPagado.toFixed(2)}</div>
        <div class="l">Recaudado</div>
      </div>
      <div class="cobro-stat pendiente">
        <div class="n">S/${totalDebe.toFixed(2)}</div>
        <div class="l">Pendiente</div>
      </div>
    </div>`;

  const rows = filas.map(([k, v], i)=>{
    const caras = v.caras;
    const debe = v.debe;
    const cobro = cobros[ym+':'+k];
    const pagado = cobro && cobro.pagado;
    const montoGuardado = pagado ? cobro.monto : debe;
    const fechaGuardada = pagado ? cobro.fecha : '';
    // ids seguros basados en el indice de fila (nunca contienen datos del usuario)
    const fechaId = `fecha_${i}`;
    const montoId = `monto_${i}`;
    const onclickRevertir = jsCallWithThis('marcarCobro', ym, k, false, 0, '');
    const onclickCobrado = escapeHtml(
      `const m=document.getElementById('${montoId}').value;` +
      `const f=document.getElementById('${fechaId}').value;` +
      `marcarCobro(this,${JSON.stringify(ym)},${JSON.stringify(k)},true,m,f)`
    );
    return `
      <tr class="${pagado ? 'fila-pagado' : 'fila-pendiente'}">
        <td>${escapeHtml(k)}</td>
        <td class="num">${caras}</td>
        <td class="num">S/${debe.toFixed(2)}</td>
        <td><input class="cobro-fecha-input" type="date" id="${fechaId}" value="${escapeHtml(fechaGuardada)}"></td>
        <td><input class="cobro-monto-input" type="number" step="0.10" id="${montoId}" value="${montoGuardado.toFixed(2)}"></td>
        <td><span class="badge ${pagado?'pagado':'pendiente'}">${pagado?'\u2713 Pagado':'Pendiente'}</span></td>
        <td>
          ${pagado
            ? `<div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:center;">
                 <button class="btn-descobrar" onclick="${onclickRevertir}">Revertir</button>
                 <button class="btn-boleta" onclick="${jsCallWithThis('generarBoleta', k, debe, cobro, ym)}" title="Generar boleta PDF">&#128203; Boleta</button>
               </div>`
            : `<button class="btn-cobrar" onclick="${onclickCobrado}">\u2713 Cobrado</button>`
          }
        </td>
      </tr>`;
  }).join('');

  tabWrap.innerHTML = `
    <table class="cobros-table">
      <thead>
        <tr>
          <th>Grado/Secci&#243;n</th>
          <th class="num">Caras</th>
          <th class="num">Debe</th>
          <th>Fecha de pago</th>
          <th>Monto pagado</th>
          <th>Estado</th>
          <th>Acci&#243;n</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

