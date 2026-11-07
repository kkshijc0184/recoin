// ---- Boleta de pago ----
// Convierte un monto en soles a texto legal ("SON: ...").
// Soporta de 0 a 999,999,999.99. La version anterior solo cubria 0-99
// (para montos >= 100 devolvia "undefined" en la boleta impresa).
function numeroALetras(monto){
  const entero = Math.max(0, Math.floor(monto));
  const centavos = Math.round((monto - entero) * 100);

  const unidades = ['','UNO','DOS','TRES','CUATRO','CINCO','SEIS','SIETE','OCHO','NUEVE',
    'DIEZ','ONCE','DOCE','TRECE','CATORCE','QUINCE','DIECIS\u00c9IS','DIECISIETE',
    'DIECIOCHO','DIECINUEVE'];
  const decenas = ['','DIEZ','VEINTE','TREINTA','CUARENTA','CINCUENTA','SESENTA','SETENTA','OCHENTA','NOVENTA'];
  const centenas = ['','CIENTO','DOSCIENTOS','TRESCIENTOS','CUATROCIENTOS','QUINIENTOS',
    'SEISCIENTOS','SETECIENTOS','OCHOCIENTOS','NOVECIENTOS'];

  // Convierte un numero de 0 a 999
  function convGrupo(n){
    if(n === 0) return '';
    if(n === 100) return 'CIEN';
    let out = '';
    const c = Math.floor(n/100), resto = n%100;
    if(c > 0) out += centenas[c] + (resto ? ' ' : '');
    if(resto > 0){
      if(resto < 20){
        out += unidades[resto];
      } else if(resto < 30){
        out += 'VEINTI' + unidades[resto-20];
      } else {
        const d = Math.floor(resto/10), u = resto%10;
        out += decenas[d] + (u ? ' Y ' + unidades[u] : '');
      }
    }
    return out;
  }

  // "UNO"/"VEINTIUNO"/etc pierden la O final (apocope) cuando van
  // seguidos de otra palabra (MIL, SOLES): "VEINTIUN MIL", "MIL UN SOLES".
  function apocope(txt){ return txt.endsWith('UNO') ? txt.slice(0, -1) : txt; }

  function convEntero(n){
    if(n === 0) return 'CERO';
    if(n < 1000) return convGrupo(n);

    if(n < 1000000){
      const miles = Math.floor(n/1000), resto = n%1000;
      const milesTxt = miles === 1 ? 'MIL' : apocope(convGrupo(miles)) + ' MIL';
      return milesTxt + (resto ? ' ' + convGrupo(resto) : '');
    }

    const millones = Math.floor(n/1000000), resto = n%1000000;
    const millonesTxt = millones === 1 ? 'UN MILL\u00d3N' : convGrupo(millones) + ' MILLONES';
    return millonesTxt + (resto ? ' ' + convEntero(resto) : '');
  }

  // "UNO" se usa como cifra suelta ("VEINTIUNO"), pero antes de SOLES
  // en singular corresponde "UN SOL". Ajustamos el caso 1 aparte y
  // aplicamos el apocope al resto (p.ej. "CIENTO VEINTIUN SOLES").
  const letras = entero === 1 ? 'UN' : apocope(convEntero(entero));
  const centStr = ' CON ' + String(centavos).padStart(2,'0') + '/100';
  const soles = entero === 1 ? 'SOL' : 'SOLES';
  return 'SON: ' + letras + centStr + ' ' + soles;
}

function mesLabel(ym){
  if(!ym) return '';
  const [y,m] = ym.split('-');
  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  return meses[parseInt(m,10)-1] + ' de ' + y;
}

