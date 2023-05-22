const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const fullcalendar = require('fullcalendar');
const moment = require('moment');
var path = require('path')

// Crear una instancia de la aplicación
const app = express();

app.use('/public', express.static(path.join(__dirname, 'public')))

// Configurar el middleware bodyParser para analizar las solicitudes POST
app.use(bodyParser.urlencoded({
	extended: false
}));
app.use(bodyParser.json());

async function checkEditorRole(req, res, next) {
	const userId = req.session.userId;
	if (!userId) {
		res.redirect('/login');
	} else {
		const client = await MongoClient.connect('mongodb://127.0.0.1:27017');
		const db = client.db('proyecto');
		const users = db.collection('users');
		const user = await users.findOne({ _id: userId });
		if (user.roles.includes('editor') || user.roles.includes('admin')) {
			next();
		} else {
			res.status(403).send('No tienes permisos para acceder a esta página');
		}
		client.close();
	}
}

//EVENTOS

// Conectarse a la base de datos MongoDB
mongoose.connect('mongodb://127.0.0.1:27017/proyecto', {
	useNewUrlParser: true,
	useUnifiedTopology: true
})
	.then(() => console.log('Conectado a MongoDB'))
	.catch((err) => console.error('Error al conectarse a MongoDB', err));

// Definir el modelo de Evento
const EventoSchema = new mongoose.Schema({
	title: String,
	start: Date,
	end: Date,
});

const Evento = mongoose.model('Evento', EventoSchema);

// Definir la ruta para crear un evento
app.post('/eventosjson', (req, res) => {
	const {
		title,
		start,
		end
	} = req.body;

	const nuevoEvento = new Evento({
		title,
		start: start,
		end: end
	});
	nuevoEvento.save()
		.then(() => res.redirect("/calendario"))
		.catch((err) => res.status(500).send('Error al crear el evento', err));
});

// Obtener los eventos desde la base de datos y mostrarlos en FullCalendar
app.get('/eventosjson', (req, res) => {
	Evento.find({})
		.then((eventos) => res.send(eventos))
		.catch((err) => res.status(500).send('Error al obtener los eventos', err));
});

app.get('/eventos', async (req, res) => { //añadir async
	// Obtener eventos de MongoDB y realizar el formateo de fechas y horas
	try {
		const events = await Evento.find({})
			.sort({ start: 1 }); // Ordenar por fecha de inicio ascendente

		const formattedEvents = events.map(event => ({
			id: event._id,// Agregar la ID del evento
			title: event.title,
			formattedStart: moment(event.start).format("DD/MM/YYYY HH:mm"),
			formattedEnd: moment(event.end).format("DD/MM/YYYY HH:mm")
		}));
		// Renderizar la vista con los eventos formateados
		res.render('eventos', { events: formattedEvents });
	} catch (err) {
		res.status(500).send('Error al obtener los eventos: ' + err);
	}
});

app.get('/eventos/crear', checkEditorRole, (req, res) => {
	res.render('crearEvento');
});

app.post('/eventos/crear', checkEditorRole, (req, res) => {
	const { title, start, end } = req.body;

	const nuevoEvento = new Evento({
		title,
		start,
		end
	});

	nuevoEvento.save()
		.then(() => res.redirect('/editor'))
		.catch((err) => res.status(500).send('Error al crear el evento: ' + err));
});

//borrar
app.post('/eventos/:id/borrar', checkEditorRole, (req, res) => {
	const eventId = req.params.id;

	Evento.findByIdAndDelete(eventId)
		.then(() => res.redirect("/editor"))
		.catch((err) => res.status(500).send('Error al borrar el evento: ' + err));
});

//modificar
app.get('/eventos/:id/editar', checkEditorRole, async (req, res) => {
	const eventId = req.params.id;

	try {
		const evento = await Evento.findById(eventId).exec();

		if (!evento) {
			return res.status(404).send('No se encontró el evento');
		}

		// Obtener las fechas en la zona horaria deseada
		const startFormatted = moment(evento.start).format('YYYY-MM-DDTHH:mm');
		const endFormatted = moment(evento.end).format('YYYY-MM-DDTHH:mm');

		res.render('editarEvento', { evento, startFormatted, endFormatted });
	} catch (error) {
		console.error('Error al obtener el evento para editar', error);
		res.status(500).send('Error al obtener el evento para editar');
	}
});

app.post('/eventos/:id/actualizar', checkEditorRole, (req, res) => {
	const eventId = req.params.id;
	const { title, start, end } = req.body;

	Evento.findByIdAndUpdate(eventId, { title, start, end })
		.then(() => res.redirect("/editor"))
		.catch((err) => res.status(500).send('Error al actualizar el evento: ' + err));
});

module.exports = { Evento };
