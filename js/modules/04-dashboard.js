// ---- Dashboard / resumen operativo ----
function renderDashboard(){
  // El dashboard es informativo y no modifica ningun dato existente.
  // Usa exactamente la misma fuente de registros y cobros que los reportes.
  const ym = (document.getElementById('monthPicker')?.value || todayStr().slice(0,7));
  const monthRecords = records.filter(r => (r.fecha || '').slice(0,7) === ym);

  let totalJuegos = 0;
  let totalCaras = 0;
  let totalCobrar = 0;
  const docentesMes = new Set();
  const seccionMap = {};

  monthRecords.forEach(r => {
    const juegos = Number(r.copias) || 0;
    const caras = Number(r.totalCaras) || 0;
    const costo = caras * precioDeRegistro(r);
    const key = `${r.grado} ${r.seccion}`.trim();

    totalJuegos += juegos;
    totalCaras += caras;
    totalCobrar += costo;
    if(r.docente) docentesMes.add(r.docente);

    if(!seccionMap[key]){
      seccionMap[key] = {
        grado: r.grado || '',
        seccion: r.seccion || '',
        juegos: 0,
        caras: 0,
        costo: 0
      };
    }
    seccionMap[key].juegos += juegos;
    seccionMap[key].caras += caras;
    seccionMap[key].costo += costo;
  });

  let cobrado = 0;
  let seccionesPagadas = 0;
  let seccionesPendientes = 0;

  Object.entries(seccionMap).forEach(([key, info]) => {
    const cobro = cobros[ym + ':' + key];
    if(cobro && cobro.pagado){
      cobrado += Number(cobro.monto) || info.costo;
      seccionesPagadas++;
    }else{
      seccionesPendientes++;
    }
  });

  // Si existe un cobro registrado por un monto menor al total, mostramos
  // la diferencia como saldo pendiente, sin alterar el estado guardado.
  const saldoPendiente = Math.max(totalCobrar - cobrado, 0);
  const porcentaje = totalCobrar > 0 ? Math.min((cobrado / totalCobrar) * 100, 100) : 0;

  const setText = (id, value) => {
    const el = document.getElementById(id);
    if(el) el.textContent = value;
  };

  setText('dashboardMonthLabel', `Resumen de ${monthLabel(ym)}`);
  setText('dashRegistros', monthRecords.length);
  setText('dashCopias', totalJuegos);
  setText('dashCaras', totalCaras);
  setText('dashPorCobrar', `S/ ${totalCobrar.toFixed(2)}`);
  setText('dashCobrado', `S/ ${cobrado.toFixed(2)}`);
  setText('dashPendiente', `S/ ${saldoPendiente.toFixed(2)}`);
  setText('dashCobroPorcentaje', `${porcentaje.toFixed(0)}%`);
  setText('dashSeccionesPagadas', seccionesPagadas);
  setText('dashSeccionesPendientes', seccionesPendientes);
  setText('dashSeccionesConsumo', Object.keys(seccionMap).length);
  setText('dashPrecio', `S/ ${Number(price || 0).toFixed(2)}`);
  setText('dashDocentes', docentesMes.size);

  const ultimo = [...monthRecords].sort((a,b) => (b.fecha || '').localeCompare(a.fecha || ''))[0];
  setText('dashUltimoRegistro', ultimo ? ultimo.fecha : '—');
  if(!esDocente()) renderDashboardSolicitudes();

  const bar = document.getElementById('dashCobroBar');
  if(bar) bar.style.width = `${porcentaje}%`;

  const rows = Object.values(seccionMap).sort((a,b)=>{
    if(a.grado !== b.grado) return String(a.grado).localeCompare(String(b.grado), 'es', {numeric:true});
    return String(a.seccion).localeCompare(String(b.seccion), 'es', {numeric:true});
  });

  const wrap = document.getElementById('dashboardSecciones');
  if(!wrap) return;
  if(rows.length === 0){
    wrap.innerHTML = '<div class="empty">Sin registros de copias en este mes.</div>';
    return;
  }

  wrap.innerHTML = `
    <div class="dashboard-table-scroll">
      <table class="dashboard-table">
        <thead>
          <tr>
            <th>Grado</th>
            <th>Sección</th>
            <th class="num">Copias</th>
            <th class="num">Caras</th>
            <th class="num">A cobrar</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => {
            const key = `${r.grado} ${r.seccion}`.trim();
            const cobro = cobros[ym + ':' + key];
            const pagado = !!(cobro && cobro.pagado);
            const monto = pagado ? (Number(cobro.monto) || r.costo) : 0;
            const saldo = Math.max(r.costo - monto, 0);
            // El saldo se compara en centimos con media unidad de tolerancia.
            // r.costo se acumula sumando caras*precio registro por registro y
            // en punto flotante eso deja residuos (27.200000000000003), asi
            // que exigir saldo === 0 hacia que secciones realmente pagadas
            // mostraran "Saldo S/ 0.00" en lugar de "Pagado".
            const saldoLiquidado = Math.round(saldo * 100) === 0;
            let estadoClass = pagado && saldoLiquidado ? 'pagado' : 'pendiente';
            let estadoText = pagado && saldoLiquidado ? 'Pagado' : (pagado ? `Saldo S/ ${saldo.toFixed(2)}` : 'Pendiente');
            return `
              <tr>
                <td>${escapeHtml(r.grado)}</td>
                <td>${escapeHtml(r.seccion)}</td>
                <td class="num">${r.juegos}</td>
                <td class="num">${r.caras}</td>
                <td class="num dashboard-money">S/ ${r.costo.toFixed(2)}</td>
                <td><span class="dashboard-status ${estadoClass}">${escapeHtml(estadoText)}</span></td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// Desde el dashboard se accede al mismo reporte mensual existente.
document.getElementById('dashboardGoMonthlyBtn').addEventListener('click', ()=>{
  document.querySelector('[data-tab="mensual"]').click();
});
