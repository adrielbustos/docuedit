const { app, BrowserWindow, Menu, ipcMain, protocol, dialog } = require("electron");
const gotTheLock = app.requestSingleInstanceLock();
const path = require("path");
const open = require('open');
const axios = require('axios');
const url = require("url");
const fs = require('fs');
const http = require('https');
const FormData = require('form-data');

// const packager = require('electron-packager');
// packager({
//     // ...other options...
//     protocols: [
//         {
//             name: 'Document Edit',
//             schemes: ['docuedit']
//         }
//     ]
// }).then(paths => console.log(`SUCCESS: Created ${paths.join(', ')}`))
//     .catch(err => console.error(`ERROR: ${err.message}`))

const apiUrl = "https://docu-edit-demo-api.herokuapp.com/api/file";
let fileName = ""
// let apiUrl = "";
const tempName = "temp-document.docx";

let mainWindow;
let deeplinkingUrl;

if (process.defaultApp) {
    if (process.argv.length >= 2) {
        app.setAsDefaultProtocolClient('docuedit', process.execPath, [path.resolve(process.argv[1])], ["test", "url"]);
    }
} else {
    app.setAsDefaultProtocolClient('docuedit', ["test", "url"]);
}

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
        mainWindow.webContents.executeJavaScript(`console.log("${s}")`);
    }
}


const isValidHttpUrl = (string) => {
    let url;
    try {
      url = new URL(string);
    } catch (_) {
      return false;  
    }
    return url.protocol === "http:" || url.protocol === "https:";
  }


const sendFile = () => {

    const endpoint = apiUrl + "/" + fileName;

    if (
        fileName === "" ||
        fileName === undefined ||
        fileName === null ||
        !isValidHttpUrl(endpoint)
    )
    {
        devToolsLog(endpoint + ": is not a valid url")
        return null;
    }

    http.get(endpoint, function (response) {
        const file = fs.createWriteStream(tempName);
        response.pipe(file);
        file.on("finish", function () { // cuando termina de cargar el archivo en memoria
            const watcher = startWatch(tempName);
            openFile(tempName).then(async () => {
                file.close();
                const firstFilePath = process.cwd() + "/" + tempName;
                const formData = new FormData();
                formData.append("file", fs.createReadStream(firstFilePath), { knownLength: fs.statSync(firstFilePath).size });
                const headers = {
                    ...formData.getHeaders(),
                    "Content-Length": formData.getLengthSync()
                };
                axios.post(apiUrl, formData, { headers }).then((resp) => {
                    console.log(true, resp);
                    fs.unlinkSync(`./${tempName}`);
                    watcher.close();
                }, (err) => {
                    console.log('error', err);
                    fs.unlinkSync(`./${tempName}`);
                    watcher.close();
                });
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

    deeplinkingUrl = process.argv.find((arg) => arg.startsWith('docuedit://')); // can be undefined or null

    if (deeplinkingUrl !== undefined || deeplinkingUrl !== null)
    {
        const params = new URLSearchParams(deeplinkingUrl);
        fileName = params.get("url");
        // devToolsLog(params.get("url-no")); // return null
    }

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

// app.on("ready", createWindow);

if (!gotTheLock) {
    app.quit();
} else {

    app.on('second-instance', (event, commandLine, workingDirectory) => {
        if (process.platform !== 'darwin') {
            // Find the arg that is our custom protocol url and store it
            deeplinkingUrl = process.argv.find((arg) => arg.startsWith('docuedit://'));
        }
        // Someone tried to run a second instance, we should focus our window.
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore()
            mainWindow.focus();
        }
    })

    // Create mainWindow, load the rest of the app, etc...
    app.whenReady().then(() => {
        createWindow();
    });

}

// Handle the protocol. In this case, we choose to show an Error Box.
app.on('open-url', (event, url) => {
    event.preventDefault();
    dialog.showErrorBox('Welcome Back', `You arrived from: ${url}`)
    deeplinkingUrl = url;
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