async function generarBoleta(btn, secKey, debe, cobro, ym){
  if(btn && btn.disabled) return; // evitar doble clic mientras se genera
  const montoFinal = (cobro && cobro.monto > 0) ? cobro.monto : debe;
  const fechaPago  = (cobro && cobro.fecha) ? cobro.fecha : todayStr();

  const { value: formData } = await Swal.fire({
    title: 'Datos para la boleta',
    html: `
      <div style="text-align:left;">
        <label style="font-size:0.85rem;font-weight:600;">Recibido del Sr(a):</label>
        <input id="boletaPagador" class="swal2-input" placeholder="Nombre de quien paga" style="margin:6px 0 12px;">
        <label style="font-size:0.85rem;font-weight:600;">Concepto:</label>
        <input id="boletaConcepto" class="swal2-input" value="Copias del mes de ${mesLabel(ym)}" style="margin:6px 0 12px;">
        <label style="font-size:0.85rem;font-weight:600;">Monto (S/):</label>
        <input id="boletaMonto" class="swal2-input" type="number" step="0.01" min="0.01" value="${montoFinal.toFixed(2)}" style="margin:6px 0 12px;">
        <label style="font-size:0.85rem;font-weight:600;">Fecha de pago:</label>
        <input id="boletaFecha" class="swal2-input" type="date" value="${fechaPago}" style="margin:6px 0 0;">
      </div>`,
    confirmButtonText: 'Generar e imprimir',
    cancelButtonText: 'Cancelar',
    showCancelButton: true,
    focusConfirm: false,
    preConfirm: () => {
      const pagador  = document.getElementById('boletaPagador').value.trim();
      const concepto = document.getElementById('boletaConcepto').value.trim();
      const monto    = parseFloat(document.getElementById('boletaMonto').value) || 0;
      const fecha    = document.getElementById('boletaFecha').value;
      // Validar antes de generar: una boleta sin pagador o en S/ 0.00
      // no sirve como comprobante y solo desperdiciaria un numero de recibo.
      if(!pagador){
        Swal.showValidationMessage('Escribe el nombre de quien paga.');
        return false;
      }
      if(monto <= 0){
        Swal.showValidationMessage('El monto debe ser mayor a S/ 0.00.');
        return false;
      }
      if(!fecha){
        Swal.showValidationMessage('Selecciona la fecha de pago.');
        return false;
      }
      return { pagador, concepto, monto, fecha };
    }
  });

  if(!formData) return;

  if(btn){ btn.disabled = true; btn.textContent = '\u2026'; }
  let numRecibo;
  try{
    numRecibo = await getNextNumReciboDB();
  } finally {
    if(btn){ btn.disabled = false; btn.textContent = '\u{1F4CB} Boleta'; }
  }

  const fechaDisplay = new Date(formData.fecha + 'T12:00:00')
    .toLocaleDateString('es-PE',{day:'2-digit',month:'long',year:'numeric'});
  const nombreColegio = schoolName && schoolName.trim() ? schoolName.trim() : 'INSTITUCI\u00d3N EDUCATIVA';
  const direccionColegio = schoolAddress && schoolAddress.trim() ? schoolAddress.trim() : '';

  // Una sola "tarjeta" de recibo, reutilizada dos veces en la misma hoja
  // (ORIGINAL para quien paga, COPIA para el archivo del colegio), asi
  // se ahorra papel y queda constancia de ambos lados con un solo numero.
  function tarjeta(etiqueta){
    return `
  <div class="boleta">
    <div class="etiqueta-copia">${etiqueta}</div>
    <div class="boleta-header">
      <img src="${CREST_IMG}" alt="Insignia">
      <div class="titles">
        <div class="ie-nombre">${escapeHtml(nombreColegio)}</div>
        ${direccionColegio ? `<div class="ie-sub">${escapeHtml(direccionColegio)}</div>` : ''}
      </div>
    </div>
    <div class="boleta-titulo">
      <h2>Recibo de Ingreso</h2>
      <div class="nro-badge">N\u00ba ${numRecibo}</div>
    </div>
    <div class="boleta-body">
      <div class="campo">
        <div class="campo-label">Recib\u00ed del Sr(a):</div>
        <div class="campo-valor">${escapeHtml(formData.pagador)}</div>
      </div>
      <div class="campo">
        <div class="campo-label">La suma de:</div>
        <div class="campo-valor monto-grande">S/ ${formData.monto.toFixed(2)}</div>
        <div class="campo-valor letras">${numeroALetras(formData.monto)}</div>
      </div>
      <div class="campo">
        <div class="campo-label">Por concepto de:</div>
        <div class="campo-valor">${escapeHtml(formData.concepto)} &mdash; Grado/Secci\u00f3n: ${escapeHtml(secKey)}</div>
      </div>
    </div>
    <div class="boleta-footer">
      <div class="lugar-fecha">${fechaDisplay}</div>
      <div class="firma-bloque">
        <div class="firma-linea"></div>
        <div class="firma-label">Tesorer\u00eda</div>
      </div>
    </div>
  </div>`;
  }

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Boleta N\u00b0 ${numRecibo}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:Georgia,'Times New Roman',serif;background:#fff;padding:16px;
    -webkit-print-color-adjust:exact;print-color-adjust:exact;}
  .hoja{display:flex;flex-direction:column;gap:14px;max-width:560px;margin:0 auto;}
  .boleta{
    position:relative;
    border:2px solid #0f4a33;border-radius:10px;
    overflow:hidden;
  }
  .boleta::before{
    content:'';display:block;height:6px;
    background:linear-gradient(90deg,#d6283b 0 33.4%,#fff 33.4% 66.6%,#d6283b 66.6% 100%);
    border-bottom:1px solid #e3e3e3;
  }
  .etiqueta-copia{
    position:absolute;top:8px;right:-30px;
    background:#a3273c;color:#fff;font-size:0.65rem;font-weight:bold;
    letter-spacing:1px;padding:3px 34px;transform:rotate(35deg);
    box-shadow:0 1px 2px rgba(0,0,0,0.3);
  }
  .boleta-header{
    background:#0f4a33;color:#fff;
    display:flex;align-items:center;gap:14px;
    padding:12px 20px;
    border-bottom:4px solid #e9a820;
  }
  .boleta-header img{width:46px;height:50px;object-fit:contain;}
  .boleta-header .titles{flex:1;}
  .boleta-header .ie-nombre{font-size:0.95rem;font-weight:bold;letter-spacing:0.5px;}
  .boleta-header .ie-sub{font-size:0.7rem;opacity:0.85;margin-top:2px;}
  .boleta-titulo{
    text-align:center;border-bottom:2px solid #0f4a33;
    padding:8px 20px;background:#eef6f1;
  }
  .boleta-titulo h2{font-size:1rem;color:#0f4a33;letter-spacing:1px;text-transform:uppercase;}
  .nro-badge{
    display:inline-block;background:#e0f0e6;border:1.5px solid #0f4a33;
    color:#0f4a33;font-weight:bold;font-size:0.85rem;
    padding:2px 14px;border-radius:999px;margin-top:5px;
    letter-spacing:2px;
  }
  .boleta-body{padding:16px 22px;}
  .campo{margin-bottom:10px;border-bottom:1px dotted #aaa;padding-bottom:6px;}
  .campo:last-child{border-bottom:none;margin-bottom:0;}
  .campo-label{font-size:0.68rem;text-transform:uppercase;color:#555;letter-spacing:0.5px;margin-bottom:2px;}
  .campo-valor{font-size:0.95rem;color:#111;font-weight:600;}
  .campo-valor.monto-grande{font-size:1.45rem;color:#0f4a33;font-weight:700;}
  .campo-valor.letras{font-size:0.78rem;font-weight:400;color:#333;font-style:italic;}
  .boleta-footer{
    display:flex;justify-content:space-between;align-items:flex-end;
    padding:12px 22px 16px;border-top:1px solid #ddd;margin-top:6px;
  }
  .firma-bloque{text-align:center;}
  .firma-linea{border-top:1px solid #333;width:140px;margin:26px auto 4px;}
  .firma-label{font-size:0.68rem;text-transform:uppercase;color:#555;}
  .lugar-fecha{font-size:0.76rem;color:#444;}
  @media print{
    body{padding:0;}
    .hoja{max-width:100%;gap:10px;}
    .boleta{border:2px solid #0f4a33;}
  }
</style>
</head>
<body>
<div class="hoja">
  ${tarjeta('ORIGINAL')}
  ${tarjeta('COPIA')}
</div>
<script>window.onload=function(){window.print();}<\/script>
</body>
</html>`;

  const ventana = window.open('','_blank','width=650,height=850');
  if(!ventana){
    showToast('El navegador bloque\u00f3 la ventana de impresi\u00f3n. Permite ventanas emergentes e intenta de nuevo.', 'error');
    return;
  }
  ventana.document.write(html);
  ventana.document.close();
}

