/* Pantalla de login separada de la aplicación principal. */
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

  const errorEl = document.getElementById('loginError');
  const btn = document.getElementById('loginBtn');

  try{
    await loadScript('supabase.js');
    await window.__supabaseReady;

    // Si ya existe una sesión válida, no mostramos el login otra vez.
    if(await restoreSession()){
      await cargarEstadoCambioPassword();
      window.location.replace(necesitaCambiarPassword() ? 'cambiar-password.html' : 'index.html');
      return;
    }
  }catch(error){
    console.error(error);
    errorEl.textContent = 'No se pudo conectar con el servicio. Intenta nuevamente.';
  }

  document.getElementById('loginForm').addEventListener('submit', async (e)=>{
    e.preventDefault();

    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    errorEl.textContent = '';
    btn.disabled = true;
    btn.textContent = 'Ingresando…';

    try{
      await signIn(email, password);
      await cargarEstadoCambioPassword();
      window.location.replace(necesitaCambiarPassword() ? 'cambiar-password.html' : 'index.html');
    }catch(error){
      console.error(error);
      errorEl.textContent = 'Correo o contraseña incorrectos.';
    }finally{
      btn.disabled = false;
      btn.textContent = 'Ingresar';
    }
  });
})();
