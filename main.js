/* eslint no-console: 'off' */
const { app, BrowserWindow, Menu, Tray } = require("electron") // app
// const applescript = require ("applescript")
const osascript = require('node-osascript');
const net = require("net") // TCP server
const robot = require('robotjs') // keyboard and mouse events
const os = require('os') // for appple script
const child_process = require('child_process') // Shell and file actions
const fs = require('fs')
const path = require('path')
var iconpath = path.join(__dirname, 'img/favicon.png')
let tray = null

let server
let win
let port = 10001;
// var cmd = '{ "key":"tab", "type":"press", "modifiers":["alt"] }'
// var cmd = '{ "key":"tab", "type":"processOSX","processName":"Powerpoint" "modifier":["alt"] }'
// var cmd = '{ "type":"shell","shell":"dir" }'
// var cmd = '{ "type":"file","path":"C:/Barco/InfoT1413.pdf" }'
// var cmd = '{ "type":"string","msg":"C:/Barco/InfoT1413.pdf" }'

function createWindow() {
	// create window
	win = new BrowserWindow({
		width: 410,
		height: 600,
		resizable: false,
		icon: iconpath,
		webPreferences: {
			nodeIntegration: true
		}
	})

	win.setMenu(null)
	// load the index.html of the app
	win.loadFile('index.html')

	win.on('minimize', function (event) {
		event.preventDefault();
		win.hide();
	});

	win.on('close', function (event) {
		if (!app.isQuiting) {
			event.preventDefault();
			win.hide();
		}

		return false;
	});

	win.on('activate', function () {
		// appIcon.setHighlightMode('always')
		win.show()
	})

	win.on('closed', () => {
		// kill windows or so
		win = null
	})


	createListener()
}

// Catch messages from front-ed.
const { ipcMain } = require('electron')
ipcMain.on('asynchronous-message', (event, arg) => {
	console.log(arg)
	if (arg != port) {
		port = arg;
		console.log('port number changed, closing server');
		server.close();
		createListener();
		event.reply('asynchronous-reply', 'ok')
	}
})


app.whenReady().then(() => {
	if (process.platform == "darwin") {
		tray = new Tray(path.join(__dirname, 'img/macOSmenuiconTemplate.png'));
	} else {
		tray = new Tray(path.join(__dirname, 'img/favicon.png'));
	}
	createWindow();
	var contextMenu = Menu.buildFromTemplate([
		{
			label: 'Show App', click: function () {
				win.show()
			}
		},
		{
			label: 'Quit', click: function () {
				app.isQuiting = true;
				server.close()
				console.log('user quit')
				app.quit();
				win.destroy()
			}
		}
	])
	tray.setContextMenu(contextMenu)
})
app.on('before_quit', () => {
	isQuiting = true
	server.close()
	console.log('user quit')
})

app.on('windows-all-closed', () => {
	// On macOS it is common for applications and their menu bar
	// to stay active until the user quits explicitly with Cmd + Q
	if (os.platform() !== 'darwin') {
		app.quit()
	}
})

app.on('activate', () => {
	// On macOS it's common to re-create a window in the app when the
	// dock icon is clicked and there are no other windows open.
	if (win === null) {
		createWindow()
	}
})
if (process.platform == "darwin") { app.dock.setIcon(path.join(__dirname, 'img/logo.png')) };

function createListener() {
	// Load socket
	console.log('waiting for connection...')
	portInUse(port, function (returnValue) {
		console.log('Port already active?', returnValue);
	});
}

var portInUse = function (port, callback) {
	console.log('port', port)
	server = net.createServer((socket) => {
		socket.write('Listener active\r\n');
		socket.pipe(socket);
		console.log("connected")
		socket.on('end', () => {
			console.log('client ended connection, waiting for connection...')
		})
		socket.on('connect', () => {
			console.log("connected")
		})
		socket.on('data', (data) => {
			try {
				processIncomingData(JSON.parse(data))
			} catch (e) {
				console.log(e)
				processIncomingData2(data)
			}
		})
		server.on('error', function (e) {
			callback(true);
		});
		server.on('listening', function (e) {
			server.close();
			callback(false);
		});
	});
	server.listen(port, '0.0.0.0');

};


