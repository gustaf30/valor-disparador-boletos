import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, Config, GroupStatus, SendProgress, WhatsAppGroup, WhatsAppConnectionState } from '../shared/types';

type IpcCallback<T> = (data: T) => void;

const api = {
  // Config
  getConfig: (): Promise<Config> => ipcRenderer.invoke(IPC_CHANNELS.CONFIG_GET),
  setConfig: (config: Partial<Config>): Promise<Config> =>
    ipcRenderer.invoke(IPC_CHANNELS.CONFIG_SET, config),
  mapGroup: (folderName: string, whatsappId: string): Promise<Config> =>
    ipcRenderer.invoke(IPC_CHANNELS.CONFIG_MAP_GROUP, folderName, whatsappId),

  // Files
  scanBoletos: (): Promise<GroupStatus[]> => ipcRenderer.invoke(IPC_CHANNELS.FILES_SCAN),
  selectFiles: (defaultPath?: string): Promise<string[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.DIALOG_SELECT_FILES, defaultPath),
  addFiles: (groupName: string, filePaths: string[]): Promise<string[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.FILES_ADD, groupName, filePaths),
  deleteFile: (filePath: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.FILES_DELETE, filePath),
  openFile: (filePath: string): Promise<string> =>
    ipcRenderer.invoke(IPC_CHANNELS.FILES_OPEN, filePath),
  getGroupPath: (groupName: string): Promise<string> =>
    ipcRenderer.invoke(IPC_CHANNELS.CONFIG_GET_GROUP_PATH, groupName),

  // WhatsApp
  getWhatsAppGroups: (): Promise<WhatsAppGroup[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.WHATSAPP_GET_GROUPS),
  getWhatsAppStatus: (): Promise<WhatsAppConnectionState> =>
    ipcRenderer.invoke(IPC_CHANNELS.WHATSAPP_GET_STATUS),
  getInitError: (): Promise<string | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.WHATSAPP_GET_INIT_ERROR),
  logout: (): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.WHATSAPP_LOGOUT),

  // Send
  sendAll: (): Promise<SendProgress> => ipcRenderer.invoke(IPC_CHANNELS.SEND_ALL),

  // Events
  onQrCode: (callback: IpcCallback<string>) => {
    const handler = (_: Electron.IpcRendererEvent, qr: string) => callback(qr);
    ipcRenderer.on(IPC_CHANNELS.WHATSAPP_QR, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.WHATSAPP_QR, handler);
  },

  onWhatsAppReady: (callback: IpcCallback<void>) => {
    const handler = () => callback();
    ipcRenderer.on(IPC_CHANNELS.WHATSAPP_READY, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.WHATSAPP_READY, handler);
  },

  onWhatsAppDisconnected: (callback: IpcCallback<void>) => {
    const handler = () => callback();
    ipcRenderer.on(IPC_CHANNELS.WHATSAPP_DISCONNECTED, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.WHATSAPP_DISCONNECTED, handler);
  },

  onWhatsAppAuthFailure: (callback: IpcCallback<string>) => {
    const handler = (_: Electron.IpcRendererEvent, msg: string) => callback(msg);
    ipcRenderer.on(IPC_CHANNELS.WHATSAPP_AUTH_FAILURE, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.WHATSAPP_AUTH_FAILURE, handler);
  },

  onWhatsAppInitError: (callback: IpcCallback<string>) => {
    const handler = (_: Electron.IpcRendererEvent, msg: string) => callback(msg);
    ipcRenderer.on(IPC_CHANNELS.WHATSAPP_INIT_ERROR, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.WHATSAPP_INIT_ERROR, handler);
  },

  onSendProgress: (callback: IpcCallback<SendProgress>) => {
    const handler = (_: Electron.IpcRendererEvent, progress: SendProgress) => callback(progress);
    ipcRenderer.on(IPC_CHANNELS.SEND_PROGRESS, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.SEND_PROGRESS, handler);
  },

  onSendComplete: (callback: IpcCallback<SendProgress>) => {
    const handler = (_: Electron.IpcRendererEvent, progress: SendProgress) => callback(progress);
    ipcRenderer.on(IPC_CHANNELS.SEND_COMPLETE, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.SEND_COMPLETE, handler);
  },
};

contextBridge.exposeInMainWorld('electronAPI', api);

export type ElectronAPI = typeof api;
