const {  app, BrowserWindow, ipcMain, screen, dialog, powerMonitor, shell } = require('electron');
const path = require('path');
const fs = require('fs');

/** @type {BrowserWindow} */ let settings;
/** @type {BrowserWindow} */ let widget;
/** @type {Config} */ let config;
/** @type {Data} */ let data;
let lastCursorPosition;
let realTime;


class Config {
  #configPath

  constructor() {
    if(!fs.existsSync(path.join(app.getPath('appData'), 'ScreenTime'))) {
      fs.mkdirSync(path.join(app.getPath('appData'), 'ScreenTime'), { recursive: true });
    }

    this.#configPath = path.join(app.getPath('appData'), 'ScreenTime', 'config.json');

    if(!fs.existsSync(this.#configPath)) {
      const defaultConfig = {
        locked: false,
        widget: { x: 0, y: 0 },
        consumption: 30,
        cost: 0.25,
        data: path.join(app.getPath('appData'), 'ScreenTime', 'data.json')
      };

      fs.writeFileSync(this.#configPath, JSON.stringify(defaultConfig, null, 2));
    }
  }

  get() {
    if (!fs.existsSync(this.#configPath)) {
      config = new Config();
    }

    return JSON.parse(fs.readFileSync(this.#configPath));
  }

  set(key, value) {
    const config = this.get();
    config[key] = value;

    fs.writeFileSync(this.#configPath, JSON.stringify(config, null, 2));
  }
}

class Data {
  /** @type {Config} */ #config;
  #dataPath

  constructor(config) {
    this.#config = config;
    this.#dataPath = this.#config.get().data;

    if(!fs.existsSync(path.dirname(this.#dataPath))) {
      fs.mkdirSync(path.dirname(this.#dataPath), { recursive: true });
    }

    if(!fs.existsSync(this.#dataPath)) {
      fs.writeFileSync(this.#dataPath, JSON.stringify([], null, 2), 'utf-8');
    }
  }

  get(date) {
    if (!fs.existsSync(this.#dataPath)) {
      data = new Data(this.#config);
    }

    if (!date) return JSON.parse(fs.readFileSync(this.#dataPath, 'utf-8'));

    const dataArray = JSON.parse(fs.readFileSync(this.#dataPath, 'utf-8'));
    return dataArray.find(d => d.date === date);
  }

  push(data) {
    const dataArray = this.get();
    dataArray.push(data);

    fs.writeFileSync(this.#dataPath, JSON.stringify(dataArray, null, 2), 'utf-8');
  }

  edit(date, data) {
    const dataArray = this.get();
    dataArray[dataArray.findIndex(d => d.date === date)] = data;

    fs.writeFileSync(this.#dataPath, JSON.stringify(dataArray, null, 2), 'utf-8');
  }
}


function openSettings() {
  settings = new BrowserWindow({
    width: 832,
    height: 640,
    center: true,
    movable: true,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    icon: path.join(__dirname, "../icon.ico"),
    titleBarOverlay: {
      color: '#2C2F33',
      symbolColor: '#5865F2',
      height: 32,
    },
    webPreferences: { 
      preload: path.join(__dirname, 'preload.js') 
    }
  });

  // settings.webContents.openDevTools({ mode: 'detach' });
  settings.loadFile(path.join(__dirname, '../www/settings.html'));

  settings.webContents.on('before-input-event', (event, input) => {
    if (input.control && input.shift && input.key === 'I' || input.control && input.shift && input.key === 'C' || input.alt || input.key === 'F12') {
      event.preventDefault();
    }
  });
}

function createWidget() {
  widget = new BrowserWindow({
    width: 256,
    height: 128,
    frame: false,
    movable: true,
    closable: false,
    focusable: false,
    resizable: false,
    transparent: true,
    skipTaskbar: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    autoHideMenuBar: true,
    icon: path.join(__dirname, "../icon.ico"),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // widget.webContents.openDevTools({ mode: 'detach' });
  widget.loadFile(path.join(__dirname, '../www/widget.html'));
  widget.setPosition(config.get().widget.x, config.get().widget.y);
  widget.webContents.send('message-from-main', {command: 'init', config: config.get(), data: data.get(new Date().toLocaleDateString())});

  widget.webContents.on('before-input-event', (event, input) => {
    if (input.control && input.shift && input.key === 'I' || input.control && input.shift && input.key === 'C' || input.alt || input.key === 'F12') {
      event.preventDefault();
    }
  });
}

function updateRealTime() {
  const currentCursorPosition = screen.getCursorScreenPoint();

  if(currentCursorPosition.x !== lastCursorPosition.x || currentCursorPosition.y !== lastCursorPosition.y) {
    realTime++;
  }

  lastCursorPosition = currentCursorPosition;
  widget.webContents.send('message-from-main', {command: 'real-time', time: realTime});
}

function main() {
  setTimeout(updateRealTime, 1000);
  setTimeout(main, 1000);
}

function init() {
  config = new Config();
  data = new Data(config);

  const currentData = data.get(new Date().toLocaleDateString());

  realTime = currentData ? currentData.realTime : 0;
  lastCursorPosition = screen.getCursorScreenPoint();

  createWidget();
  main();
}

app.whenReady().then(() => {
  init();

  powerMonitor.on('lock-screen', (event) => {
    widget.webContents.send('message-from-main', 'suspend');
  });

  powerMonitor.on('unlock-screen', (event) => {
    widget.webContents.send('message-from-main', 'resume');
  })

  powerMonitor.on('shutdown', (event) => {
    widget.webContents.send('message-from-main', 'shutdown');
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    widget.webContents.send('message-from-main', 'shutdown');
    app.quit();
  }
});

ipcMain.on('message-from-renderer', async (event, arg) => {
  if(arg.command == 'lock') {
    config.set('locked', arg.state);
    config.set('widget', {x: widget.getPosition()[0], y: widget.getPosition()[1]});
  } else if(arg.command == 'save') {
    const newData = arg.data;
    const savedData = data.get(newData.date);

    if(!savedData) {
      data.push(newData);
    } else {
      data.edit(newData.date, newData);
    }
  } else if (arg.command == 'save-config') {
    config.set('consumption', arg.consumption);
    config.set('cost', arg.cost);

    settings.webContents.send('message-from-main', {command: 'init', config: config.get(), data: data.get()});
    settings.webContents.send('message-from-main', 'draw-charts');
    settings.webContents.send('message-from-main', 'config-saved');
  } else if (arg == 'open-settings') {
    if (!settings || settings.isDestroyed()) {
      openSettings();
    } else {
      if (settings.isMinimized()) {
        settings.restore();
      }
    
      settings.focus();
    }
  } else if (arg == 'ready') {
    settings.webContents.send('message-from-main', {command: 'init', config: config.get(), data: data.get()});
    settings.webContents.send('message-from-main', 'draw-charts');
  } else if (arg == 'change-path') {
    const result = await dialog.showOpenDialog(settings, { 
      properties: ['openDirectory'],
      defaultPath: path.dirname(config.get().data),
      title: 'Select Directory to Save Data',
    });

    if (!result.canceled && result.filePaths.length > 0 && result.filePaths[0] !== config.get().data) {
      const dataPath = path.join(result.filePaths[0], 'data.json');

      if (!fs.existsSync(result.filePaths[0])) {
        fs.mkdirSync(result.filePaths[0], { recursive: true });
      }

      if (fs.existsSync(config.get().data)) {
        fs.copyFileSync(config.get().data, dataPath, fs.constants.COPYFILE_FICLONE);
        fs.unlinkSync(config.get().data);
      }

      config.set('data', dataPath);
      settings.webContents.send('message-from-main', {command: 'init', config: config.get(), data: data.get()});
      settings.webContents.send('message-from-main', 'draw-charts');
      settings.webContents.send('message-from-main', 'path-changed');
    }
  } else if (arg == 'export-config') {
    const result = await dialog.showSaveDialog(settings, { 
      defaultPath: path.join(app.getPath('downloads'), 'config.json'),
      title: 'Export Configuration',
      filters: [{ name: 'JSON Files', extensions: ['json'] }]
    });

    if (!result.canceled && result.filePath) {
      fs.copyFileSync(path.join(app.getPath('appData'), 'ScreenTime', 'config.json'), result.filePath, fs.constants.COPYFILE_FICLONE);
      settings.webContents.send('message-from-main', 'config-exported');
      shell.showItemInFolder(result.filePath);
    }
  } else if (arg == 'delete-config') {
    fs.unlinkSync(path.join(app.getPath('appData'), 'ScreenTime', 'config.json'));
    app.relaunch();
    app.exit();
  }
});