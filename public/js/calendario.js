document.addEventListener('DOMContentLoaded', function () {
  var calendarEl = document.getElementById('calendario');
  var calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth', //Muestra el calendario en formato mes.
    events: '/eventos', //recoge los eventos en esta ruta en la cual se muestran los eventos en JSON. 
    locale: 'es',
    firstDay: 1, //establecemos el dia de la semana como lunes
    buttonText: {
      today: 'Hoy' //el botón de "Today" se traducirá a "Hoy"
    },
    eventTimeFormat: { //Mostramos las hotas con dos digitos
      hour: '2-digit',
      minute: '2-digit',
      meridiem: false
    },
    showNonCurrentDates: false, //oculta las semanas que no se encuentren en el mes.
    fixedWeekCount: false, //oculta las semanas que no se encuentren en el mes.
    eventClick: function (info) { //creamos una función para mostrar un lightbox con los datos del evento al pulsar sobre uno.

      //Creamos el contenido del lightbox
      var lightboxContent = '<h2>' + info.event.title + '</h2>' +
        '<p>Inicio: ' + info.event.start.toLocaleString() + '</p>' +
        '<p>Fin: ' + info.event.end.toLocaleString() + '</p>';

      //Mostrar el contenido del lightbox y centrarlo en la página
      $('#lightboxContent').html(lightboxContent);
      $('#lightbox').fadeIn();
    }
  });
  //Al pulsar en el botón de cierre del lightbox se cerrará mediante el método fadeOut()
  $('#closeButton').click(function () {
    $('#lightbox').fadeOut();
  });

  calendar.render(); //mostramos el calendario
});