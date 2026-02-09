import { webcrypto } from 'crypto';
if (!globalThis.crypto) {
  (globalThis as any).crypto = webcrypto;
}

import { app, BrowserWindow, ipcMain, dialog, shell, screen } from 'electron';
import path from 'path';
import { WhatsAppClient } from './whatsapp';
import { FileHandler } from './file-handler';
import { loadConfig as _loadConfig, saveConfig as _saveConfig } from './config';
import { IPC_CHANNELS, Config, SendProgress, WhatsAppConnectionState, AddFilesResult } from '../shared/types';
import fs from 'fs';

let mainWindow: BrowserWindow | null = null;
let whatsappClient: WhatsAppClient | null = null;
let fileHandler: FileHandler | null = null;
let initError: string | null = null;
let isQuitting = false;
let isSendingInProgress = false;
let lastProgressSendTime = 0;
const PROGRESS_THROTTLE_MS = 200;

function sendThrottledProgress(progress: SendProgress): void {
  const now = Date.now();
  if (now - lastProgressSendTime >= PROGRESS_THROTTLE_MS) {
    mainWindow?.webContents.send(IPC_CHANNELS.SEND_PROGRESS, progress);
    lastProgressSendTime = now;
  }
}

function sendImmediateProgress(progress: SendProgress): void {
  mainWindow?.webContents.send(IPC_CHANNELS.SEND_PROGRESS, progress);
  lastProgressSendTime = Date.now();
}

// Mapa de arquivos copiados para originais (copiedPath -> originalPath)
const fileOriginalMap = new Map<string, string>();

const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json');
const DOCUMENTS_PATH = app.getPath('documents');

function loadConfig(): Config {
  return _loadConfig(CONFIG_PATH, DOCUMENTS_PATH);
}

function saveConfig(config: Config): void {
  _saveConfig(CONFIG_PATH, config);
}

function createWindow(): void {
  const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width: Math.round(screenW * 0.65),
    height: Math.round(screenH * 0.85),
    minWidth: 600,
    minHeight: 500,
    center: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: path.join(__dirname, 'preload.js'),
    },
    title: 'Valor Boletos',
    show: false,
  });

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
  // Handlers de configuração
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

  // Handlers de arquivos
  ipcMain.handle(IPC_CHANNELS.FILES_SCAN, async () => {
    return fileHandler?.scanBoletos(config.groups) ?? [];
  });

  ipcMain.handle(IPC_CHANNELS.DIALOG_SELECT_FILES, async (_, defaultPath?: string) => {
    if (!mainWindow) return [];
    const options: Electron.OpenDialogOptions = {
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
    };
    if (defaultPath) {
      options.defaultPath = defaultPath;
    }
    const result = await dialog.showOpenDialog(mainWindow, options);
    return result.filePaths;
  });

  ipcMain.handle(IPC_CHANNELS.FILES_ADD, async (_, groupName: string, filePaths: string[]): Promise<AddFilesResult> => {
    const result = await fileHandler?.addFiles(groupName, filePaths) ?? { mappings: [], errors: [] };
    // Armazenar mapeamento para possível exclusão posterior
    for (const mapping of result.mappings) {
      fileOriginalMap.set(mapping.copied, mapping.original);
    }
    return { files: result.mappings.map(m => m.copied), errors: result.errors };
  });

  ipcMain.handle(IPC_CHANNELS.FILES_DELETE, async (_, filePath: string) => {
    const result = await fileHandler?.deleteFile(filePath) ?? false;
    if (result) {
      fileOriginalMap.delete(filePath);
    }
    return result;
  });

  ipcMain.handle(IPC_CHANNELS.FILES_OPEN, async (_, filePath: string) => {
    return shell.openPath(filePath);
  });

  ipcMain.handle(IPC_CHANNELS.CONFIG_GET_GROUP_PATH, (_, groupName: string) => {
    return path.join(config.boletosFolder, groupName);
  });

  // Handlers do WhatsApp
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
      setupWhatsAppEvents(whatsappClient);

      // Iniciar novo cliente (vai gerar novo QR code)
      try {
        await whatsappClient.initialize();
      } catch (error) {
        console.error('WhatsApp re-initialization failed after logout:', error);
        const errorMsg = error instanceof Error ? error.message : 'Erro ao reinicializar WhatsApp';
        mainWindow?.webContents.send(IPC_CHANNELS.WHATSAPP_INIT_ERROR, errorMsg);
      }
    }
  });

  // Handler de envio
  ipcMain.handle(IPC_CHANNELS.SEND_ALL, async () => {
    if (!whatsappClient || !fileHandler) {
      throw new Error('App não inicializado');
    }

    if (isSendingInProgress) {
      throw new Error('Envio já em andamento');
    }

    isSendingInProgress = true;

    try {
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

        const message = group.files.length > 1
          ? config.messagePlural
          : config.messageSingular;

        progress.status = 'sending';
        progress.currentFile = '(mensagem)';
        progress.currentGroup = groupName;
        sendThrottledProgress(progress);

        try {
          await whatsappClient.sendMessage(groupId, message);
        } catch (error) {
          progress.status = 'error';
          progress.errors.push({
            file: '(mensagem)',
            group: groupName,
            error: error instanceof Error ? error.message : 'Erro desconhecido',
          });
          sendImmediateProgress(progress);
          continue;
        }

        for (const file of group.files) {
          progress.status = 'sending';
          progress.currentFile = path.basename(file);
          progress.currentGroup = groupName;
          sendThrottledProgress(progress);

          try {
            await whatsappClient.sendFile(groupId, file);

            progress.status = 'deleting';
            sendThrottledProgress(progress);

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
              error: error instanceof Error ? error.message : 'Erro desconhecido',
            });
            sendImmediateProgress(progress);
          }
        }

        if (groupIndex < groupsToSend.length - 1) {
          progress.status = 'waiting';
          sendImmediateProgress(progress);
          await new Promise(resolve => setTimeout(resolve, config.delayBetweenSends));
        }
      }

      progress.status = 'complete';
      mainWindow?.webContents.send(IPC_CHANNELS.SEND_COMPLETE, progress);
      return progress;
    } finally {
      isSendingInProgress = false;
    }
  });
}

