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
            preload: path.join(__dirname, 'preload.js')
        }
    })

    require('@electron/remote/main').enable(win.webContents);

    win.setResizable(false)
    win.removeMenu()

    // TODO: Remove in prod
    win.webContents.openDevTools()

    win.loadFile("index.html")
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