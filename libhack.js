var WebSocketClient = require("websocket").client;
var EventEmitter = require('events').EventEmitter;
var util = require("util");

exports.Client = Client;

var STATE = {
	initial: 0,
	connected: 1
};

var handlerMap = {
	onlineSet: function(client, json) {
		client.emit('userlist', {nicks: json.nicks, channel: client.channelName});
	},
	onlineAdd: function(client, json) {
		client.emit('logged', {nick: json.nick, bLogin: true, channel: client.channelName});
	},
	onlineRemove: function(client, json) {
		client.emit('logged', {nick: json.nick, bLogin: false, channel: client.channelName});
	},
	chat: function(client, json) {
		client.emit('message', {nick: json.nick, message: json.text, channel: client.channelName});
	},
	warn: function(client, json) {
		client.emit('error', {nick: '&system', message: json.text, channel: client.channelName});
		client.disconnect();
	},
	'': function(client, message) {
		client.emit('error', {nick:'&system', message: message, channel: client.channelName});
	}
};

function Client(serverHost, channelName, nickName, password) {
	EventEmitter.call(this);
	var self = this;

	this.serverHost = serverHost;
	this.channelName = channelName;
	this.nickName = nickName;

	this.s = new WebSocketClient();
	this.s.on('connectFailed', function(error) {
		self.log(error);
	});
	this.s.on('connect', function(cxn) {

		self.cxn = cxn;
		self.log('connected');

		self.send({cmd: 'join', channel: channelName, nick: nickName+(password?'#'+password:'')});
		self.emit('begin', {nick:'&system', message: 'Connection established', channel: self.channelName});

		self.setPingEnabled(true);
		cxn.on('error', function(error) {
			client.emit('error', {nick:'&system', message: error, channel: self.channelName});
			self.setPingEnabled(false);
			self.log(error);
		});
		cxn.on('message', function(message) {
			if (message.type == 'utf8')
				message = message.utf8Data;
			else
				console.log('Unknown message type: '+message.type);


			self.log(message);
			try {
				var json = JSON.parse(message);
				var handler;
				if (json && json.cmd && (handler = handlerMap[json.cmd]))
					handler(self, json);
				else
					handler[''](self, message);
			} catch(e) {
				console.log(String(e) + (e.stack ? '\r\n' + String(e.stack) : ''));
			}
		});
		cxn.on('close', function() {
			self.emit('end', {nick:'&system', message: 'Connection closed', channel: self.channelName});
			self.setPingEnabled(false);
			self.log('closed');
		});
	});
	this.log('LOGIN...');
}

util.inherits(Client, EventEmitter);

Client.prototype.setPingEnabled = function(bEnabled) {
	var self = this;

	if (this.pingInterval)
		clearInterval(this.pingInterval);
	this.pingInterval = null;

	if (!bEnabled) return;
	this.pingInterval = setInterval(function() {
		self.send({cmd: 'ping'});
	}, 50000);
}
Client.prototype.sendMessage = function(msg) {
	this.send({cmd: 'chat', text: msg});
}
Client.prototype.log = function(msg) {
	console.log(msg);
}
Client.prototype.send = function(jsonData) {
	this.log(JSON.stringify(jsonData));
	this.cxn.sendUTF(JSON.stringify(jsonData));
}
Client.prototype.connect = function() {
	this.s.connect(this.serverHost);
}
Client.prototype.disconnect = function() {
	this.cxn.close();
}


