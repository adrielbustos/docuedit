const { app, BrowserWindow, Menu, ipcMain, dialog } = require("electron");
const gotTheLock = app.requestSingleInstanceLock();
const path = require("path");
const open = require('open');
const axios = require('axios');
const url = require("url");
const fs = require('fs');
const http = require('https');
const FormData = require('form-data');

const apiUrl = "https://docu-edit-demo-api.herokuapp.com/api/file";
const tempName = "temp-document.docx";
const protocolName = "docuedit";
const statuses = [
    "Waiting for file editing",  // 0
    "Openning file", // 1
    "File ready to edit",  // 2
    "An error occurred while getting the file",  // 3
    "Saving changes", // 4
    "File draft saved", // 5
    "Invalid link" // 6
];

let fileName = ""
let mainWindow;
let deeplinkingUrl;

if (process.defaultApp) {
    if (process.argv.length >= 2) {
        app.setAsDefaultProtocolClient(protocolName, process.execPath, [path.resolve(process.argv[1])], ["url"]);
    }
} else {
    app.setAsDefaultProtocolClient(protocolName, ["url"]);
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

            const firstFilePath = process.cwd() + "/" + tempName;
            const formData = new FormData();
            formData.append("file", fs.createReadStream(firstFilePath), { knownLength: fs.statSync(firstFilePath).size });
            const headers = {
                ...formData.getHeaders(),
                "Content-Length": formData.getLengthSync()
            };
            mainWindow.webContents.send("status", new Message(true, statuses[4]));
            axios.post(apiUrl, formData, { headers }).then((resp) => {
                mainWindow.webContents.send("status", new Message(true, statuses[5]));
                devToolsLog(resp);
                console.log('saved', resp);
            }, (err) => {
                mainWindow.webContents.send("status", new Message(true, statuses[3]));
                devToolsLog(err);
                console.log('error', err);
            });
            console.log(`${filename} file Changed`);
        }
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


const initConnection = () => {

    // const endpoint = apiUrl + "/" + fileName;
    const endpoint = apiUrl;

    if (
        fileName === "" ||
        fileName === undefined ||
        fileName === null ||
        !isValidHttpUrl(endpoint)
    ) {

        mainWindow.webContents.send("status", new Message(true, statuses[3]));

        devToolsLog(endpoint + ": is not a valid url");
        return null;
    }

    mainWindow.webContents.send("status", new Message(true, statuses[1]));

    http.get(endpoint, function (response) {
        const file = fs.createWriteStream(tempName);
        response.pipe(file);
        file.on("finish", function () { // cuando termina de cargar el archivo en memoria
            const watcher = startWatch(tempName);
            openFile(tempName).then(async () => {
                file.close();
                fs.unlinkSync(`./${tempName}`);
                watcher.close();
                console.log("closed");
            });

            mainWindow.webContents.send("status", new Message(true, statuses[2]));

        });
        file.on("error", function (err) {

            mainWindow.webContents.send("status", new Message(true, statuses[3]));

            console.log("Error to open stream the file");
        });
    }).on("error", function (e) {

        mainWindow.webContents.send("status", new Message(true, statuses[3]));

        console.log("error to download");
    });

}


function createWindow() {

    mainWindow = new BrowserWindow({
        height: 300,
        width: 400,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true,
            // additionalArguments: ["test", "--another=something"]
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

    deeplinkingUrl = process.argv.find((arg) => arg.startsWith(protocolName + '://')); // can be undefined or null

    if (deeplinkingUrl !== undefined || deeplinkingUrl !== null) {
        const params = new URLSearchParams(deeplinkingUrl);
        fileName = params.get("url"); // or return null
        devToolsLog("filename on params: " + fileName);
    }

    ipcMain.on("loaded", (event, data) => {
        devToolsLog("filename on loaded: " + fileName);
        if (fileName === "" || fileName === null) {
            event.reply("status", new Message(true, statuses[0]));
        }
        else {
            event.reply("status", new Message(true, statuses[1]));
            initConnection();
        }
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
                label: "Close App",
                click() {
                    app.quit();
                }
            },
            {
                label: "Load Docx",
                click() {
                    initConnection();
                }
            }
        ]
    }
];

if (!gotTheLock) {
    app.quit();
} else {

    app.on('second-instance', (event, commandLine, workingDirectory) => {
        if (process.platform !== 'darwin') {
            // Find the arg that is our custom protocol url and store it
            deeplinkingUrl = process.argv.find((arg) => arg.startsWith(protocolName + '://'));
        }
        // Someone tried to run a second instance, we should focus our window.
        if (mainWindow) {
            devToolsLog(event);
            devToolsLog(commandLine);
            devToolsLog(workingDirectory);
            devToolsLog(process.argv);
            if (mainWindow.isMinimized()) mainWindow.restore()
            mainWindow.focus();
            deeplinkingUrl = process.argv.find((arg) => arg.startsWith(protocolName + '://'));
            // if (deeplinkingUrl === undefined)
            // {
            //     mainWindow.webContents.send("status", new Message(false, statuses[6]));
            // }
            // else 
            // {
            const params = new URLSearchParams(deeplinkingUrl);
            fileName = params.get("url");
            // devToolsLog(params.get("url"));
            // devToolsLog(deeplinkingUrl);
            if (fileName === "" || fileName === null) {
                mainWindow.webContents.send("status", new Message(false, statuses[6]));
            }
            else {
                mainWindow.webContents.send("status", new Message(true, statuses[1]));
                initConnection();
            }
        }
        // }
    });

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

class Message {
    status = false;
    msg = "";
    action = "";
    constructor(status, msg, action = null) {
        this.status = status;
        this.msg = msg;
        this.action = action;
    }
}