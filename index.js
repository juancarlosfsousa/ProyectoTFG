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





const multer = require('multer');

// Configurar el almacenamiento y el nombre de los archivos
const storage = multer.diskStorage({
	destination: (req, file, cb) => {
		cb(null, 'public/uploads'); // Directorio donde se guardarán las imágenes
	},
	filename: (req, file, cb) => {
		const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
		const extension = file.originalname.split('.').pop();
		cb(null, file.fieldname + '-' + uniqueSuffix + '.' + extension);
	}
});

// Crear una instancia de multer con la configuración de almacenamiento
const upload = multer({ storage: storage });

// Ruta para manejar la carga de archivos
app.post('/upload', upload.single('imagen'), (req, res) => {
	if (req.file) {
		const imageUrl = '/uploads/' + req.file.filename;
		res.send('Archivo subido correctamente: ' + imageUrl);
	} else {
		res.status(400).send('No se ha proporcionado ningún archivo');
	}
});






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

//Modelo de usuario
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

//Verificar si un usuario está autentificado.
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

//Verificar si un usuario dispone del rol editor para acceder a ciertas vistas y controladores.
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

//Verificar si un usuario dispone del rol admin para acceder a ciertas vistas y controladores.
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

//Renderizamos la vista index.
app.get('/', async function (req, res) {
	const noticias = await Noticia.find({}) //buscamos las noticias
		.populate('autor', 'name') //recojo solamente el dato name del autor.
		.sort({ fechaCreacion: -1 }) //las más recientes aparecerán primero.
		.limit(3); ////con esto mostraré únicamente tres noticias.

	noticias.splice(3); //con esto mostraré únicamente tres noticias.
	const events = (await Evento.find({}).sort({ start: 1 })); //recojo los eventos y los ordeno de manera que el más reciente aparecerá primero
	events.splice(3); //con esto mostraré únicamente tres eventos.

	const formattedEvents = events.map(event => ({ //formateo las noticias con el formato pedido haciendo uso de moment.
		id: event._id,
		title: event.title,
		formattedStart: moment(event.start).format("DD/MM/YYYY HH:mm"),
		formattedEnd: moment(event.end).format("DD/MM/YYYY HH:mm")
	}));

	res.render('index', { noticias, events: formattedEvents }); //renderizo la vista index con los eventos y noticias.
}
);

//Renderizamos la vista login.
app.get('/login', async function (req, res) {
	const userId = req.session.userId; //Se obtiene la ID del usuario logueado
	const user = userId ? await users.findOne({ _id: userId }) : null; //Comprobamos si el usuario existe
	res.render('login', { user }); //Pasamos user como parámetro al renderizar la vista login
});

//Manejamos la solicitud POST de la vista login.
app.post('/login', async function (req, res) {
	const email = req.body.email.toLowerCase(); // Se obtiene el email y la contraseña.
	const password = req.body.password;

	const client = await MongoClient.connect('mongodb://127.0.0.1:27017'); //Se realiza conexión con la base de datos y con la colección usuarios.
	const db = client.db('proyecto');
	const users = db.collection('users');
	const user = await users.findOne({ email: email }); //se realiza una consulta a los usuarios para buscar un email que coincida.

	if (!user) {
		res.send('Correo electrónico o contraseña invalida'); //si no se encuentra nada se muestra este mensaje
	} else {
		const result = await bcrypt.compare(password, user.password); //si se encuentra un usuario con ese email se usa bcrypt.compare para comparar las contraseñas

		if (result === true) { 
			req.session.userId = user._id; //si es correcta se establece al usuario logeado usuario y el ID del usuario para establecer la sesión.
			req.session.user = user;
			res.redirect('/perfil'); //se le redigire a la vista de perfil
		} else {
			res.send('Correo electrónico o contraseña invalida'); //si no se encuentra nada se muestra este mensaje
		}
	}
	client.close(); //se cierra la conexión con la bbdd
});

//Renderizamos la vista de registro.
app.get('/register', async function (req, res) {
	const userId = req.session.userId; //Se obtiene la ID del usuario logueado
	const user = userId ? await users.findOne({ _id: userId }) : null; // Comprobamos si el usuario existe
	res.render('register', { user }); //Pasamos user como parámetro al renderizar la vista register
});

