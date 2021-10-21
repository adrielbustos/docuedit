require("dotenv").config();
const { app, BrowserWindow, Menu, ipcMain, protocol } = require("electron");
const path = require("path");
const open = require('open');
const url = require("url");
const fs = require('fs');
const http = require('http');

const filewUrl = "http://c1741193.ferozo.com/patroncito/public/downloads/cv.docx"; // descargar  desde s3 de amazon
const tempName = "cv2.docx";

app.setAsDefaultProtocolClient("docuedit");
// app.setAsDefaultProtocolClient("docuedit", 'C:\\Users\\karthi\\electron-quick-start\\electron-quick-start-win32-x64\\electron-quick-start.exe');
// this code will register the custom protocol in machine, then you can open your app using browser like quickstart://params

/**
 * Functions
 */

const openFile = async (file) => {
    await open(`./${file}`, { wait: true });
}

const startWatch = (tempName) => {
    let fsWait = false;
    console.log(`Watching for file changes on ${tempName}`);
    return fs.watch(`./${tempName}`, { interval: 1000 }, (event, filename) => {
        if (filename) {
            if (fsWait) return;
            fsWait = setTimeout(() => {
                fsWait = false;
            }, 100);
            // TODO ACA SE PUEDE ENVIAR EL ARCHIVO TEMPORAL A OTRO SERVER ANTES DE BORRARLO
            console.log(`${filename} file Changed`);
        }
    });
}

const createNewWindow = () => {
    let newWindow = new BrowserWindow(
        {
            width: 400,
            height: 350,
            title: "New Window"
        }
    );
    newWindow.setMenu(null);
    newWindow.loadURL(url.format({
        pathname: path.join(__dirname, "views/newWindow.html"),
        protocol: "file",
        slashes: true
    }));
    newWindow.on("closed", () => {
        newWindow = null;
    });
}

/**
 * App manage
 */

let templateMenu = [
    {
        label: "File",
        submenu: [
            {
                label: "test",
                click() {
                    createNewWindow()
                }
            },
            {
                label: "Load Docx",
                click() {
                    http.get(filewUrl, function (response) {
                        const file = fs.createWriteStream(tempName);
                        response.pipe(file);
                        file.on("finish", function () {
                            file.close();
                            const watcher = startWatch(tempName);
                            openFile(tempName).then(() => {
                                // app.post('/upload', function (req, res) {
                                //     console.log(req.files.foo); // the uploaded file object
                                //     console.log("file closed");
                                //     // TODO ACA SE PUEDE ENVIAR EL ARCHIVO TEMPORAL A OTRO SERVER ANTES DE BORRARLO
                                //     fs.unlinkSync(`./${tempName}`);
                                //     watcher.close();
                                // });
                                console.log("file closed");
                                // TODO ACA SE PUEDE ENVIAR EL ARCHIVO TEMPORAL A OTRO SERVER ANTES DE BORRARLO
                                fs.unlinkSync(`./${tempName}`);
                                watcher.close();
                            });
                        })
                        file.on("error", function (err) {
                            console.log("Error to open stream the file");
                        });
                    }).on("error", function (e) {
                        console.log("error to download");
                    });
                }
            }
        ]
    }
];

let mainWindow;

const io = require('socket.io-client');
const socket = io(`http://localhost:8080`);

app.on("ready", () => {
    
    mainWindow = new BrowserWindow({
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true
        }
    });

    mainWindow.loadURL(url.format({
        pathname: path.join(__dirname, "views/index.html"),
        protocol: "file",
        slashes: true
    }));

    mainWindow.loadFile(path.join(__dirname, "views/index.html"));

    const mainMenu = Menu.buildFromTemplate(templateMenu);

    Menu.setApplicationMenu(mainMenu);
    mainWindow.on("closed", () => {
        app.quit();
    });

    mainWindow.webContents.openDevTools();

    let isSocketOn = false;

    socket.on('welcome', () => {
        console.log('on welcome : welcome received renderer');
        socket.emit('test')
    });

    socket.on('error', (e) => {
        console.log(e);
    });

    socket.on('ok', () => {
        console.log("OK received renderer");
    });

    socket.on('connect', function(d) {
        isSocketOn = true;
        console.log("conexion exitosa");
        // socket.emit('test');
    });

    socket.on('disconnect', () => {
        console.log("Desconectado");
    });

    ipcMain.on("loaded", (event, data) => {
        event.reply("isConnected", isSocketOn);
    });

    protocol.registerHttpProtocol('docuedit', (req, cb) => {
        //const fullUrl = formFullTodoUrl(req.url)
        devToolsLog('full url to open ')
        // mainWindow.loadURL(fullUrl)
    });
    
    // protocol.registerSchemesAsPrivileged([
        // { scheme: 'docuedit', privileges: { bypassCSP: true } }
    // ]);

});

if (process.env.NODE_ENV !== 'production') {
    templateMenu.push(
        {
            label: "Devs Tool",
            submenu: [
                {
                    label: "Show/Hide",
                    click(item, focusedWindow) {
                        // mainWindow.webContents.openDevTools();
                        focusedWindow.toggleDevTools();
                    }
                },
                {
                    role: "Reload"
                }
            ]
        }
    );
}

if (process.platform === "darwin") {
    templateMenu.unshift(
        {
            label: app.getName()
        }
    );
}