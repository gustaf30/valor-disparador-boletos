import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import { WhatsAppClient } from './whatsapp';
import { FileHandler } from './file-handler';
import { IPC_CHANNELS, Config, SendProgress, WhatsAppConnectionState } from '../shared/types';
import fs from 'fs';

let mainWindow: BrowserWindow | null = null;
let whatsappClient: WhatsAppClient | null = null;
let fileHandler: FileHandler | null = null;
let initError: string | null = null;

// Mapa de arquivos copiados para originais (copiedPath -> originalPath)
const fileOriginalMap = new Map<string, string>();

const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json');

function getDefaultConfig(): Config {
  return {
    boletosFolder: path.join(app.getPath('documents'), 'Valor Boletos'),
    groups: {},
    messageSingular: 'Segue boleto em anexo.',
    messagePlural: 'Seguem os boletos em anexo.',
    delayBetweenSends: 2000,
    deleteOriginalFiles: false,
  };
}

function loadConfig(): Config {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const data = fs.readFileSync(CONFIG_PATH, 'utf-8');
      const loaded = JSON.parse(data);

      // Migration: message -> messageSingular/messagePlural
      if (loaded.message && !loaded.messageSingular) {
        loaded.messageSingular = loaded.message;
        loaded.messagePlural = loaded.message;
        delete loaded.message;
      }

      return { ...getDefaultConfig(), ...loaded };
    }
  } catch (error) {
    console.error('Error loading config:', error);
  }
  return getDefaultConfig();
}