//Manejamos la solicitud POST de la vista register.
app.post('/register', async function (req, res) {
	const name = req.body.name; // Se obtiene el nombre, email y la contraseña.
	const email = req.body.email.toLowerCase(); 
	const password = req.body.password;

	try {
		const client = await MongoClient.connect('mongodb://127.0.0.1:27017'); //Se realiza conexión con la base de datos y con la colección usuarios.
		const db = client.db('proyecto');
		const users = db.collection('users');

		const existingUserByName = await users.findOne({ name: name.toLowerCase() }); //Se verifica si ya existe en la BBDD un usuario con el mismo nombre y/o email.
		const existingUserByEmail = await users.findOne({ email: email });

		if (existingUserByName) { //en caso de que ya exista aparecerá este mensaje.
			res.send('El nombre de usuario ya está registrado');
			return;
		}
		if (existingUserByEmail) { //en caso de que ya exista aparecerá este mensaje.
			res.send('El correo electrónico ya está registrado');
			return;
		}
		const hashedPassword = await bcrypt.hash(password, 10); //con esto se crea un hash de la contraseña de valor 10 para cifrar la contraseña y que sea mucho más segura.

		const result = await users.insertOne({ //con esto introduciremos el nuevo usuario en la bbdd
			name: name.toLowerCase(), //convertimos el nombre a minusculas
			email: email,
			password: hashedPassword, //contraseña encriptada
			roles: ["usuario"] //rol por defecto
		});

		req.session.userId = result.insertedId; //se establece la ID del usuario creado.
		res.redirect('/perfil'); //se le redigire al perfil
		client.close(); //se cierra la conexión con la bbdd
	} catch (err) {
		console.error(err);
		res.send('Error registrando usuario');
	}
});

//Mediante una petición GET renderizamos la vista perfil del usuario que entre.
app.get('/perfil', async function (req, res) {
	const userId = req.session.userId; //Se obtiene la ID del usuario logueado.
	if (!userId) { //Si el usuario no está autentificado se le redirige a /login.
		res.redirect('/login');
	} else {
		const client = await MongoClient.connect('mongodb://127.0.0.1:27017'); //Se realiza conexión con la base de datos y con la colección usuarios.
		const db = client.db('proyecto');
		const users = db.collection('users');
		const user = await users.findOne({ _id: userId }); //se busca al usuario correspondiente a la ID obtenida.
		res.render('perfil', { name: user.name, email: user.email, user: user, roles: user.roles }); //se pasan todos los datos del usuario logeado para mostrarse en el perfil.
		client.close(); //se cierra la conexión con la bbdd
	}
});

//En este controlador POST permitimos el cierre de la sesión de un usuario que esté autentificado.
app.post('/logout', function (req, res) {
	req.session.destroy(function (err) { //destruye la sesión del usuario.
		if (err) {
			console.log(err);
		} else {
			res.redirect('/login'); //se le redirige a la vista login al cerrar sesión.
		}
	});
});

//Mediante una petición GET renderizamos la vista Admin.
app.get('/admin', checkAdminRole, async function (req, res) { //comprobar mediante el uso de la función checkAdminRole si el usuario tiene el rol admin
	try {
		const userList = await User.find({}); //se obtiene una lista de los usuarios
		res.render('admin', { name: req.session.name, email: req.session.email, user: req.session.user, userList }); //se renderiza la vista admin con los siguientes parametros
	} catch (error) {
		res.status(500).send('Error al obtener la lista de usuarios');
	}
});

//Mediante una petición GET renderizamos la vista para la edición del usuario seleccionado, userId es la ID del usuario seleccionado.
app.get('/edit/:userId', checkAdminRole, async function (req, res) {
	try {
		const userToEdit = await User.findById(req.params.userId); //Se obtiene el usuario seleccionado buscándolo por su ID.
		res.render('editarUsuario', { user: userToEdit }); //se renderiza la vista de edición de usuario y pasa el objeto usuario como parámetro.
	} catch (error) {
		res.status(500).send('Error al obtener el usuario');
	}
});

