// Importar los paquetes necesarios
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const fullcalendar = require('fullcalendar');
const moment = require('moment');
var path = require('path')
const cron = require('node-cron');

// Crear una instancia de la aplicación
const app = express();

app.use('/public', express.static(path.join(__dirname, 'public')))

// Configurar el middleware bodyParser para analizar las solicitudes POST
app.use(bodyParser.urlencoded({
	extended: false
}));
app.use(bodyParser.json());


// Ejecutar el cron job cada 5 minutos
cron.schedule('*/5 * * * *', async () => {
  try {
    const currentDate = new Date();
    await Evento.deleteMany({ end: { $lt: currentDate } });
  } catch (err) {
    console.error('Error al eliminar los eventos automáticamente', err);
  }
});


// Iniciar el servidor
app.listen(3000, () => console.log('Servidor iniciado en http://127.0.0.1:3000'));


//Autentificación

const bcrypt = require('bcrypt');
const session = require('express-session');
const {
	MongoClient
} = require('mongodb');
const MongoDBStore = require('connect-mongodb-session')(session);

app.set('view engine', 'ejs');

const store = new MongoDBStore({
	uri: 'mongodb://127.0.0.1:27017/proyecto',
	collection: 'sessions'
});

app.use(session({
	secret: 'mysecretkey',
	resave: false,
	saveUninitialized: true,
	store: store
}));


const userSchema = new mongoose.Schema({
	name: {
		type: String,
		required: true
	},
	email: {
		type: String,
		required: true,
		unique: true
	},
	password: {
		type: String,
		required: true
	},
	roles: {
		type: [String],
		default: ['usuario']
	}
});

const User = mongoose.model('User', userSchema);

module.exports = User;

app.use(async function (req, res, next) {
	const userId = req.session.userId;
	if (userId) {
		const client = await MongoClient.connect('mongodb://127.0.0.1:27017');
		const db = client.db('proyecto');
		const users = db.collection('users');
		const user = await users.findOne({ _id: userId });
		res.locals.user = user;
		client.close();
	} else {
		res.locals.user = null;
	}
	next();
})


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

async function checkAdminRole(req, res, next) {
	const userId = req.session.userId;
	if (!userId) {
		res.redirect('/login');
	} else {
		const client = await MongoClient.connect('mongodb://127.0.0.1:27017');
		const db = client.db('proyecto');
		const users = db.collection('users');
		const user = await users.findOne({ _id: userId });
		if (user.roles.includes('admin')) {
			next();
		} else {
			res.status(403).send('No tienes permisos para acceder a esta página');
		}
		client.close();
	}
}

app.get('/', async function (req, res) {
    const noticias = await Noticia.find({})
      .populate('autor', 'name')
      .sort({ fechaCreacion: -1 })
      .limit(3);

    noticias.splice(3); // Para solo pasar 3 noticias
		const events = (await Evento.find({}).sort({ start: 1 })); // Ordenar por fecha de inicio ascendente
		events.splice(3);
		
		const formattedEvents = events.map(event => ({
			id: event._id,// Agregar la ID del evento
			title: event.title,
			formattedStart: moment(event.start).format("DD/MM/YYYY HH:mm"),
			formattedEnd: moment(event.end).format("DD/MM/YYYY HH:mm")
		}));

    res.render('index', { noticias, events: formattedEvents});
  }
);

app.get('/login', async function (req, res) {
	const userId = req.session.userId;
	const user = userId ? await users.findOne({ _id: userId }) : null; // Agregamos esta línea para obtener el usuario si existe
	res.render('login', { user }); // Pasamos el objeto user como parámetro al renderizar la vista
});

app.post('/login', async function (req, res) {
	const email = req.body.email;
	const password = req.body.password;

	const client = await MongoClient.connect('mongodb://127.0.0.1:27017');
	const db = client.db('proyecto');
	const users = db.collection('users');
	const user = await users.findOne({ email: email });

	if (!user) {
		res.send('Invalid email or password');
	} else {
		const result = await bcrypt.compare(password, user.password);

		if (result === true) {
			req.session.userId = user._id;
			req.session.user = user;
			res.redirect('/perfil');
		} else {
			res.send('Invalid email or password');
		}
	}
	client.close();
});

app.get('/register', async function (req, res) {
	const userId = req.session.userId;
	const user = userId ? await users.findOne({ _id: userId }) : null; // Agregamos esta línea para obtener el usuario si existe
	res.render('register', { user }); // Pasamos el objeto user como parámetro al renderizar la vista
});

