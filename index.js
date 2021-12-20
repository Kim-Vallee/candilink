const {app, BrowserWindow, Menu, ipcMain, Tray} = require('electron');

if (handleSquirrelEvent(app)) {
    // squirrel event handled and app will exit in 1000ms, so don't do anything else
    return;
}

const path = require('path');
const autoLaunch = require('auto-launch');
const Store = require('./utils/Storage');
const {DEFAULT_PARAMS_USER_STORAGE} = require("./scripts/constants");
let userStorage = new Store('user-preferences', DEFAULT_PARAMS_USER_STORAGE);

require('@electron/remote/main').initialize();
require('electron-reload')(__dirname);

let mainWindow;
let pathToIcon;
let isQuitting = userStorage.get('activate-tray');
let tray = null;
let appAutoLaunch;

const createWindow = () => {
    mainWindow = new BrowserWindow({
        width:800,
        height:600,
        webPreferences: {
            enableRemoteModule: true,
            preload: path.join(__dirname, 'scripts', 'preload.js'),
            devTools: false
        }
    })

    require('@electron/remote/main').enable(mainWindow.webContents);

    // win.setResizable(false);
    // win.removeMenu();

    // Remove in prod
    // mainWindow.webContents.openDevTools();

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
    // Prepare autolaunch for next startup
    appAutoLaunch = new autoLaunch( {
        name: "candilink",
        path: app.getPath('exe')
    })
    Menu.setApplicationMenu(null);
    pathToIcon = path.join(app.getAppPath(), "src", "icons", "favicon-32x32.png");

    // Create window
    createWindow();
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

    // remove in prod
    // candilibWindow.webContents.openDevTools();

    candilibWindow.webContents.once('did-finish-load', () => {
        candilibWindow.loadURL(redirect_link);
    })

    let res;
    new Promise((resolve) => {
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

ipcMain.handle('app-on-startup', (e, appOnStartup) => {
    if (appOnStartup) {
        appAutoLaunch.enable();
    } else {
        appAutoLaunch.disable();
    }
})

function handleSquirrelEvent(application) {
    if (process.argv.length === 1) {
        return false;
    }

    const ChildProcess = require('child_process');
    const path = require('path');

    const appFolder = path.resolve(process.execPath, '..');
    const rootAtomFolder = path.resolve(appFolder, '..');
    const updateDotExe = path.resolve(path.join(rootAtomFolder, 'Update.exe'));
    const exeName = path.basename(process.execPath);

    const spawn = function(command, args) {
        let spawnedProcess;

        try {
            spawnedProcess = ChildProcess.spawn(command, args, {
                detached: true
            });
        } catch (error) {}

        return spawnedProcess;
    };

    const spawnUpdate = function(args) {
        return spawn(updateDotExe, args);
    };

    const squirrelEvent = process.argv[1];
    switch (squirrelEvent) {
        case '--squirrel-install':
        case '--squirrel-updated':
            // Optionally do things such as:
            // - Add your .exe to the PATH
            // - Write to the registry for things like file associations and
            //   explorer context menus

            // Install desktop and start menu shortcuts
            spawnUpdate(['--createShortcut', exeName]);

            setTimeout(application.quit, 1000);
            return true;

        case '--squirrel-uninstall':
            // Undo anything you did in the --squirrel-install and
            // --squirrel-updated handlers

            // Remove desktop and start menu shortcuts
            spawnUpdate(['--removeShortcut', exeName]);

            setTimeout(application.quit, 1000);
            return true;

        case '--squirrel-obsolete':
            // This is called on the outgoing version of your app before
            // we update to the new version - it's the opposite of
            // --squirrel-updated

            application.quit();
            return true;
    }
}