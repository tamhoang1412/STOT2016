var socketIO = require('socket.io');
var uuid = require('node-uuid');
var static = require('node-static');
//
// Create a node-static server instance to serve the './public' folder
//

var file = new(static.Server)('./client');

var server = require('http').createServer(function (request, response) {
    request.addListener('end', function () {
        //
        // Serve files!
        //
        file.serve(request, response);
    }).resume();
});

// Create and configure socket.io 
//
var io = socketIO.listen(server, {log: false});

var port = process.env.PORT || 8080;

server.listen(port);
console.log('Listening on port: ' + port);

// keeping track of connections
var sockets = {};

io.sockets.on('connection', function(socket) {
	console.log("server starts connection");
	var id;

	// determine an identifier that is unique for us.

	do {
		id = uuid.v4();
	} while (sockets[id]);

	// we have a unique identifier that can be sent to the client

	sockets[id] = socket;
	socket.emit('your-id', id);

	// remove references to the disconnected socket
	socket.on('disconnect', function() {
		console.log("server disconnect");
		sockets[socket] = undefined;
		delete sockets[socket];
	});

	// when a message is received forward it to the addressee
	socket.on('message', function(message) {
		console.log("server mes");
		if (sockets[message.to]) {
			sockets[message.to].emit('message', message);
		} else {
			socket.emit('disconnected', message.from);
		}
	});

	// when a listener logs on let the media streaming know about it
	socket.on('logon', function(message) {
		console.log("server logon");
		if (sockets[message.to]) {
			sockets[message.to].emit('logon', message);
		} else {
			socket.emit('error', 'Does not exsist at server.');
		}
	});

	socket.on('logoff', function(message) {
		console.log("server logoff");
		if (sockets[message.to]) {
			sockets[message.to].emit('logoff', message);
		} else {
			socket.emit('error', 'Does not exsist at server.');
		}
	});
});


