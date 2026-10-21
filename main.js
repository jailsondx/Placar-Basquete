const { app, BrowserWindow, Menu, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// Garante apenas uma instância do aplicativo rodando simultaneamente
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

// Configuração do DATA_DIR ANTES de carregar o server.js
// No Electron empacotado, app.asar é um arquivo estático (somente leitura),
// portanto os dados DEVEM ser gravados em userData ou na pasta do executável portátil.
if (process.env.PORTABLE_EXECUTABLE_DIR) {
  process.env.DATA_DIR = path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'data');
} else if (app.isPackaged) {
  process.env.DATA_DIR = path.join(app.getPath('userData'), 'data');
} else {
  process.env.DATA_DIR = path.join(__dirname, 'data');
}

// Importar o servidor após definir process.env.DATA_DIR
const { startServer } = require('./server');

let mainWindow = null;
let serverInstance = null;

// Helpers de Zoom/Escala
function zoomIn() {
  if (!mainWindow) return;
  const current = mainWindow.webContents.getZoomFactor();
  const next = Math.min(Number((current + 0.1).toFixed(2)), 3.0);
  mainWindow.webContents.setZoomFactor(next);
}

function zoomOut() {
  if (!mainWindow) return;
  const current = mainWindow.webContents.getZoomFactor();
  const next = Math.max(Number((current - 0.1).toFixed(2)), 0.4);
  mainWindow.webContents.setZoomFactor(next);
}

function resetZoom() {
  if (!mainWindow) return;
  mainWindow.webContents.setZoomFactor(1.0);
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

async function createWindow(serverPort) {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 1024,
    minHeight: 650,
    title: 'JSPOINT - Placar de Basquete',
    icon: path.join(__dirname, 'public', 'img', 'icone.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    },
    autoHideMenuBar: true
  });

  // Menu simples com atalhos de tela cheia, zoom e recarregar
  const menuTemplate = [
    {
      label: 'Exibir',
      submenu: [
        { role: 'reload', label: 'Recarregar' },
        { role: 'forceReload', label: 'Forçar Recarregamento' },
        { type: 'separator' },
        {
          label: 'Aumentar Zoom / Escala (Ctrl +)',
          accelerator: 'CommandOrControl+=',
          click: zoomIn
        },
        {
          label: 'Diminuir Zoom / Escala (Ctrl -)',
          accelerator: 'CommandOrControl+-',
          click: zoomOut
        },
        {
          label: 'Restaurar Escala Padrão (Ctrl 0)',
          accelerator: 'CommandOrControl+0',
          click: resetZoom
        },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Tela Cheia (F11)' }
      ]
    },
    {
      label: 'Ajuda',
      submenu: [
        {
          label: 'Alternar Ferramentas de Desenvolvedor',
          accelerator: 'Ctrl+Shift+I',
          click: () => mainWindow.webContents.toggleDevTools()
        },
        {
          label: 'Sobre',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Sobre o Placar de Basquete',
              message: 'Placar de Basquete Eletrônico',
              detail: `Versão 1.0.0\nPersistência de partidas e controle de cronômetro 24s/14s.\n\nDados salvos em:\n${process.env.DATA_DIR}`
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

  // Captura direta de atalhos de escala no teclado (funciona em qualquer layout: ABNT2, US, com ou sem Numpad)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && (input.control || input.meta)) {
      // Zoom In: +, =, Equal ou NumpadAdd
      if (
        input.key === '+' ||
        input.key === '=' ||
        input.code === 'Equal' ||
        input.code === 'NumpadAdd'
      ) {
        event.preventDefault();
        zoomIn();
      }
      // Zoom Out: -, Minus ou NumpadSubtract
      else if (
        input.key === '-' ||
        input.code === 'Minus' ||
        input.code === 'NumpadSubtract'
      ) {
        event.preventDefault();
        zoomOut();
      }
      // Reset Zoom: 0, Digit0 ou Numpad0
      else if (
        input.key === '0' ||
        input.code === 'Digit0' ||
        input.code === 'Numpad0'
      ) {
        event.preventDefault();
        resetZoom();
      }
    }
  });

  mainWindow.maximize();
  await mainWindow.loadURL(`http://localhost:${serverPort}`);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  try {
    // Tenta porta 3000 primeiro; se estiver ocupada, usa porta dinâmica (0)
    let running;
    try {
      running = await startServer(3000);
    } catch (err) {
      console.warn('Porta 3000 ocupada, obtendo porta dinâmica livre...');
      running = await startServer(0);
    }

    serverInstance = running.server;
    await createWindow(running.port);
  } catch (err) {
    console.error('Falha ao iniciar o aplicativo:', err);
    dialog.showErrorBox('Erro ao iniciar', `Não foi possível iniciar o servidor local:\n${err.message}`);
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0 && serverInstance) {
    const port = serverInstance.address().port;
    createWindow(port);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (serverInstance) {
    serverInstance.close();
  }
});
