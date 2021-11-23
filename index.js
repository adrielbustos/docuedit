const { app, BrowserWindow, Menu, ipcMain } = require("electron");
const chokidar = require('chokidar');
const path = require("path");
const open = require('open');
const axios = require('axios');
const fs = require('fs');
const http = require('https');
const FormData = require('form-data');


const debug = true;

const protocolName = "docuedit";
const allStatus = [
    "Waiting for file editing",  // 0
    "Opening file", // 1
    "File ready to edit",  // 2
    "An error occurred while getting the file",  // 3
    "Saving changes", // 4
    "File draft saved", // 5
    "Invalid link" // 6
];


let urlParam = "";
let fileName = "";
let tempFilePath = "";
let mainWindow;
let deeplinkingUrl;


let templateMenu = [
    {
        label: "File",
        submenu: [
            {
                label: "Close App",
                click() {
                    app.quit();
                }
            }
        ]
    }
];


if (process.defaultApp) {
    if (process.argv.length >= 2) {
        app.setAsDefaultProtocolClient(protocolName, process.execPath, [path.resolve(process.argv[1])], ["apiUrl", "file"]);
    }
} else {
    app.setAsDefaultProtocolClient(protocolName, ["apiUrl", "file"]);
}

/**
 * Functions
 */


const openFile = (file) => {
    return open(`./${file}`, { wait: true });
}

const isValidParam = (s) => {
    return s !== "" && s !== null && s !== undefined
}


// sleep time expects milliseconds
function sleep(time) {
    return new Promise((resolve) => setTimeout(resolve, time));
}


function getAppDataPath(name = "") {
    switch (process.platform) {
        case "darwin": {
            return path.join(process.env.HOME, "Library", "Application Support", name);
        }
        case "win32": {
            // return path.join(process.env.APPDATA, name);
            return `./${name}`;
        }
        case "linux": {
            return path.join(process.env.HOME, `.${name}`);
        }
        default: {
            devToolsLog("Unsupported platform!");
            process.exit(1);
        }
    }
}


const startWatch = () => {
    return chokidar.watch(tempFilePath, {}).on('change', () => {
        // const firstFilePath = process.cwd() + "/" + tempFilePath;
        const formData = new FormData();
        formData.append("file", fs.createReadStream(tempFilePath), { knownLength: fs.statSync(tempFilePath).size });
        const headers = {
            ...formData.getHeaders(),
            "Content-Length": formData.getLengthSync()
        };
        mainWindow.webContents.send("status", new Message(true, allStatus[4], true));
        axios.post(urlParam, formData, { headers }).then((resp) => {
            mainWindow.webContents.send("status", new Message(true, allStatus[5]));
            sleep(3000).then(() => {
                mainWindow.webContents.send("status", new Message(true, allStatus[2]));
            });
        }, (err) => {
            mainWindow.webContents.send("status", new Message(false, allStatus[3]));
            devToolsLog(err);
        });
    });
}