app.post('/register', async function (req, res) {
	const name = req.body.name;
	const email = req.body.email;
	const password = req.body.password;

	try {
		const client = await MongoClient.connect('mongodb://127.0.0.1:27017');
		const db = client.db('proyecto');
		const users = db.collection('users');

		const existingUserByName = await users.findOne({ name: name });
		const existingUserByEmail = await users.findOne({ email: email });

		if (existingUserByName) {
			res.send('El nombre de usuario ya está registrado');
			return;
		}

		if (existingUserByEmail) {
			res.send('El correo electrónico ya está registrado');
			return;
		}

		const hashedPassword = await bcrypt.hash(password, 10);

		const result = await users.insertOne({
			name: name,
			email: email,
			password: hashedPassword,
			roles: ["usuario"]
		});

		req.session.userId = result.insertedId;
		res.redirect('/perfil');
		client.close();
	} catch (err) {
		console.error(err);
		res.send('Error registrando usuario');
	}
});

app.post('/logout', function (req, res) {
	req.session.destroy(function (err) {
		if (err) {
			console.log(err);
		} else {
			res.redirect('/login');
		}
	});
});

app.get('/perfil', async function (req, res) {
	const userId = req.session.userId;
	if (!userId) {
		res.redirect('/login');
	} else {
		const client = await MongoClient.connect('mongodb://127.0.0.1:27017');
		const db = client.db('proyecto');
		const users = db.collection('users');
		const user = await users.findOne({ _id: userId });
		res.render('perfil', { name: user.name, email: user.email, user: user, roles: user.roles });
		client.close();
	}
});


//Admin panel
app.get('/admin', checkAdminRole, async function (req, res) {
	try {
		const userList = await User.find({});
		res.render('admin', { name: req.session.name, email: req.session.email, user: req.session.user, userList });
	} catch (error) {
		res.status(500).send('Error al obtener la lista de usuarios');
	}
});

app.get('/edit/:userId', checkAdminRole, async function (req, res) {
	try {
		const userToEdit = await User.findById(req.params.userId);
		res.render('editarUsuario', { user: userToEdit });
	} catch (error) {
		res.status(500).send('Error al obtener el usuario');
	}
});

app.post('/edit/:userId', checkAdminRole, async function (req, res) {
	try {
		const { name, email, roles } = req.body;
		await User.findByIdAndUpdate(req.params.userId, { name, email, roles });
		res.redirect('/admin');
	} catch (error) {
		res.status(500).send('Error al editar el usuario');
	}
});

// Ruta para borrar un usuario
app.post('/delete/:userId', checkAdminRole, async (req, res) => {
	const userId = req.params.userId;
	try {
		await User.findByIdAndDelete(userId);
		res.redirect('/admin');
	} catch (error) {
		console.error(error);
		res.status(500).send('Error al borrar el usuario');
	}
});

//Editor panel

app.get('/editor', checkEditorRole, async function (req, res) {
  try {
    const noticias = await Noticia.find({})
		.populate('autor', 'name') // Para obtener solo el nombre del autor
		.sort({ fechaCreacion: -1 }); // Ordenar por fecha de creación descendente

    const events = await Evento.find({}).sort({ start: 1 }); // Ordenar por fecha de inicio ascendente
		
		const formattedEvents = events.map(event => ({
			id: event._id,// Agregar la ID del evento
			title: event.title,
			formattedStart: moment(event.start).format("DD/MM/YYYY HH:mm"),
			formattedEnd: moment(event.end).format("DD/MM/YYYY HH:mm")
		}));

    res.render('editor', { noticias, events: formattedEvents});
  } catch (error) {
    res.status(500).send('Error al obtener noticias y eventos');
  }
});





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
		.then(() => res.redirect("/editor"))
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
	const currentDate = new Date();

  if (new Date(start) < currentDate) {
    return res.status(400).send('La fecha de inicio no puede ser anterior a la fecha actual');
  }

	if (moment(end).isBefore(start)) {
    return res.status(400).send('La fecha de finalización debe ser posterior a la fecha de inicio');
  }

	const nuevoEvento = new Evento({
		title,
		start,
		end
	});

	nuevoEvento.save()
		.then(() => res.redirect('/editor'))
		.catch((err) => res.status(500).send('Error al crear el evento: ' + err));
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
	const currentDate = new Date();

  if (new Date(start) < currentDate) {
    return res.status(400).send('La fecha de inicio no puede ser anterior a la fecha actual');
  }

	if (moment(end).isBefore(start)) {
    return res.status(400).send('La fecha de finalización debe ser posterior a la fecha de inicio');
  }

	Evento.findByIdAndUpdate(eventId, { title, start, end })
		.then(() => res.redirect("/editor"))
		.catch((err) => res.status(500).send('Error al actualizar el evento: ' + err));
});