function setupWhatsAppEvents(client: WhatsAppClient): void {
  client.on('qr', (qr: string) => {
    mainWindow?.webContents.send(IPC_CHANNELS.WHATSAPP_QR, qr);
  });

  client.on('ready', () => {
    mainWindow?.webContents.send(IPC_CHANNELS.WHATSAPP_READY);
  });

  client.on('disconnected', () => {
    mainWindow?.webContents.send(IPC_CHANNELS.WHATSAPP_DISCONNECTED);
  });

  client.on('auth_failure', (msg: string) => {
    mainWindow?.webContents.send(IPC_CHANNELS.WHATSAPP_AUTH_FAILURE, msg);
  });
}

function startFileWatcher(): void {
  fileHandler?.startWatching(() => {
    mainWindow?.webContents.send(IPC_CHANNELS.FILES_CHANGED);
  });
}

app.whenReady().then(async () => {
  const config = loadConfig();

  if (!fs.existsSync(config.boletosFolder)) {
    fs.mkdirSync(config.boletosFolder, { recursive: true });
  }

  fileHandler = new FileHandler(config.boletosFolder);

  try {
    whatsappClient = new WhatsAppClient(app.getPath('userData'));
    setupWhatsAppEvents(whatsappClient);
  } catch (error) {
    initError = error instanceof Error ? error.message : 'Erro ao criar cliente WhatsApp';
    console.error('Failed to create WhatsApp client:', error);
  }

  setupIPC(config);
  createWindow();
  startFileWatcher();
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

app.on('before-quit', async (e) => {
  if (isQuitting) return;
  isQuitting = true;
  e.preventDefault();

  fileHandler?.stopWatching();

  try {
    if (whatsappClient) {
      await Promise.race([
        whatsappClient.destroy(),
        new Promise(resolve => setTimeout(resolve, 5000)),
      ]);
    }
  } catch (error) {
    console.error('Error destroying WhatsApp client:', error);
  }

  app.exit(0);
});
