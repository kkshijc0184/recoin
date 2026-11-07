/* Registro de Copias - cargador de servicios Supabase
   Este archivo conserva el nombre supabase.js para no romper referencias.
   La lógica real está separada en js/services/.
*/
(function(){
  const files = [
    'js/services/01-config.js',
    'js/services/02-auth.js',
    'js/services/03-profile.js',
    'js/services/04-records.js',
    'js/services/05-solicitudes.js',
    'js/services/06-cobros.js',
    'js/services/07-docentes.js',
    'js/services/08-contadores.js',
    'js/services/09-local-toast.js',
    'js/services/10-inventario.js'
  ];

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

  window.__supabaseReady = (async()=>{
    for(const file of files) await loadScript(file);
  })();
})();
