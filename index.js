require("dotenv").config();
const { app, BrowserWindow, Menu, ipcMain, protocol } = require("electron");
const gotTheLock = app.requestSingleInstanceLock();
const io = require('socket.io-client');
const socket = io(`http://localhost:8080`);
const path = require("path");
const open = require('open');
const url = require("url");
const fs = require('fs');
const http = require('https');
const axios = require('axios');
const FormData = require('form-data');

const apiUrl = "https://docu-edit-demo-api.herokuapp.com/api/file"; // descargar  desde s3 de amazon
const tempName = "temp-document.docx";

let mainWindow;
let deeplinkingUrl;

app.setAsDefaultProtocolClient("docuedit");

// if (!gotTheLock) {
//     app.quit();
//     return;
// } else {
    
//     app.on('second-instance', (e, argv) => {
//         devToolsLog('second-instance');
//         if (process.platform !== 'darwin') {
//             // Find the arg that is our custom protocol url and store it
//             deeplinkingUrl = argv.find((arg) => arg.startsWith('docuedit://'));
//         }

//         if (mainWindow) {
//             if (mainWindow.isMinimized()) mainWindow.restore();
//             mainWindow.focus();
//         }
//     });
// }

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


const devToolsLog = (s) => {
    if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.executeJavaScript(`console.log("send in protocol: ${s}")`);
    }
}


const sendFile = () => {

    http.get(apiUrl, function (response) {
        const file = fs.createWriteStream(tempName);
        response.pipe(file);
        file.on("finish", function () { // cuando termina de cargar el archivo en memoria
            const watcher = startWatch(tempName); // 
            openFile(tempName).then( async () => {
                file.close();
                //const STATIC_FOLDER = path.join(process.cwd(), tempName);
                //let fileStream = fs.createReadStream(STATIC_FOLDER);
                let form = new FormData();
                const fileStream = fs.readFileSync(`./${tempName}`, {encoding:'utf8', flag:'r'});
                console.log(fileStream);
                // form.append('file', fileStream, tempName);
                // axios.post(apiUrl, {"file": form}, {
                //     headers: {
                //         'Content-Type': 'multipart/form-data'
                //     }
                // }).then((res) => {
                //     console.log('file send');
                //     console.log(res);
                //     fs.unlinkSync(`./${tempName}`);
                //     watcher.close();
                // }, (err) => {
                //     console.log("ERROR");
                //     console.log(err);
                //     fs.unlinkSync(`./${tempName}`);
                //     watcher.close();
                // });
            });
        });
        file.on("error", function (err) {
            console.log("Error to open stream the file");
        });
    }).on("error", function (e) {
        console.log("error to download");
    });

}


function createWindow() {

    mainWindow = new BrowserWindow({
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true,
            additionalArguments: ["test", "--another=something"]
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

    const registerHttpProtocol = protocol.registerHttpProtocol('docuedit', (req, cb) => {
        devToolsLog('registerHttpProtocol');
    });

    const interceptHttpProtocol = protocol.interceptHttpProtocol('docuedit', (req, cb) => {
        req.url;
        devToolsLog(req.url);
    });

    const interceptBufferProtocol = protocol.interceptBufferProtocol('docuedit', (req, cb) => {
        devToolsLog('interceptBufferProtocol');
    });

    proto = {
        registerHttpProtocol,
        interceptHttpProtocol,
        interceptBufferProtocol
    }

    // ipcMain.on("loaded", (event, data) => {
    //     event.reply("isConnected", process.argv);
    // });

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
                    createNewWindow();
                }
            },
            {
                label: "Load Docx",
                click() {
                    sendFile();
                }
            }
        ]
    }
];

app.on("ready", createWindow);


app.on('second-instance', (e, argv) => {
    devToolsLog('second-instance');
    if (process.platform !== 'darwin') {
        // Find the arg that is our custom protocol url and store it
        deeplinkingUrl = argv.find((arg) => arg.startsWith('docuedit://'));
    }

    if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
    }
});


app.on('window-all-closed', function () {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        app.quit();
    }
});


app.on('activate', function () {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (mainWindow === null) {
        createWindow();
    }
});


// Protocol handler for osx
app.on('open-url', function (event, url) {
    event.preventDefault();
    deeplinkingUrl = url
    devToolsLog('open-url');
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
