const { app, BrowserWindow, Menu } = require("electron");
const url = require("url");
const path = require("path");

const open = require('open');
const fs = require('fs');
const http = require('http');

const filewUrl = "http://c1741193.ferozo.com/patroncito/public/downloads/cv.docx"; // descargar  desde s3 de amazon
const tempName = "cv2.docx";

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

/**
 * Functions
 */

const sendFile = (filePath) => {

}

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

app.on("ready", () => {
    mainWindow = new BrowserWindow({});
    mainWindow.loadURL(url.format({
        pathname: path.join(__dirname, "views/index.html"),
        protocol: "file",
        slashes: true
    }));
    const mainMenu = Menu.buildFromTemplate(templateMenu);
    Menu.setApplicationMenu(mainMenu);
    mainWindow.on("closed", () => {
        app.quit();
    });
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