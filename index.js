// Importar los paquetes necesarios que hemos instalado previamente
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const fullcalendar = require('fullcalendar');
const moment = require('moment');
var path = require('path')
const cron = require('node-cron');
const multer = require('multer');

//Crear una instancia de la aplicación
const app = express();

//Con esto configuramos la ruta en el cual se encuentran los archivos estaticos. Esto nos permite acceder a los archivos CSS, JS e imágenes de su interior.
app.use('/public', express.static(path.join(__dirname, 'public')))

// Configurar el middleware bodyParser para analizar las solicitudes POST
app.use(bodyParser.urlencoded({
	extended: false
}));
app.use(bodyParser.json());


// Ejecutar el cron job cada 5 minutos para borrar los eventos pasados
cron.schedule('*/5 * * * *', async () => {
	try {
		const currentDate = new Date();
		await Evento.deleteMany({ end: { $lt: currentDate } }); //borra los eventos los cuales su fecha de finalización sea anterior a la actual.
	} catch (err) {
		console.error('Error al eliminar los eventos automáticamente', err);
	}
});

//Iniciar el servidorv en el puerto 3000
app.listen(3000, () => console.log('Servidor iniciado en http://127.0.0.1:3000'));


//Con el siguiente código configuramos la subida de archivos para usarlo en las noticias.
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

//Creamos una instancia de multer con la configuración de almacenamiento
const upload = multer({ storage: storage });

//Configuramos Ruta para manejar la carga de archivos
app.post('/upload', upload.single('imagen'), (req, res) => {
	if (req.file) {
		const imageUrl = '/uploads/' + req.file.filename;
		res.send('Archivo subido correctamente: ' + imageUrl);
	} else {
		res.status(400).send('No se ha proporcionado ningún archivo');
	}
});

//establecemos que el motor de las vistas sea EJS.
app.set('view engine', 'ejs');


//Autentificación

//Importamos paquetes necesarios para la autentificación de archivos.
const bcrypt = require('bcrypt');
const session = require('express-session');
const {
	MongoClient
} = require('mongodb');
const MongoDBStore = require('connect-mongodb-session')(session);

//Aquí definimos donde se guardan las sesiones de los usuarios.
const store = new MongoDBStore({
	uri: 'mongodb://127.0.0.1:27017/proyecto',
	collection: 'sessions'
});

//Configuramos el middleware para las sesiones de los usuarios.
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
		unique: true,
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
	},
	profileImage: {
    type: String
  },
	color: {
    type: String,
    default: '#8c72cc' // Color de borde predeterminado
  }
});

const User = mongoose.model('User', userSchema);

//Verificar si un usuario está autentificado.
app.use(async function (req, res, next) {
	const userId = req.session.userId; //Se obtiene la ID del usuario logueado
	if (userId) {
		const client = await MongoClient.connect('mongodb://127.0.0.1:27017'); //Se realiza conexión con la base de datos y con la colección usuarios.
		const db = client.db('proyecto');
		const users = db.collection('users');
		const user = await users.findOne({ _id: userId }); //se verifica si el usuario existe en la BBDD buscando por su id.
		res.locals.user = user; //asigna el usuario autentificado
		res.locals.currentUser = user.name; // Agrega el nombre de usuario actual a las variables locales
		client.close(); //se cierra la conexión con la bbdd
	} else {
		res.locals.user = null; //asigna como usuario autentificado null
		res.locals.currentUser = null; // Establece el nombre de usuario actual como null cuando no está autenticado
	}
	next();
})

//Verificar si un usuario dispone del rol editor para acceder a ciertas vistas y controladores.
async function checkEditorRole(req, res, next) {
	const userId = req.session.userId; //Se obtiene la ID del usuario logueado
	if (!userId) { //si no está autentificado se le redigire a login
		res.redirect('/login');
	} else {
		const client = await MongoClient.connect('mongodb://127.0.0.1:27017'); //Se realiza conexión con la base de datos y con la colección usuarios.
		const db = client.db('proyecto');
		const users = db.collection('users');
		const user = await users.findOne({ _id: userId });
		if (user.roles.includes('editor') || user.roles.includes('admin')) { //verificar si incluye el rol editor y/o admin para permitir o denegar acceso.
			next();
		} else {
			res.status(403).send('No tienes permisos para acceder a esta página');
		}
		client.close(); //se cierra la conexión con la bbdd
	}
}