//borrar
app.post('/eventos/:id/borrar', checkEditorRole, (req, res) => {
	const eventId = req.params.id;

	Evento.findByIdAndDelete(eventId)
		.then(() => res.redirect("/editor"))
		.catch((err) => res.status(500).send('Error al borrar el evento: ' + err));
});



//Noticias

// Definir el modelo de Noticia
const NoticiaSchema = new mongoose.Schema({
	titulo: String,
	contenido: String,
	fechaCreacion: {
		type: Date,
		default: Date.now
	},
	autor: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User'
	}
});
const Noticia = mongoose.model('Noticia', NoticiaSchema);

app.post('/noticias', async (req, res) => {
	const { titulo, contenido } = req.body;
	const autor = req.session.userId; // Obtener el ID del usuario logeado desde la sesión
	try {
		const nuevaNoticia = new Noticia({
			titulo,
			contenido,
			autor // Establece la ID del usuario como referencia
		});
		await nuevaNoticia.save();
		res.redirect("/editor");
	} catch (err) {
		res.status(500).send('Error al crear la noticia: ' + err);
	}
});

app.get('/noticias', (req, res) => {
	Noticia.find({})
		.populate('autor', 'name') // Para obtener solo el nombre del autor
		.sort({ fechaCreacion: -1 }) // Ordenar por fecha de creación descendente
		.then((noticias) => {
			res.render('noticias', { noticias });
		})
		.catch((err) => res.status(500).send('Error al obtener las noticias', err));
});


app.get('/noticias/crear', checkEditorRole, async function (req, res) {
	try {
		const editorAdminUsers = await User.find({ roles: { $in: ['editor', 'admin'] } });
		res.render('crearNoticia', { users: editorAdminUsers });
	} catch (error) {
		res.status(500).send('Error al obtener los usuarios');
	}
});

//editar
app.get('/noticias/:id/editar', checkEditorRole, async function (req, res) {
	try {
		const noticiaId = req.params.id;
		const noticia = await Noticia.findById(noticiaId);
		const editorAdminUsers = await User.find({ roles: { $in: ['editor', 'admin'] } });
		res.render('editarNoticia', { noticia, users: editorAdminUsers });
	} catch (error) {
		res.status(500).send('Error al obtener la noticia');
	}
});

app.post('/noticias/:id', (req, res) => {
	const noticiaId = req.params.id;
	const { titulo, contenido, autor } = req.body; //AQUI AUTOR NO ESTABA BIEN DEFINIDO, SE LLAMABA AUTORNAME

	// Buscar el usuario por su nombre y obtener su ID
	User.findOne({ name: autor }) //AQUI AUTOR NO ESTABA BIEN DEFINIDO
		.then((user) => {
			if (!user) {
				throw new Error('Usuario no encontrado');
			}

			const autor = user._id;

			// Actualizar la noticia por su ID
			Noticia.findByIdAndUpdate(noticiaId, { titulo, contenido, autor })
				.then(() => {
					res.redirect('/editor');
				})
				.catch((error) => {
					console.log('Error al actualizar la noticia:', error);
					res.status(500).send('Error al actualizar la noticia');
				});
		})
		.catch((error) => {
			console.log('Error al buscar el usuario:', error);
			res.status(500).send('Error al buscar el usuario');
		});
});

//ficha
app.get('/noticias/:id', (req, res) => {
	const noticiaId = req.params.id;

	Noticia.findById(noticiaId)
		.populate('autor', 'name') // Obtener solo el nombre del autor
		.then((noticia) => {
			res.render('fichaNoticia', { noticia });
		})
		.catch((error) => {
			console.log('Error al obtener la noticia:', error);
			res.status(500).send('Error al obtener la noticia');
		});
});

//borrar
app.post('/noticias/:id/borrar', checkEditorRole, async function (req, res) {
	const noticiaId = req.params.id;
	await Noticia.findByIdAndDelete(noticiaId);
	res.redirect('/editor');
});
