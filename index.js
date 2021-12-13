const {app, BrowserWindow, Menu, ipcMain, Tray} = require('electron');
const path = require('path');
require('@electron/remote/main').initialize();

require('electron-reload')(__dirname);

let mainWindow;
let pathToIcon;
let isQuitting = false;
let tray = null;
const createWindow = () => {
    mainWindow = new BrowserWindow({
        width:800,
        height:600,
        webPreferences: {
            enableRemoteModule: true,
            preload: path.join(__dirname, 'scripts', 'preload.js')
        }
    })

    require('@electron/remote/main').enable(mainWindow.webContents);

    // win.setResizable(false);
    // win.removeMenu();

    // TODO: Remove in prod
    mainWindow.webContents.openDevTools();

    mainWindow.loadFile(path.join("src", "index.html"));

    // On close window sends a message to the Renderer
    mainWindow.on("close", (e) => {
        mainWindow.webContents.send("closeEvent");
        if (!isQuitting){
            e.preventDefault();
            tray = new Tray(pathToIcon);
            const contextMenu = Menu.buildFromTemplate([
                { label: "Ouvrir", type: "normal", click: () => {
                        mainWindow.show();
                        tray.destroy();
                    } },
                { label: "Quitter", type: "normal", click: () => {
                        isQuitting = true;
                        mainWindow.close();
                    } }
            ])
            tray.setToolTip('Candilink app.');
            tray.setContextMenu(contextMenu);
            tray.on('click', () => {
                mainWindow.show();
                tray.destroy();
            })
            mainWindow.hide()
            return false;
        }
    })
}

app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    pathToIcon = path.join(app.getAppPath(), "src", "icons", "favicon-32x32.png");
    createWindow()

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

app.on("window-all-closed", () => {

    if (process.platform !== 'darwin') app.quit()
})

ipcMain.handle('placeFound', (event, candilink, redirect_link) => {
    const candilibWindow = new BrowserWindow({
        width:800,
        height:600,
        parent: mainWindow,
        modal: true,
        webPreferences: {
            enableRemoteModule: true
        }
    })

    candilibWindow.loadURL(candilink);

    // TODO: remove in prod
    candilibWindow.webContents.openDevTools();

    candilibWindow.webContents.once('did-finish-load', () => {
        candilibWindow.loadURL(redirect_link);
    })

    let res;
    new Promise((resolve, reject) => {
        candilibWindow.once('closed', () => {
            resolve(true);
        })
    }).then(() => {
        res = true;
    })
    return res
})

ipcMain.handle('minimize-to-tray', (event, toMinimize) => {
    isQuitting = !toMinimize;
})