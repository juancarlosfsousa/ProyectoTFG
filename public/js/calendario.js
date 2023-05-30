document.addEventListener('DOMContentLoaded', function () {
  var calendarEl = document.getElementById('calendario');
  var calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    events: '/eventosjson',
    locale: 'es',
    firstDay: 1,
    buttonText: {
      today: 'Hoy'
    },
    eventTimeFormat: {
      hour: '2-digit',
      minute: '2-digit',
      meridiem: false
    },
    showNonCurrentDates: false,
    fixedWeekCount: false,
    eventClick: function (info) {

      // Crear el contenido del lightbox
      var lightboxContent = '<h2>' + info.event.title + '</h2>' +
        '<p>Inicio: ' + info.event.start.toLocaleString() + '</p>' +
        '<p>Fin: ' + info.event.end.toLocaleString() + '</p>';

      // Mostrar el contenido del lightbox y centrarlo en la página
      $('#lightboxContent').html(lightboxContent);
      $('#lightbox').fadeIn();
    }
  });
  // Manejar el evento de clic en el botón de cierre
  $('#closeButton').click(function () {
    $('#lightbox').fadeOut();
  });

  calendar.render();
});