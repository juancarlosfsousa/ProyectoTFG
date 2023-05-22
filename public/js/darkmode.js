function activarModoOscuro() {
  document.body.classList.add('dark-mode');
  localStorage.setItem('modo-oscuro', 'activado');
}

function desactivarModoOscuro() {
  document.body.classList.remove('dark-mode');
  localStorage.setItem('modo-oscuro', 'desactivado');
}

function alternarModoOscuro() {
  if (document.body.classList.contains('dark-mode')) {
    desactivarModoOscuro();
  } else {
    activarModoOscuro();
  }
}

window.addEventListener('load', function() {
  var modoOscuroGuardado = localStorage.getItem('modo-oscuro');
  if (modoOscuroGuardado === 'activado') {
    activarModoOscuro();
  }
});
