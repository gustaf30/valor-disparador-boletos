export interface Config {
  boletosFolder: string;
  groups: Record<string, string>; // nome da pasta -> id do grupo whatsapp
  messageSingular: string;
  messagePlural: string;
  delayBetweenSends: number;
  deleteOriginalFiles: boolean;
  defaultSourceFolder: string;
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

export type WhatsAppConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface FileMapping {
  copied: string;
  original: string;
}

export interface AddFilesResult {
  files: string[];
  errors: string[];
}

// Canais IPC
export const IPC_CHANNELS = {
  // WhatsApp
  WHATSAPP_QR: 'whatsapp:qr',
  WHATSAPP_READY: 'whatsapp:ready',
  WHATSAPP_DISCONNECTED: 'whatsapp:disconnected',
  WHATSAPP_AUTH_FAILURE: 'whatsapp:auth-failure',
  WHATSAPP_INIT_ERROR: 'whatsapp:init-error',
  WHATSAPP_GET_GROUPS: 'whatsapp:get-groups',
  WHATSAPP_GET_STATUS: 'whatsapp:get-status',
  WHATSAPP_GET_INIT_ERROR: 'whatsapp:get-init-error',
  WHATSAPP_LOGOUT: 'whatsapp:logout',

  // Arquivos
  FILES_SCAN: 'files:scan',
  FILES_ADD: 'files:add',
  FILES_DELETE: 'files:delete',
  FILES_OPEN: 'files:open',
  FILES_CHANGED: 'files:changed',

  // Envio
  SEND_ALL: 'send:all',
  SEND_PROGRESS: 'send:progress',
  SEND_COMPLETE: 'send:complete',

  // Configuração
  CONFIG_GET: 'config:get',
  CONFIG_SET: 'config:set',
  CONFIG_MAP_GROUP: 'config:map-group',
  CONFIG_GET_GROUP_PATH: 'config:get-group-path',

  // Diálogo
  DIALOG_SELECT_FILES: 'dialog:select-files',
  DIALOG_SELECT_FOLDER: 'dialog:select-folder',
} as const;

export interface WhatsAppGroup {
  id: string;
  name: string;
}
