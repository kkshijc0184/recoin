// ---- Numero correlativo de recibo ----
// El correlativo vive en Supabase (tabla "contadores") para que sea el
// MISMO numero sin importar desde que computadora o celular se emita la
// boleta. Usa actualizacion optimista (compara el valor leido contra el
// valor guardado) para evitar que dos boletas emitidas casi al mismo
// tiempo desde dispositivos distintos salgan con el mismo numero.
async function getNextNumReciboDB(){
  const ID = 'recibos';
  for(let intento = 0; intento < 5; intento++){
    let actual = 0;
    let filaExiste = false;
    try{
      const filas = await sbFetch('contadores?id=eq.' + ID + '&select=valor');
      if(filas.length){ actual = filas[0].valor || 0; filaExiste = true; }
    }catch(e){ break; } // sin conexion a Supabase: usar respaldo local

    if(!filaExiste){
      // Primera vez que se emite una boleta: crear la fila del contador.
      try{
        await sbFetch('contadores', {
          method: 'POST', prefer: 'return=minimal',
          body: { id: ID, valor: 1 }
        });
        return String(1).padStart(7, '0');
      }catch(e){ continue; } // alguien mas la creo justo ahora: reintentar
    }

    const siguiente = actual + 1;
    try{
      // Solo actualiza si el valor sigue siendo el que leimos (evita
      // choques si dos personas generan una boleta al mismo tiempo).
      const actualizado = await sbFetch(
        'contadores?id=eq.' + ID + '&valor=eq.' + actual,
        { method: 'PATCH', prefer: 'return=representation', body: { valor: siguiente } }
      );
      if(actualizado.length) return String(siguiente).padStart(7, '0');
      // Otro dispositivo gano la carrera: reintentar con el valor nuevo.
    }catch(e){ break; }
  }
  // Respaldo si Supabase no responde: sigue funcionando offline, aunque
  // en ese caso el numero solo es correlativo dentro de este dispositivo.
  showToast('No se pudo sincronizar el N\u00b0 de recibo. Usando numeraci\u00f3n local.', 'error');
  return getNextNumReciboLocal();
}

function getNextNumReciboLocal(){
  const key = 'copias:num_recibo';
  const actual = parseInt(lcGet(key) || '0', 10);
  const siguiente = actual + 1;
  lcSet(key, String(siguiente));
  return String(siguiente).padStart(7, '0');
}