const devToolsLog = (s) => {
    if (debug && mainWindow && mainWindow.webContents) {
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
    if (!isValidParam(urlParam) || !isValidParam(fileName)) {
        mainWindow.webContents.send("status", new Message(false, allStatus[6]));
        return;
    }
    const endpoint = urlParam + "?file=" + fileName;
    devToolsLog(endpoint);
    if (
        endpoint === "" ||
        !isValidHttpUrl(endpoint)
    ) {
        devToolsLog('invalid: ' + endpoint);
        mainWindow.webContents.send("status", new Message(false, allStatus[3]));
        return null;
    }
    mainWindow.webContents.send("status", new Message(true, allStatus[1], true));
    http.get(endpoint, function (response) {
        console.log("success");
        if (
            response.statusCode != 200 // "The url not exist" or 404
            // !validHeadersContentTypes.includes(response.headers["content-type"]) // "The file is not a valid file type"
        ) {
            devToolsLog("status code: " + response.statusCode);
            mainWindow.webContents.send("status", new Message(false, allStatus[3])); 
            return;
        }
        const file = fs.createWriteStream(tempFilePath);
        response.pipe(file);
        file.on("finish", function () {
            const watcher = startWatch();
            openFile(tempFilePath).then(function () {
                file.close();
                watcher.close();
                fs.unlinkSync(tempFilePath);
                app.quit();
                mainWindow.webContents.send("status", new Message(true, allStatus[0]));
            }, (err) => {
                // console.log(err);
                devToolsLog("error in openFile function");
                devToolsLog(err);
                mainWindow.webContents.send("status", new Message(false, allStatus[3])); 
            }).catch(err => {
                // console.log(err);
                devToolsLog("error in openFile function in catch");
                devToolsLog(err);
                mainWindow.webContents.send("status", new Message(false, allStatus[3]));
            });
            mainWindow.webContents.send("status", new Message(true, allStatus[2]));
        });
        file.on("error", function (err) {
            devToolsLog(err);
            mainWindow.webContents.send("status", new Message(false, "Error to open File"));
        });
    }).on("error", function (e) {
        devToolsLog(e);
        mainWindow.webContents.send("status", new Message(false, allStatus[3]));
    });

}


function createWindow() {

    mainWindow = new BrowserWindow({
        height: 200,
        width: 425,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true
        }
    });

    mainWindow.loadFile(path.join(__dirname, "views/index.html"));

    const mainMenu = Menu.buildFromTemplate(templateMenu);

    Menu.setApplicationMenu(mainMenu);

    mainWindow.on("closed", () => {
        app.quit();
    });

    if (debug) mainWindow.webContents.openDevTools();

    deeplinkingUrl = process.argv.find((arg) => arg.startsWith(protocolName + '://')); // can be undefined or null

    if (deeplinkingUrl !== undefined && deeplinkingUrl != null) {
        const params = new URLSearchParams(deeplinkingUrl);
        urlParam = params.get("apiUrl"); // or return null
        fileName = params.get("file"); // or return null
        tempFilePath = getAppDataPath(fileName);
    }

    ipcMain.on("loaded", (event, data) => {
        event.reply("status", new Message(true, allStatus[0]));
        if (isValidParam(urlParam) && isValidParam(fileName)) { // if ok
            initConnection();
        } else if (
            (isValidParam(fileName) && !isValidParam(urlParam)) ||
            (!isValidParam(fileName) && isValidParam(urlParam))
        ) {
            event.reply("status", new Message(true, allStatus[6]));
        }
    });

}

/**
 * App manage
 */

if (!app.requestSingleInstanceLock()) {
    app.quit();
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        const arguments = commandLine.toString().split(",");
        // Someone tried to run a second instance, we should focus our window.
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore()
            mainWindow.focus();
            deeplinkingUrl = arguments.find((arg) => arg.startsWith(protocolName + '://'));
            if (deeplinkingUrl === undefined) {
                mainWindow.webContents.send("status", new Message(false, allStatus[6]));
            } else {
                const params = new URLSearchParams(deeplinkingUrl);
                urlParam = params.get("apiUrl");
                fileName = params.get("file");
                tempFilePath = getAppDataPath(fileName);
                initConnection();
            }
        }
    });

    // Create mainWindow, load the rest of the app, etc...
    app.whenReady().then(() => {
        createWindow();
    });

}

// Handle the protocol. In this case, we choose to show an Error Box.
app.on('open-url', (event, url) => {
    event.preventDefault();
    const params = new URLSearchParams(url);
    urlParam = params.get("apiUrl"); // or return null
    fileName = params.get("file");
    tempFilePath = getAppDataPath(fileName);
    initConnection();
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
    if (mainWindow == null) {
        createWindow();
    }
});


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
    loading = false;
    constructor(status, msg, loading = false) {
        this.status = status;
        this.msg = msg;
        this.loading = loading;
    }
}