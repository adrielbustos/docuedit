const functions = require("firebase-functions");
const express   = require('express');
const open      = require('open');
const fs        = require('fs');
const http      = require('http');

require('dotenv').config();
const app = express();
const port = process.env.PORT;

const openFile = async (file) => {
    await open(file, { wait: true });
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

            // TODO ACA SE PUEDE ENVIAR EL ARCHIVO TEMPORAL A OTRO SERVER

            console.log(`${filename} file Changed`);
        }
    });
}

app.get('/', function (req, res) {
    const url = "http://c1741193.ferozo.com/patroncito/public/downloads/cv.docx";
    const tempName = "cv.docx";

    const watcher = startWatch(tempName);

    openFile(tempName).then(() => {
        console.log("file closed");

        // TODO ACA SE PUEDE ENVIAR EL ARCHIVO TEMPORAL A OTRO SERVER ANTES DE BORRARLO
        watcher.close();
        res.send('exito');
    });

});

app.get('*', function (req, res) {
    res.send('404 Not Found');
});

app.listen(port, () => {
    console.log("Escuchando el puerto: ", port);
});

exports.app = functions.https.onRequest(app);