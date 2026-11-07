/* Registro de Copias - arranque de la aplicación
   index.html solo carga este archivo.
*/
(async function(){
  function loadScript(src){
    return new Promise((resolve, reject)=>{
      const s = document.createElement('script');
      s.src = src;
      s.async = false;
      s.onload = resolve;
      s.onerror = () => reject(new Error('No se pudo cargar: ' + src));
      document.head.appendChild(s);
    });
  }

  try{
    // Primero los servicios de Supabase.
    await loadScript('supabase.js');
    await window.__supabaseReady;

    // Después el núcleo y los módulos de la interfaz.
    const modules = [
      'js/core/app-state.js',
      'js/modules/01-registros.js',
      'js/modules/02-solicitudes.js',
      'js/modules/03-reportes.js',
      'js/modules/04-dashboard.js',
      'js/modules/05-mensual.js',
      'js/modules/06-cobros.js',
      'js/modules/07-boletas.js',
      'js/modules/08-configuracion.js',
      'js/modules/09-usuarios.js',
      'js/modules/10-docentes-excel.js',
      'js/modules/11-respaldo.js',
      'js/modules/12-inventario.js',
      'js/modules/13-prestamos.js',
      'js/core/app-events.js'
    ];

    for(const file of modules){
      await loadScript(file);
    }

    await init();
  }catch(error){
    console.error('Error iniciando Registro de Copias:', error);
    const box = document.getElementById('appLoadError');
    if(box){
      box.hidden = false;
      box.textContent = 'No se pudo cargar la aplicación. Revisa los archivos y vuelve a intentar.';
    }
  }
})();
