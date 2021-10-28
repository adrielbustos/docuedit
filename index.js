const { app, BrowserWindow, Menu, ipcMain } = require("electron");
const chokidar = require('chokidar');
const path = require("path");
const open = require('open');
const axios = require('axios');
const fs = require('fs');
const http = require('https');
const FormData = require('form-data');

const debug = false;

const apiUrl = "https://docu-edit-demo-api.herokuapp.com/api/file";
const tempName = "temp-document.docx";
const protocolName = "docuedit";
const allStatus = [
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
        app.setAsDefaultProtocolClient(protocolName, process.execPath, [path.resolve(process.argv[1])], ["url"]);
    }
} else {
    app.setAsDefaultProtocolClient(protocolName, ["url"]);
}

/**
 * Functions
 */

const openFile = (file) => {
    return open(`./${file}`, { wait: true });
}


// sleep time expects milliseconds
function sleep(time) {
    return new Promise((resolve) => setTimeout(resolve, time));
}


const startWatch = () => {
    return chokidar.watch(`./${tempName}`).on('change', () => {
        const firstFilePath = process.cwd() + "/" + tempName;
        const formData = new FormData();
        formData.append("file", fs.createReadStream(firstFilePath), { knownLength: fs.statSync(firstFilePath).size });
        const headers = {
            ...formData.getHeaders(),
            "Content-Length": formData.getLengthSync()
        };
        mainWindow.webContents.send("status", new Message(true, allStatus[4], true));
        axios.post(apiUrl, formData, { headers }).then((resp) => {
            // console.log("saved");
            mainWindow.webContents.send("status", new Message(true, allStatus[5]));
            sleep(3000).then(() => {
                mainWindow.webContents.send("status", new Message(true, allStatus[2]));
            });
        }, (err) => {
            // console.log("error");
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
    const endpoint = fileName; // TODO: borrar cando ete lista la api
    // const endpoint = apiUrl + "/" + fileName;
    if (
        fileName === "" ||
        fileName === undefined ||
        fileName == null ||
        !isValidHttpUrl(endpoint)
    ) {
        devToolsLog('invalid: '+endpoint);
        mainWindow.webContents.send("status", new Message(false, allStatus[3]));
        return null;
    }
    mainWindow.webContents.send("status", new Message(true, allStatus[1], true));
    http.get(endpoint, function (response) {
        const file = fs.createWriteStream(tempName);
        response.pipe(file);
        file.on("finish", function () {
            const watcher = startWatch();
            openFile(tempName).then(() => {
                file.close();
                watcher.close();
                fs.unlinkSync(`./${tempName}`);
                app.quit();
                mainWindow.webContents.send("status", new Message(true, allStatus[0]));
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

    if (deeplinkingUrl !== undefined || deeplinkingUrl != null) {
        const params = new URLSearchParams(deeplinkingUrl);
        fileName = params.get("url"); // or return null
    }

    ipcMain.on("loaded", (event, data) => {
        event.reply("status", new Message(true, allStatus[0]));
        if (fileName !== "" && fileName != null) {
            initConnection();
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
            }
            else {
                const params = new URLSearchParams(deeplinkingUrl);
                fileName = params.get("url");
                if (fileName === "" || fileName == null) {
                    mainWindow.webContents.send("status", new Message(false, allStatus[6]));
                }
                else {
                    initConnection();
                }
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
    fileName = params.get("url"); // or return null
    if (fileName === "" || fileName == null) {
        mainWindow.webContents.send("status", new Message(false, allStatus[6]));
    }
    else {
        initConnection();
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
    if (mainWindow == null) {
        createWindow();
    }
});


// if (process.env.NODE_ENV !== 'production') {
//     templateMenu.push(
//         {
//             label: "Devs Tool",
//             submenu: [
//                 {
//                     label: "Show/Hide",
//                     click(item, focusedWindow) {
//                         // mainWindow.webContents.openDevTools();
//                         focusedWindow.toggleDevTools();
//                     }
//                 },
//                 {
//                     role: "Reload"
//                 }
//             ]
//         }
//     );
// }


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