const open = require('open');
const fs = require('fs');
const http = require('http');

const url = "http://c1741193.ferozo.com/patroncito/public/downloads/cv.docx";
const tempName = "temp.docx";

const openFile = async (file) => {
    await open(file, { wait: true });
}

const startWatch = (tempName) => {
    let fsWait = false;
    console.log(`Watching for file changes on ${tempName}`);
    return fs.watch(`./${tempName}`, { interval: 1000 }, (event, filename) => {
        //console.log(event);
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

try {
    http.get(url, function (response) {
        const file = fs.createWriteStream(tempName);
        response.pipe(file);
        file.on("finish", function () {
            file.close();
            const watcher = startWatch(tempName);
            openFile(tempName).then(() => {
                console.log("file closed");
    
                // TODO ACA SE PUEDE ENVIAR EL ARCHIVO TEMPORAL A OTRO SERVER ANTES DE BORRARLO
    
                fs.unlinkSync(`./${tempName}`, function (erro) // cuando entra aca?
                {
                    console.log('delete');
                    if (erro) throw err;
                    // if no error, file has been deleted successfully
                    console.log('File deleted!');
                    process.exit();
                });
                watcher.close();
            });
            
        })
        file.on("error", function (err) {
            console.log("Error to open stream the file");
        });
    }).on("error", function (e) {
        console.log("error to download");
    });
} catch (error) {
    console.log("errp to download");
}