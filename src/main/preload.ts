import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, Config, GroupStatus, SendProgress, WhatsAppGroup, WhatsAppConnectionState, AddFilesResult } from '../shared/types';

type IpcCallback<T> = (data: T) => void;

function onEvent<T>(channel: string, extract?: (event: Electron.IpcRendererEvent, ...args: any[]) => T) {
  return (callback: IpcCallback<T>) => {
    const handler = extract
      ? (...args: [Electron.IpcRendererEvent, ...any[]]) => callback(extract(...args))
      : () => callback(undefined as T);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  };
}

const api = {
  // Configuração
  getConfig: (): Promise<Config> => ipcRenderer.invoke(IPC_CHANNELS.CONFIG_GET),
  setConfig: (config: Partial<Config>): Promise<Config> =>
    ipcRenderer.invoke(IPC_CHANNELS.CONFIG_SET, config),
  mapGroup: (folderName: string, whatsappId: string): Promise<Config> =>
    ipcRenderer.invoke(IPC_CHANNELS.CONFIG_MAP_GROUP, folderName, whatsappId),

  // Arquivos
  scanBoletos: (): Promise<GroupStatus[]> => ipcRenderer.invoke(IPC_CHANNELS.FILES_SCAN),
  selectFiles: (defaultPath?: string): Promise<string[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.DIALOG_SELECT_FILES, defaultPath),
  addFiles: (groupName: string, filePaths: string[]): Promise<AddFilesResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.FILES_ADD, groupName, filePaths),
  deleteFile: (filePath: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.FILES_DELETE, filePath),
  openFile: (filePath: string): Promise<string> =>
    ipcRenderer.invoke(IPC_CHANNELS.FILES_OPEN, filePath),
  getGroupPath: (groupName: string): Promise<string> =>
    ipcRenderer.invoke(IPC_CHANNELS.CONFIG_GET_GROUP_PATH, groupName),

  // Observador de arquivos
  onFilesChanged: onEvent<void>(IPC_CHANNELS.FILES_CHANGED),

  // WhatsApp
  getWhatsAppGroups: (): Promise<WhatsAppGroup[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.WHATSAPP_GET_GROUPS),
  getWhatsAppStatus: (): Promise<WhatsAppConnectionState> =>
    ipcRenderer.invoke(IPC_CHANNELS.WHATSAPP_GET_STATUS),
  getInitError: (): Promise<string | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.WHATSAPP_GET_INIT_ERROR),
  logout: (): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.WHATSAPP_LOGOUT),

  // Envio
  sendAll: (): Promise<SendProgress> => ipcRenderer.invoke(IPC_CHANNELS.SEND_ALL),

  // Eventos
  onQrCode: onEvent<string>(IPC_CHANNELS.WHATSAPP_QR, (_, qr) => qr),
  onWhatsAppReady: onEvent<void>(IPC_CHANNELS.WHATSAPP_READY),
  onWhatsAppDisconnected: onEvent<void>(IPC_CHANNELS.WHATSAPP_DISCONNECTED),
  onWhatsAppAuthFailure: onEvent<string>(IPC_CHANNELS.WHATSAPP_AUTH_FAILURE, (_, msg) => msg),
  onWhatsAppInitError: onEvent<string>(IPC_CHANNELS.WHATSAPP_INIT_ERROR, (_, msg) => msg),
  onSendProgress: onEvent<SendProgress>(IPC_CHANNELS.SEND_PROGRESS, (_, progress) => progress),
  onSendComplete: onEvent<SendProgress>(IPC_CHANNELS.SEND_COMPLETE, (_, progress) => progress),
};

contextBridge.exposeInMainWorld('electronAPI', api);

export type ElectronAPI = typeof api;
