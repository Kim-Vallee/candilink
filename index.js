const {app, BrowserWindow} = require('electron');
const path = require('path');
require('@electron/remote/main').initialize();

require('electron-reload')(__dirname);


const createWindow = () => {
    const win = new BrowserWindow({
        width:800,
        height:600,
        webPreferences: {
            enableRemoteModule: true,
            preload: path.join(__dirname, 'scripts', 'preload.js')
        }
    })

    require('@electron/remote/main').enable(win.webContents);

    // win.setResizable(false);
    win.removeMenu();

    // TODO: Remove in prod
    win.webContents.openDevTools();

    win.loadFile(path.join("src", "index.html"));

    // On close window sends a message to the Renderer
    win.on("close", (e) => {
        win.webContents.send("closeEvent");
    })
}

app.whenReady().then(() => {
    createWindow()

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

app.on("window-all-closed", () => {

    if (process.platform !== 'darwin') app.quit()
})