//Verificar si un usuario dispone del rol admin para acceder a ciertas vistas y controladores.
async function checkAdminRole(req, res, next) {
	const userId = req.session.userId;
	if (!userId) { //si no está autentificado se le redigire a login
		res.redirect('/login');
	} else {
		const client = await MongoClient.connect('mongodb://127.0.0.1:27017');  //Se realiza conexión con la base de datos y con la colección usuarios.
		const db = client.db('proyecto');
		const users = db.collection('users');
		const user = await users.findOne({ _id: userId });
		if (user.roles.includes('admin')) { //verificar si incluye el rol  admin para permitir o denegar acceso.
			next();
		} else {
			res.status(403).send('No tienes permisos para acceder a esta página');
		}
		client.close(); //se cierra la conexión con la bbdd
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

		const defaultImageUrl = 'https://img.freepik.com/free-icon/user_318-563642.jpg';

		const result = await users.insertOne({ //con esto introduciremos el nuevo usuario en la bbdd
			name: name.toLowerCase(), //convertimos el nombre a minusculas
			email: email,
			password: hashedPassword, //contraseña encriptada
			roles: ["usuario"], //rol por defecto
			profileImage: defaultImageUrl,
			color: '#8c72cc'
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
		res.render('perfil', { userId: userId, name: user.name, email: user.email, user: user, roles: user.roles, profileImage: user.profileImage, color: user.color }); //se pasan todos los datos del usuario logeado para mostrarse en el perfil.
		client.close(); //se cierra la conexión con la bbdd
	}
});

app.get('/perfil/editar', function (req, res) {
	const userId = req.session.userId;
	if (!userId) {
		res.redirect('/login');
	} else {
		User.findById(userId)
			.then(user => {
				res.render('editarPerfil', { user });
			})
			.catch(err => {
				console.error('Error al obtener el perfil del usuario:', err);
				res.send('Error al obtener el perfil del usuario');
			});
	}
});

app.post('/perfil', async function (req, res) {
  const userId = req.session.userId;
  if (!userId) {
    res.redirect('/login');
  } else {
    const { name, email, password, profileImage, color } = req.body;
    try {
      const user = await User.findById(userId);
      user.name = name;
      user.email = email;
      if (password) {
        const hashedPassword = await bcrypt.hash(password, 10);
        user.password = hashedPassword;
      }
      user.profileImage = profileImage; // Asignar la URL de la imagen de perfil
			user.color = color;
      await user.save();
      res.redirect('/perfil');
    } catch (error) {
      console.error('Error al guardar los cambios del perfil:', error);
      res.send('Error al guardar los cambios del perfil');
    }
  }
});

app.get('/perfil/:nombreUsuario', async function (req, res) {
  const nombreUsuario = req.params.nombreUsuario; // Obtener el nombre de usuario desde la URL
  try {
    const user = await User.findOne({ name: nombreUsuario }); // Buscar al usuario por su nombre
    if (user) {
      res.render('perfil', { user: user, userId: req.session.userId }); // Pasar el usuario encontrado a la vista
    } else {
      res.status(404).send('Usuario no encontrado');
    }

  } catch (error) {
    console.error('Error al obtener el perfil del usuario:', error);
    res.send('Error al obtener el perfil del usuario');
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

// Obtener los eventos desde la base de datos, además permite ver los eventos en formato JSON.
app.get('/eventos', (req, res) => {
	Evento.find({})
		.then((eventos) => res.send(eventos))
		.catch((err) => res.status(500).send('Error al obtener los eventos', err));
});

//Mediante una petición GET renderizamos la vista de crearEvento
app.get('/eventos/crear', checkEditorRole, (req, res) => { //verifica que el rol sea editor y/o admin
	res.render('crearEvento');
});

//Manejamos la petición POST para crear noticias
app.post('/eventos/crear', checkEditorRole, (req, res) => { //verifica que el rol sea editor y/o admin
	const { title, start, end } = req.body; //se extraen los datos title, start y end introducidos en el formulario.
	const currentDate = new Date();

	if (new Date(start) < currentDate) {  //si la fecha y hora de inicio es posterior a la actual no permite crear evento
		return res.status(400).send('La fecha de inicio no puede ser anterior a la fecha actual');
	}

	if (moment(end).isBefore(start)) { //si la fecha y hora de finalización es posterior a la de inicio no se permite crear evento
		return res.status(400).send('La fecha de finalización debe ser posterior a la fecha de inicio');
	}

	const nuevoEvento = new Evento({ //cremos el evento con los datos introducidos.
		title,
		start,
		end
	});

	nuevoEvento.save() //el evento se guarda en la BBDD.
		.then(() => res.redirect('/editor')) //redirigimos a la vista editor
		.catch((err) => res.status(500).send('Error al crear el evento: ' + err));
});

//Mediante una petición GET renderizamos la vista de editarEvento
app.get('/eventos/:id/editar', checkEditorRole, async (req, res) => { //verifica que el rol sea editor y/o admin
	const eventId = req.params.id; //Se obtiene la ID del evento.

	try {
		const evento = await Evento.findById(eventId).exec(); //se realiza una consulta a la BBDD mediante la ID del evento.

		if (!evento) {
			return res.status(404).send('No se encontró el evento');
		}

		//Formatemos las fechas con el siguiente formato usando moment.
		const startFormatted = moment(evento.start).format('YYYY-MM-DDTHH:mm');
		const endFormatted = moment(evento.end).format('YYYY-MM-DDTHH:mm');

		res.render('editarEvento', { evento, startFormatted, endFormatted }); //renderizamos la vista editarEvento pasando como parametros al evento y las fechas formateadas.
	} catch (error) {
		console.error('Error al obtener el evento para editar', error);
		res.status(500).send('Error al obtener el evento para editar');
	}
});

//Mediante una petición POST procedemos a la edición de los eventos
app.post('/eventos/:id/actualizar', checkEditorRole, (req, res) => { //verifica que el rol sea editor y/o admin
	const eventId = req.params.id; //Se obtiene la ID del evento.
	const { title, start, end } = req.body; //se extraen los datos title, start y end del formulario.
	const currentDate = new Date();

	if (new Date(start) < currentDate) { //si la fecha y hora de inicio es posterior a la actual no permite crear evento
		return res.status(400).send('La fecha de inicio no puede ser anterior a la fecha actual');
	}

	if (moment(end).isBefore(start)) { //si la fecha y hora de finalización es posterior a la de inicio no se permite crear evento
		return res.status(400).send('La fecha de finalización debe ser posterior a la fecha de inicio');
	}

	Evento.findByIdAndUpdate(eventId, { title, start, end }) //buscamos al evento por su ID y modifcamos con los datos introducidos.
		.then(() => res.redirect("/editor")) //Redirigimos a la vista editor
		.catch((err) => res.status(500).send('Error al actualizar el evento: ' + err));
});

//Manejamos una petición POST para borrar eventos
app.post('/eventos/:id/borrar', checkEditorRole, (req, res) => { //verifica que el rol sea editor y/o admin
	const eventId = req.params.id; //Se obtiene la ID del evento.

	Evento.findByIdAndDelete(eventId) //borramos el evento por su id
		.then(() => res.redirect("/editor")) //Redirigimos a la vista editor
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
	},
	comentarios: [
		{
			usuario: {
				type: mongoose.Schema.Types.ObjectId,
				ref: 'User',
			},
			nombreUsuario: String,
			contenido: String,
			fecha: {
				type: Date,
				default: Date.now,
			},
			respuestas: [ // Campo para almacenar las respuestas
        {
          usuario: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
          },
          nombreUsuario: String,
          contenido: String,
          fecha: {
            type: Date,
            default: Date.now,
          },
        },
      ],
		},
	],
});
const Noticia = mongoose.model('Noticia', NoticiaSchema);


//Mediante una petición GET renderizamos la vista de noticias 
app.get('/noticias', (req, res) => {
	Noticia.find({})
		.populate('autor', 'name') //Obtenenemos solo el nombre del autor y no su ID.
		.sort({ fechaCreacion: -1 }) //Ordenar por fecha de creación descendente
		.then((noticias) => {
			res.render('noticias', { noticias }); //renderizamos las noticias
		})
		.catch((err) => res.status(500).send('Error al obtener las noticias', err));
});

//Mediante una petición GET renderizamos la vista de crear noticias
app.get('/noticias/crear', checkEditorRole, async function (req, res) { //verifica que el rol sea editor y/o admin
	try {
		const editorAdminUsers = await User.find({ roles: { $in: ['editor', 'admin'] } }); //buscamos los usuarios con los roles editor y admin que son los unicos que pueden crear, editar y borrar noticias.
		res.render('crearNoticia', { users: editorAdminUsers }); //renderizamos la vista de crearNoticia pasando de parámetro un array con los usuarios con esos roles.
	} catch (error) {
		res.status(500).send('Error al obtener los usuarios');
	}
});

//Manejamos la petición POST para crear noticias
app.post('/noticias', upload.single('imagen'), checkEditorRole, async (req, res) => {  //verifica que el rol sea editor y/o admin
	const { titulo, contenido } = req.body; //Obtenemos los campos titulo y contenido del formulario
	const autor = req.session.userId; //Obtenemos el ID del usuario logeado desde la sesión para incluirlo como autor de la noticia.
	const imagen = req.file ? '/uploads/' + req.file.filename : '/uploads/prueba.png'; //Establecemos la imagen subida como imagen, en caso de no se haya subido ninguna se pondrá prueba.png

	try {
		const nuevaNoticia = new Noticia({ //cremos la noticias con los datos introducidos.
			titulo,
			contenido,
			imagen,
			autor // Establece la ID del usuario como referencia
		});
		await nuevaNoticia.save(); //guardamos la noticia en la BBDD
		res.redirect("/editor"); //redigirimos a la vista editor
	} catch (err) {
		res.status(500).send('Error al crear la noticia: ' + err);
	}
});

//Mediante una petición GET renderizamos vista de editar noticias con la noticia seleccionada.
app.get('/noticias/:id/editar', checkEditorRole, async function (req, res) {  //verifica que el rol sea editor y/o admin
	try {
		const noticiaId = req.params.id; //Se obtiene la ID de la noticia.
		const noticia = await Noticia.findById(noticiaId); //Buscamos la noticia por su ID
		const editorAdminUsers = await User.find({ roles: { $in: ['editor', 'admin'] } });  //buscamos los usuarios con los roles editor y admin que son los unicos que pueden crear, editar y borrar noticias.
		res.render('editarNoticia', { noticia, users: editorAdminUsers }); //renderizamos la vista de editarNoticia pasando como parámetro las noticias y el array con los usuarios con el rol editor y/o admin.
	} catch (error) {
		res.status(500).send('Error al obtener la noticia');
	}
});

//Manejamos la petición POST para editar noricias.
app.post('/noticias/:id', checkEditorRole, (req, res) => { //verifica que el rol sea editor y/o admin
	const noticiaId = req.params.id; //Se obtiene la ID de la noticia.
	const { titulo, contenido, autor } = req.body; //Obtenemos los campos titulo, contenido y autor del formulario

	//Buscar el usuario por su nombre y obtener su ID para establecer el autor correctamente con su nombre
	User.findOne({ name: autor })
		.then((user) => {
			if (!user) {
				throw new Error('Usuario no encontrado');
			}
			const autor = user._id;

			// Actualizamos la noticia por su ID introduciendo los campos del formulario.
			Noticia.findByIdAndUpdate(noticiaId, { titulo, contenido, autor })
				.then(() => {
					res.redirect('/editor'); //redirigimos a la vista editor.
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

//Mediante una petición GET renderizamos la ficha de la noticia seleccionada
app.get('/noticias/:id', (req, res) => {
	const noticiaId = req.params.id; //Se obtiene la ID de la noticia.

	Noticia.findById(noticiaId) //buscamos a la noticia por su ID
		.populate('autor', 'name') //Obtenemos solo el nombre del autor
		.populate('comentarios.usuario', 'name color') // Agregamos el campo "color" del usuario a los comentarios
		.then((noticia) => {
			res.render('fichaNoticia', { noticia, usuario: req.session.userId ? req.session.userId : null });		})
		.catch((error) => {
			console.log('Error al obtener la noticia:', error);
			res.status(500).send('Error al obtener la noticia');
		});
});

//Manejamos una petición POST para borrar las noticias
app.post('/noticias/:id/borrar', checkEditorRole, async function (req, res) {  //verifica que el rol sea editor y/o admin
	const noticiaId = req.params.id; //Se obtiene la ID de la noticia.
	await Noticia.findByIdAndDelete(noticiaId); //busca la noticia por ID y la elimina
	res.redirect('/editor');
});



// Manejar la adición y respuesta de comentarios
app.post('/noticias/:id/comentarios', async (req, res) => {
  const noticiaId = req.params.id;
  const comentarioId = req.body.comentarioId;
  const contenido = req.body.contenido;
  const userId = req.session.userId;

  if (!userId) {
    res.status(401).send('Debe iniciar sesión para comentar.');
    return;
  }

  try {
    const user = await User.findById(userId);
    const noticia = await Noticia.findById(noticiaId);

    if (!noticia) {
      res.status(404).send('Noticia no encontrada.');
      return;
    }

    if (comentarioId) {
      const comentarioExistente = noticia.comentarios.find(
        comentario => comentario._id.toString() === comentarioId
      );

      if (!comentarioExistente) {
        res.status(404).send('Comentario no encontrado.');
        return;
      }

      // Agregar la respuesta al comentario existente
      comentarioExistente.respuestas.push({
        usuario: user._id,
        nombreUsuario: user.name,
        contenido,
        fecha: new Date()
      });

      await noticia.save();
      res.redirect('back');
      return; // Salir del controlador después de guardar la respuesta
    }

    // Agregar un nuevo comentario a la noticia
    noticia.comentarios.push({
      usuario: user._id,
      nombreUsuario: user.name,
      contenido,
      fecha: new Date()
    });

    await noticia.save();

    res.redirect('back');
  } catch (error) {
    console.error('Error al agregar o responder al comentario:', error);
    res.status(500).send('Error al agregar o responder al comentario.');
  }
});



// Manejar la eliminación de comentarios
app.post('/noticias/:id/comentarios/:comentarioId/borrar', async (req, res) => {
  const noticiaId = req.params.id;
  const comentarioId = req.params.comentarioId;

  try {
    const noticia = await Noticia.findById(noticiaId);

    if (!noticia) {
      res.status(404).send('Noticia no encontrada.');
      return;
    }

    // Filtrar y eliminar el comentario por su ID
    noticia.comentarios = noticia.comentarios.filter(comentario => comentario._id.toString() !== comentarioId);
    await noticia.save();

    res.redirect('back');
  } catch (error) {
    console.error('Error al borrar el comentario:', error);
    res.status(500).send('Error al borrar el comentario.');
  }
});

// Borrar una respuesta de un comentario
app.post('/noticias/:id/comentarios/:comentarioId/respuestas/:respuestaId/borrar', async (req, res) => {
  const noticiaId = req.params.id;
  const comentarioId = req.params.comentarioId;
  const respuestaId = req.params.respuestaId;
  const userId = req.session.userId;

  if (!userId) {
    res.status(401).send('Debe iniciar sesión para realizar esta acción.');
    return;
  }

  try {
    const noticia = await Noticia.findById(noticiaId);
    if (!noticia) {
      res.status(404).send('Noticia no encontrada.');
      return;
    }

    const comentario = noticia.comentarios.find(
      comentario => comentario._id.toString() === comentarioId
    );
    if (!comentario) {
      res.status(404).send('Comentario no encontrado.');
      return;
    }

    const respuesta = comentario.respuestas.find(
      respuesta => respuesta._id.toString() === respuestaId
    );
    if (!respuesta) {
      res.status(404).send('Respuesta no encontrada.');
      return;
    }

    // Verificar si el usuario tiene permisos para borrar la respuesta
    const user = await User.findById(userId);
    if (!user.roles.includes('admin') && !user.roles.includes('editor') && user._id.toString() !== respuesta.usuario.toString()) {
      res.status(403).send('No tiene permisos para borrar esta respuesta.');
      return;
    }

    // Borrar la respuesta
    comentario.respuestas.pull(respuesta._id);
    await noticia.save();

    res.redirect('back');
  } catch (error) {
    console.error('Error al borrar la respuesta:', error);
    res.status(500).send('Error al borrar la respuesta.');
  }
});