function findKeyCode(key) {
	for (item of keys) {
		if (key.toLowerCase() == item.key || key == item.vKeyCode) {
			return item.code
			break;
		}
	}
}

function processKeyData(key, modifiers) {
	let script = null;
	let modifiersInString = '{'
	for (item of modifiers) {
		if (item == 'cmd') item = 'command';
		modifiersInString += item + ' down,';
	}
	modifiersInString = modifiersInString.substring(0, modifiersInString.length - 1)
	modifiersInString += '}'

	if (modifiers.length) {
		if (key.length > 1) {
			script = `key code ${findKeyCode(key)} using ${modifiersInString}`;
		} else {
			script = `keystroke \"${key}\" using ${modifiersInString}`;
		}
	} else {
		if (key.length > 1) {
			script = `key code ${findKeyCode(key)}`;
		} else {
			script = `keystroke \"${key}\"`;
		}
	}
	console.log(script)
	return script
}

function processIncomingData(data) {
	console.log(data)
	switch (data.type) {
		case 'press':
			if (process.platform == "darwin") {
				osascript.execute('tell application \"System Events\"\n' + processKeyData(data.key, data.modifiers) + '\nend tell', function (err, result, raw) {
					if (err) return console.error(err)
					console.log(result, raw)
				});
			} else {
				robot.keyTap(data.key, data.modifiers)
			}
			break;

		case 'down':
			robot.keyToggle(data.key, 'down', data.modifiers)
			break;

		case 'up':
			robot.keyToggle(data.key, 'up', data.modifiers)
			break;

		case 'processOSX':
			let script = null;
			if (data.processName == 'null' || data.processName == '') {
				if (process.platform == "darwin") {
					osascript.execute('tell application \"System Events\"\n' + processKeyData(data.key, data.modifiers) + '\nend tell', function (err, result, raw) {
						if (err) return console.error(err)
						console.log(result, raw)
					});
				}
			} else {
				if (process.platform == "darwin") {
					osascript.execute(`tell application \"System Events\"\ntell process \"${data.processName}\"\nset frontmost to true\n` + processKeyData(data.key, data.modifiers) + '\nend tell\nend tell', function (err, result, raw) {
						if (err) return console.error(err)
						console.log(result, raw)
					});
				}
			}

			break;

		case 'shell':
			child_process.exec(data.shell, (error, stdout, stderr) => {
				if (error) {
					console.log(`error: ${error.message}`);
					return;
				}
				if (stderr) {
					console.log(`stderr: ${stderr}`);
					return;
				}
				console.log(`stdout: ${stdout}`);
			})
			break;

		case 'string':
			robot.typeString(data.msg);
			break;

		case 'file':
			if (process.platform == "darwin") {

				child_process.exec('open ' + data.path, function (err, stdout, stderr) {
					if (err) {
						console.error(err);
						return;
					}
					console.log(stdout);
					process.exit(0);// exit process once it is opened
				})
			} else {
				child_process.exec('start ' + data.path, function (err, stdout, stderr) {
					if (err) {
						console.error(err);
						return;
					}
					console.log(stdout);
					process.exit(0);// exit process once it is opened
				})
			}
			break;
	}


}
function processIncomingData2(data) {
	let incomingString = data.toString('utf8')
	console.log(incomingString)
	let key1, key2, key3
	let type = incomingString.slice(1, incomingString.search('>'))

	switch (type) {
		case 'SK':
			key1 = incomingString.slice(incomingString.search('>') + 1)
			hitHotkey(key1)
			break;
		case 'SPK':
			key1 = incomingString.slice(incomingString.search('>') + 1)
			hitHotkey(key1)
			break;
		case 'KCOMBO':
			key1 = incomingString.slice(8, incomingString.search('<AND>'))
			key2 = incomingString.slice(incomingString.search('<AND>') + 5)
			hitHotkey(key2, key1)
			break;
		case 'KTRIO':
			key1 = incomingString.slice(7, incomingString.search('<AND>'))
			key2 = incomingString.slice(incomingString.search('<AND>') + 5, incomingString.search('<AND2>'))
			key3 = incomingString.slice(incomingString.search('<AND2>') + 6)
			hitHotkey(key3, [key1, key2])
			break;
		case 'KPRESS':
			key1 = incomingString.slice(8, incomingString.search('<AND>'))
			key2 = incomingString.slice(incomingString.search('<AND>') + 5)
			robot.keyToggle(key2, 'down', key1)
			break;
		case 'KRELEASE':
			key1 = incomingString.slice(8, incomingString.search('<AND>'))
			key2 = incomingString.slice(incomingString.search('<AND>') + 5)
			robot.keyToggle(key2, 'up', key1)
			break;
		case 'MSG':
			robot.typeString(incomingString.slice(incomingString.search('>') + 1))
			break;
	}
}

