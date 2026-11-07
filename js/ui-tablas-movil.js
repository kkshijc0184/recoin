/* Solo apariencia: copia el título de cada columna a cada celda
   (atributo data-label) para que, en pantallas pequeñas, el CSS pueda
   mostrar cada fila como una tarjeta con sus nombres de campo.
   No lee ni cambia datos, ni toca ninguna función de la aplicación. */
(function () {
  'use strict';
  var EXCLUIDAS = ['report-table'];
  var pendiente = null;

  function rotular(tabla) {
    try {
      for (var i = 0; i < EXCLUIDAS.length; i++) {
        if (tabla.classList.contains(EXCLUIDAS[i])) return;
      }
      var ths = tabla.querySelectorAll('thead th');
      if (!ths.length) return;
      var titulos = [];
      ths.forEach(function (th) { titulos.push((th.textContent || '').trim()); });
      tabla.querySelectorAll('tbody tr').forEach(function (tr) {
        var col = 0;
        Array.prototype.forEach.call(tr.children, function (td) {
          if (td.tagName !== 'TD') return;
          if (!td.hasAttribute('colspan') && !td.hasAttribute('data-label')) {
            td.setAttribute('data-label', titulos[col] || '');
          }
          col += parseInt(td.getAttribute('colspan') || '1', 10);
        });
      });
      tabla.setAttribute('data-cards', '');
    } catch (e) { /* si algo falla, la tabla se queda como estaba */ }
  }

  function recorrer() {
    pendiente = null;
    document.querySelectorAll('table').forEach(rotular);
  }

  function programar() {
    if (pendiente) return;
    pendiente = setTimeout(recorrer, 60);
  }

  function iniciar() {
    recorrer();
    new MutationObserver(programar).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
