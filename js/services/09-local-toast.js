// ---- Config local ----
async function saveSchoolName(){ lcSet('copias:schoolName', schoolName); }
async function saveSchoolAddress(){ lcSet('copias:schoolAddress', schoolAddress); }
async function savePrice(){ lcSet('copias:price', String(price)); }

// ---- Notificaciones (toast) ----
const appToast = (typeof Swal !== 'undefined') ? Swal.mixin({
  toast: true,
  position: 'top-end',
  width: 'auto',
  showConfirmButton: false,
  showCloseButton: true,
  timer: 3200,
  timerProgressBar: true,
  didOpen: (el)=>{
    el.addEventListener('mouseenter', Swal.stopTimer);
    el.addEventListener('mouseleave', Swal.resumeTimer);
  }
}) : null;

// Si un toast se reemplaza por otro (ej. "Conectando..." -> "Datos cargados"),
// SweetAlert2 cambia el texto al instante sin avisar. Este tiempo minimo
// asegura que el mensaje anterior alcance a leerse antes de cambiar.
const TOAST_MIN_MS = 1100;
let lastToastAt = 0;

async function showToast(msg, tipo='ok'){
  if(!appToast){ console.log('[' + tipo + ']', msg); return; }
  const elapsed = Date.now() - lastToastAt;
  if(elapsed < TOAST_MIN_MS){
    await new Promise(r => setTimeout(r, TOAST_MIN_MS - elapsed));
  }
  lastToastAt = Date.now();
  appToast.fire({
    title: msg,
    customClass: {
      popup: 'app-toast app-toast-' + tipo,
      timerProgressBar: 'app-toast-bar',
      closeButton: 'app-toast-close'
    }
  });
}