function hitHotkey(key, modifier) {
	if (os.platform() === 'darwin') {
		if (modifier) {
			return exec(`Script="tell app \\"System Events\\" to keystroke ${key} using ${modifier} down" osascript -e "$Script"`)
		} else {
			return exec(`Script="tell app \\"System Events\\" to keystroke ${key}" osascript -e "$Script"`)
		}
	} else {
		if (modifier) {
			return robot.keyTap(key, modifier)
		} else {
			return robot.keyTap(key)
		}
	}
}

const keys = [
	{ key: 'cmd', code: 55, vKeyCode: '0x37' },
	{ key: 'command', code: 55, vKeyCode: '0x37' },
	{ key: 'alt', code: 58, vKeyCode: '0x3A' },
	{ key: 'option', code: 58, vKeyCode: '0x3A' },
	{ key: 'ctrl', code: 59, vKeyCode: '0x3B' },
	{ key: 'control', code: 59, vKeyCode: '0x3B' },
	{ key: 'shift', code: 56, vKeyCode: '0x38' },
	{ key: 'right_shift', code: 60, vKeyCode: '0x3C' },
	{ key: 'right_alt', code: 61, vKeyCode: '0x3D' },
	{ key: 'right_ctrl', code: 62, vKeyCode: '0x3E' },
	{ key: 'fn', code: 63, vKeyCode: '0X3F' },

	{ key: 'f1', code: 122, vKeyCode: '0x7A' },
	{ key: 'f2', code: 120, vKeyCode: '0x78' },
	{ key: 'f3', code: 99, vKeyCode: '0x63' },
	{ key: 'f4', code: 118, vKeyCode: '0x76' },
	{ key: 'f5', code: 96, vKeyCode: '0x60' },
	{ key: 'f6', code: 97, vKeyCode: '0x61' },
	{ key: 'f7', code: 98, vKeyCode: '0x62' },
	{ key: 'f8', code: 99, vKeyCode: '0x64' },
	{ key: 'f9', code: 100, vKeyCode: '0x65' },
	{ key: 'f10', code: 109, vKeyCode: '0x6D' },
	{ key: 'f11', code: 103, vKeyCode: '0x67' },
	{ key: 'f12', code: 111, vKeyCode: '0x6F' },
	{ key: 'f13', code: 105, vKeyCode: '0x69' },
	{ key: 'f14', code: 107, vKeyCode: '0x6B' },
	{ key: 'f15', code: 113, vKeyCode: '0x71' },
	{ key: 'f16', code: 106, vKeyCode: '0x6A' },
	{ key: 'f17', code: 64, vKeyCode: '0x40' },
	{ key: 'f18', code: 79, vKeyCode: '0x4F' },
	{ key: 'f19', code: 80, vKeyCode: '0x50' },
	{ key: 'f20', code: 90, vKeyCode: '0x5A' },

	{ key: 'escape', code: 53, vKeyCode: '0x35' },
	{ key: 'esc', code: 53, vKeyCode: '0x35' },
	{ key: 'enter', code: 36, vKeyCode: '0x24' },
	{ key: 'return', code: 76, vKeyCode: '0x24' },
	{ key: 'space', code: 49, vKeyCode: '0x31' },
	{ key: 'spacebar', code: 49, vKeyCode: '0x31' },

	{ key: 'delete', code: 51, vKeyCode: '0x33' },
	{ key: 'backspace', code: 117 },
	{ key: 'up', code: 126, vKeyCode: '0x7E' },
	{ key: 'down', code: 125, vKeyCode: '0x7D' },
	{ key: 'left', code: 123, vKeyCode: '0x7B' },
	{ key: 'right', code: 124, vKeyCode: '0x7C' },
	{ key: 'home', code: 115, vKeyCode: '0x73' },
	{ key: 'end', code: 119, vKeyCode: '0x77' },
	{ key: 'page_up', code: 116, vKeyCode: '0x74' },
	{ key: 'page_down', code: 121, vKeyCode: '0x79' },

	{ key: 'Keypad0', code: 82, vKeyCode: '0x52' },
	{ key: 'Keypad1', code: 83, vKeyCode: '0x53' },
	{ key: 'Keypad2', code: 84, vKeyCode: '0x54' },
	{ key: 'Keypad3', code: 85, vKeyCode: '0x55' },
	{ key: 'Keypad4', code: 86, vKeyCode: '0x56' },
	{ key: 'Keypad5', code: 87, vKeyCode: '0x57' },
	{ key: 'Keypad6', code: 88, vKeyCode: '0x58' },
	{ key: 'Keypad7', code: 89, vKeyCode: '0x59' },
	{ key: 'Keypad8', code: 91, vKeyCode: '0x5B' },
	{ key: 'Keypad9', code: 92, vKeyCode: '0x5C' },

	{ key: 'KeypadDecimal', code: 65, vKeyCode: '0x41' },
	{ key: 'KeypadMultiply', code: 67, vKeyCode: '0x43' },
	{ key: 'KeypadPlus', code: 69, vKeyCode: '0x45' },
	{ key: 'KeypadClear', code: 71, vKeyCode: '0x47' },
	{ key: 'KeypadDivide', code: 75, vKeyCode: '0x4B' },
	{ key: 'KeypadEnter', code: 76, vKeyCode: '0x4C' },
	{ key: 'KeypadMinus', code: 78, vKeyCode: '0x4E' },
	{ key: 'KeypadEquals', code: 81, vKeyCode: '0x51' },

	{ key: 'A', code: 0, vKeyCode: '0x00' },
	{ key: 'B', code: 11, vKeyCode: '0x0B' },
	{ key: 'C', code: 8, vKeyCode: '0x08' },
	{ key: 'D', code: 2, vKeyCode: '0x02' },
	{ key: 'E', code: 14, vKeyCode: '0x0E' },
	{ key: 'F', code: 3, vKeyCode: '0x03' },
	{ key: 'G', code: 5, vKeyCode: '0x05' },
	{ key: 'H', code: 4, vKeyCode: '0x04' },
	{ key: 'I', code: 34, vKeyCode: '0x22' },
	{ key: 'J', code: 38, vKeyCode: '0x26' },
	{ key: 'K', code: 40, vKeyCode: '0x28' },
	{ key: 'L', code: 37, vKeyCode: '0x25' },
	{ key: 'M', code: 46, vKeyCode: '0x2E' },
	{ key: 'N', code: 45, vKeyCode: '0x2D' },
	{ key: 'O', code: 31, vKeyCode: '0x1F' },
	{ key: 'P', code: 35, vKeyCode: '0x23' },
	{ key: 'Q', code: 12, vKeyCode: '0x0C' },
	{ key: 'R', code: 15, vKeyCode: '0x0F' },
	{ key: 'S', code: 1, vKeyCode: '0x01' },
	{ key: 'T', code: 17, vKeyCode: '0x11' },
	{ key: 'U', code: 32, vKeyCode: '0x20' },
	{ key: 'V', code: 9, vKeyCode: '0x09' },
	{ key: 'W', code: 13, vKeyCode: '0x0D' },
	{ key: 'X', code: 7, vKeyCode: '0x07' },
	{ key: 'Y', code: 16, vKeyCode: '0x10' },
	{ key: 'Z', code: 6, vKeyCode: '0x06' },
	{ key: '0', code: 29, vKeyCode: '0x1D' },
	{ key: '1', code: 18, vKeyCode: '0x12' },
	{ key: '2', code: 19, vKeyCode: '0x13' },
	{ key: '3', code: 20, vKeyCode: '0x14' },
	{ key: '4', code: 21, vKeyCode: '0x15' },
	{ key: '5', code: 23, vKeyCode: '0x17' },
	{ key: '6', code: 22, vKeyCode: '0x16' },
	{ key: '7', code: 26, vKeyCode: '0x1A' },
	{ key: '8', code: 28, vKeyCode: '0x1C' },
	{ key: '9', code: 25, vKeyCode: '0x19' },
]
