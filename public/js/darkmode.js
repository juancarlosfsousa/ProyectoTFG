function activarModoOscuro() { //añade la clase .dark-mode al body y establece como activado el modo oscuro en localStorage.
  document.body.classList.add('dark-mode');
  localStorage.setItem('modo-oscuro', 'activado');
}

function desactivarModoOscuro() { //borra la clase .dark-mode al body y establece como desactivado el modo oscuro en localStorage.
  document.body.classList.remove('dark-mode');
  localStorage.setItem('modo-oscuro', 'desactivado');
}

function alternarModoOscuro() { //Si el body la página tiene la clase dark-mode se llamará a la función desactivarModoOscuro(), si no lo tiene se llamará a la función activarModoOscuro()
  if (document.body.classList.contains('dark-mode')) {
    desactivarModoOscuro();
  } else {
    activarModoOscuro();
  }
}

window.addEventListener('load', function () { //este evento se carga cuando la página está cargada y se encarga de verificar el localStorage.
  var modoOscuroGuardado = localStorage.getItem('modo-oscuro');
  if (modoOscuroGuardado === 'activado') {
    activarModoOscuro();
  }
});