function saveConfig(config: Config): void {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  } catch (error) {
    console.error('Error saving config:', error);
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    minWidth: 600,
    minHeight: 500,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: path.join(__dirname, 'preload.js'),
    },
    title: 'Valor Boletos',
    show: false,
  });

  // Load the app
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../renderer/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();

    // Verificar se houve erro na criação do cliente
    if (initError) {
      mainWindow?.webContents.send(IPC_CHANNELS.WHATSAPP_INIT_ERROR, initError);
      return;
    }

    // Inicializar WhatsApp apenas quando renderer está pronto para receber eventos
    whatsappClient?.initialize().catch((error) => {
      console.error('WhatsApp initialization failed:', error);
      const errorMsg = error instanceof Error ? error.message : 'Erro ao inicializar WhatsApp';
      initError = errorMsg;
      mainWindow?.webContents.send(IPC_CHANNELS.WHATSAPP_INIT_ERROR, errorMsg);
    });
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function setupIPC(config: Config): void {
  // Config handlers
  ipcMain.handle(IPC_CHANNELS.CONFIG_GET, () => config);

  ipcMain.handle(IPC_CHANNELS.CONFIG_SET, (_, newConfig: Partial<Config>) => {
    Object.assign(config, newConfig);
    saveConfig(config);
    fileHandler?.setBoletosFolder(config.boletosFolder);
    return config;
  });

  ipcMain.handle(IPC_CHANNELS.CONFIG_MAP_GROUP, (_, folderName: string, whatsappId: string) => {
    config.groups[folderName] = whatsappId;
    saveConfig(config);
    return config;
  });

  // File handlers
  ipcMain.handle(IPC_CHANNELS.FILES_SCAN, async () => {
    return fileHandler?.scanBoletos(config.groups) ?? [];
  });

  ipcMain.handle(IPC_CHANNELS.DIALOG_SELECT_FILES, async (_, defaultPath?: string) => {
    const options: Electron.OpenDialogOptions = {
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
    };
    if (defaultPath) {
      options.defaultPath = defaultPath;
    }
    const result = await dialog.showOpenDialog(mainWindow!, options);
    return result.filePaths;
  });

  ipcMain.handle(IPC_CHANNELS.FILES_ADD, async (_, groupName: string, filePaths: string[]) => {
    const mappings = await fileHandler?.addFiles(groupName, filePaths) ?? [];
    // Armazenar mapeamento para possível exclusão posterior
    for (const mapping of mappings) {
      fileOriginalMap.set(mapping.copied, mapping.original);
    }
    return mappings.map(m => m.copied);
  });

  ipcMain.handle(IPC_CHANNELS.FILES_DELETE, async (_, filePath: string) => {
    return fileHandler?.deleteFile(filePath) ?? false;
  });

  ipcMain.handle(IPC_CHANNELS.FILES_OPEN, async (_, filePath: string) => {
    return shell.openPath(filePath);
  });

  ipcMain.handle(IPC_CHANNELS.CONFIG_GET_GROUP_PATH, (_, groupName: string) => {
    return path.join(config.boletosFolder, groupName);
  });

  // WhatsApp handlers
  ipcMain.handle(IPC_CHANNELS.WHATSAPP_GET_GROUPS, async () => {
    return whatsappClient?.getGroups() ?? [];
  });

  ipcMain.handle(IPC_CHANNELS.WHATSAPP_GET_STATUS, (): WhatsAppConnectionState => {
    if (initError) return 'error';
    return whatsappClient?.getConnectionState() ?? 'disconnected';
  });

  ipcMain.handle(IPC_CHANNELS.WHATSAPP_GET_INIT_ERROR, (): string | null => {
    return initError ?? whatsappClient?.getLastError() ?? null;
  });

  ipcMain.handle(IPC_CHANNELS.WHATSAPP_LOGOUT, async () => {
    if (whatsappClient) {
      // Faz logout (limpa sessão)
      await whatsappClient.logout();
      // Destrói o cliente antigo
      await whatsappClient.destroy();

      // Criar novo cliente para permitir novo login
      whatsappClient = new WhatsAppClient(app.getPath('userData'));

      whatsappClient.on('qr', (qr: string) => {
        mainWindow?.webContents.send(IPC_CHANNELS.WHATSAPP_QR, qr);
      });

      whatsappClient.on('ready', () => {
        mainWindow?.webContents.send(IPC_CHANNELS.WHATSAPP_READY);
      });

      whatsappClient.on('disconnected', () => {
        mainWindow?.webContents.send(IPC_CHANNELS.WHATSAPP_DISCONNECTED);
      });

      whatsappClient.on('auth_failure', (msg: string) => {
        mainWindow?.webContents.send(IPC_CHANNELS.WHATSAPP_AUTH_FAILURE, msg);
      });

      // Iniciar novo cliente (vai gerar novo QR code)
      await whatsappClient.initialize();
    }
  });

  // Send handler
  ipcMain.handle(IPC_CHANNELS.SEND_ALL, async () => {
    if (!whatsappClient || !fileHandler) {
      throw new Error('App not initialized');
    }

    const groups = await fileHandler.scanBoletos(config.groups);

    // Filtrar apenas grupos com arquivos e mapeamento
    const groupsToSend = groups.filter(g => g.whatsappId && g.files.length > 0);

    // Contar total de arquivos
    const totalFiles = groupsToSend.reduce((sum, g) => sum + g.files.length, 0);

    const progress: SendProgress = {
      total: totalFiles,
      sent: 0,
      currentFile: '',
      currentGroup: '',
      status: 'sending',
      errors: [],
    };

    for (let groupIndex = 0; groupIndex < groupsToSend.length; groupIndex++) {
      const group = groupsToSend[groupIndex];
      const groupId = group.whatsappId!;
      const groupName = group.name;

      // 1. Selecionar mensagem (singular/plural)
      const message = group.files.length > 1
        ? config.messagePlural
        : config.messageSingular;

      // 2. Enviar mensagem de texto UMA VEZ para o grupo
      progress.status = 'sending';
      progress.currentFile = '(mensagem)';
      progress.currentGroup = groupName;
      mainWindow?.webContents.send(IPC_CHANNELS.SEND_PROGRESS, progress);

      try {
        await whatsappClient.sendMessage(groupId, message);
      } catch (error) {
        progress.status = 'error';
        progress.errors.push({
          file: '(mensagem)',
          group: groupName,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        mainWindow?.webContents.send(IPC_CHANNELS.SEND_PROGRESS, progress);
        continue; // Pula para próximo grupo se falhar
      }

      // 3. Enviar todos os arquivos do grupo SEM caption
      for (const file of group.files) {
        progress.status = 'sending';
        progress.currentFile = path.basename(file);
        progress.currentGroup = groupName;
        mainWindow?.webContents.send(IPC_CHANNELS.SEND_PROGRESS, progress);

        try {
          await whatsappClient.sendFile(groupId, file);

          progress.status = 'deleting';
          mainWindow?.webContents.send(IPC_CHANNELS.SEND_PROGRESS, progress);

          // Excluir cópia
          await fileHandler.deleteFile(file);

          // Excluir original se configurado
          if (config.deleteOriginalFiles) {
            const originalPath = fileOriginalMap.get(file);
            if (originalPath) {
              await fileHandler.deleteOriginalFile(originalPath);
              fileOriginalMap.delete(file);
            }
          }

          progress.sent++;
        } catch (error) {
          progress.status = 'error';
          progress.errors.push({
            file: path.basename(file),
            group: groupName,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          mainWindow?.webContents.send(IPC_CHANNELS.SEND_PROGRESS, progress);
        }
      }

      // 4. Delay entre grupos (não entre arquivos)
      if (groupIndex < groupsToSend.length - 1) {
        progress.status = 'waiting';
        mainWindow?.webContents.send(IPC_CHANNELS.SEND_PROGRESS, progress);
        await new Promise(resolve => setTimeout(resolve, config.delayBetweenSends));
      }
    }

    progress.status = 'complete';
    mainWindow?.webContents.send(IPC_CHANNELS.SEND_COMPLETE, progress);
    return progress;
  });
}

app.whenReady().then(async () => {
  const config = loadConfig();

  // Ensure boletos folder exists
  if (!fs.existsSync(config.boletosFolder)) {
    fs.mkdirSync(config.boletosFolder, { recursive: true });
  }

  fileHandler = new FileHandler(config.boletosFolder);

  try {
    whatsappClient = new WhatsAppClient(app.getPath('userData'));

    whatsappClient.on('qr', (qr: string) => {
      mainWindow?.webContents.send(IPC_CHANNELS.WHATSAPP_QR, qr);
    });

    whatsappClient.on('ready', () => {
      mainWindow?.webContents.send(IPC_CHANNELS.WHATSAPP_READY);
    });

    whatsappClient.on('disconnected', () => {
      mainWindow?.webContents.send(IPC_CHANNELS.WHATSAPP_DISCONNECTED);
    });

    whatsappClient.on('auth_failure', (msg: string) => {
      mainWindow?.webContents.send(IPC_CHANNELS.WHATSAPP_AUTH_FAILURE, msg);
    });
  } catch (error) {
    initError = error instanceof Error ? error.message : 'Erro ao criar cliente WhatsApp';
    console.error('Failed to create WhatsApp client:', error);
  }

  setupIPC(config);
  createWindow();
  // WhatsApp é inicializado dentro do ready-to-show do mainWindow
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('quit', () => {
  whatsappClient?.destroy();
});
