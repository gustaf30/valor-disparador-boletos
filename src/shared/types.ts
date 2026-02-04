export interface GroupConfig {
  name: string;
  whatsappId: string;
}

export interface Config {
  boletosFolder: string;
  groups: Record<string, string>; // folder name -> whatsapp group id
  messageSingular: string;
  messagePlural: string;
  delayBetweenSends: number;
  deleteOriginalFiles: boolean;
}

export interface GroupStatus {
  name: string;
  whatsappId: string | null;
  fileCount: number;
  files: string[];
}

export type SendStatus = 'sending' | 'deleting' | 'waiting' | 'complete' | 'error';

export interface SendProgress {
  total: number;
  sent: number;
  currentFile: string;
  currentGroup: string;
  status: SendStatus;
  errors: Array<{ file: string; group: string; error: string }>;
}

export interface WhatsAppStatus {
  connected: boolean;
  authenticated: boolean;
  qrCode: string | null;
}

export type WhatsAppConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface FileMapping {
  copied: string;
  original: string;
}

// IPC Channel names
export const IPC_CHANNELS = {
  // WhatsApp
  WHATSAPP_STATUS: 'whatsapp:status',
  WHATSAPP_QR: 'whatsapp:qr',
  WHATSAPP_READY: 'whatsapp:ready',
  WHATSAPP_DISCONNECTED: 'whatsapp:disconnected',
  WHATSAPP_AUTH_FAILURE: 'whatsapp:auth-failure',
  WHATSAPP_GET_GROUPS: 'whatsapp:get-groups',
  WHATSAPP_GET_STATUS: 'whatsapp:get-status',
  WHATSAPP_LOGOUT: 'whatsapp:logout',

  // Files
  FILES_SCAN: 'files:scan',
  FILES_ADD: 'files:add',
  FILES_DELETE: 'files:delete',
  FILES_OPEN: 'files:open',

  // Send
  SEND_ALL: 'send:all',
  SEND_PROGRESS: 'send:progress',
  SEND_COMPLETE: 'send:complete',

  // Config
  CONFIG_GET: 'config:get',
  CONFIG_SET: 'config:set',
  CONFIG_MAP_GROUP: 'config:map-group',
  CONFIG_GET_GROUP_PATH: 'config:get-group-path',

  // Dialog
  DIALOG_SELECT_FILES: 'dialog:select-files',
} as const;

export interface WhatsAppGroup {
  id: string;
  name: string;
}