//Mediante una petición POST realiza la edición del usuario seleccionado.
app.post('/edit/:userId', checkAdminRole, async function (req, res) {
	try {
		const { name, email, roles } = req.body; //se extraen los datos nombre, email y roles del usuario seleccionado
		await User.findByIdAndUpdate(req.params.userId, { name, email, roles }); //se busca al usuario por su ID y se modifican los datos que tenía por los datos que se hayan introducido en el formulario de la vista.
		res.redirect('/admin'); //te redirige a la vista de admin
	} catch (error) {
		res.status(500).send('Error al editar el usuario');
	}
});

//Mediante una petición POST borramos el usuario seleccionado.
app.post('/delete/:userId', checkAdminRole, async (req, res) => {
	const userId = req.params.userId; //recibimos la ID del usuario a eliminar
	try {
		await User.findByIdAndDelete(userId); //Buscamos y eliminamos al usuario seleccionado por su ID.
		res.redirect('/admin'); //te redirige a la vista de admin
	} catch (error) {
		console.error(error);
		res.status(500).send('Error al borrar el usuario');
	}
});

//Mediante una petición GET renderizamos la vista Editor.
app.get('/editor', checkEditorRole, async function (req, res) { //comprobar mediante el uso de la función checkEditorRole si el usuario tiene el rol editor
	try {
		const noticias = await Noticia.find({}) //Recoger las noticias de la bbdd.
			.populate('autor', 'name') //Obtener solamente el nombre del autor.
			.sort({ fechaCreacion: -1 }); //Ordenar por fecha de creación descendente, es decir, las noticias más recientes primero.

		const events = await Evento.find({}).sort({ start: 1 }); // çOrdenar por fecha de inicio ascendente,los eventos más recientes primero.

		const formattedEvents = events.map(event => ({ //formatear los eventos con el formato pedido
			id: event._id,// Agregar la ID del evento
			title: event.title,
			formattedStart: moment(event.start).format("DD/MM/YYYY HH:mm"),
			formattedEnd: moment(event.end).format("DD/MM/YYYY HH:mm")
		}));

		res.render('editor', { noticias, events: formattedEvents }); //renderizar la vista editor con las noticias y los eventos formateados.
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

// Obtener los eventos desde la base de datos
app.get('/eventos', (req, res) => {
	Evento.find({})
		.then((eventos) => res.send(eventos))
		.catch((err) => res.status(500).send('Error al obtener los eventos', err));
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
	imagen: String,
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

app.get('/noticias', (req, res) => {
	Noticia.find({})
		.populate('autor', 'name') // Para obtener solo el nombre del autor y no su ID.
		.sort({ fechaCreacion: -1 }) // Ordenar por fecha de creación descendente
		.then((noticias) => {
			res.render('noticias', { noticias });
		})
		.catch((err) => res.status(500).send('Error al obtener las noticias', err));
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

app.get('/noticias/crear', checkEditorRole, async function (req, res) {
	try {
		const editorAdminUsers = await User.find({ roles: { $in: ['editor', 'admin'] } });
		res.render('crearNoticia', { users: editorAdminUsers });
	} catch (error) {
		res.status(500).send('Error al obtener los usuarios');
	}
});

app.post('/noticias', upload.single('imagen'), checkEditorRole, async (req, res) => {
	const { titulo, contenido } = req.body;
	const autor = req.session.userId; // Obtener el ID del usuario logeado desde la sesión
	const imagen = req.file ? '/uploads/' + req.file.filename : '/uploads/prueba.gif';

	try {
		const nuevaNoticia = new Noticia({
			titulo,
			contenido,
			imagen,
			autor // Establece la ID del usuario como referencia
		});
		await nuevaNoticia.save();
		res.redirect("/editor");
	} catch (err) {
		res.status(500).send('Error al crear la noticia: ' + err);
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

app.post('/noticias/:id', checkEditorRole, (req, res) => {
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

//borrar
app.post('/noticias/:id/borrar', checkEditorRole, async function (req, res) {
	const noticiaId = req.params.id;
	await Noticia.findByIdAndDelete(noticiaId);
	res.redirect('/editor');
});