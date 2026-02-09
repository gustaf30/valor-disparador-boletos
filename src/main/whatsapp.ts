import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs';
import pino from 'pino';
import { WhatsAppGroup, WhatsAppConnectionState } from '../shared/types';

const logger = pino({ level: 'silent' });

const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_RECONNECT_DELAY = 2000;

export class WhatsAppClient extends EventEmitter {
  private sock: any = null;
  private authDir: string;
  private isReady: boolean = false;
  private connectionState: WhatsAppConnectionState = 'disconnected';
  private lastError: string | null = null;
  private reconnectAttempts: number = 0;
  private destroyed: boolean = false;

  constructor(dataPath: string) {
    super();
    this.authDir = path.join(dataPath, 'whatsapp-session');
  }

  private async migrateOldSession(): Promise<void> {
    // Detecta formato antigo (whatsapp-web.js) e limpa se necessário
    try {
      if (!fs.existsSync(this.authDir)) return;

      const entries = fs.readdirSync(this.authDir);
      const isOldFormat = entries.some(
        (e) => e === 'Default' || e === 'session.json' || e === 'SingletonLock'
      );

      if (isOldFormat) {
        console.log('Detected old whatsapp-web.js session format, cleaning up...');
        fs.rmSync(this.authDir, { recursive: true, force: true });
        fs.mkdirSync(this.authDir, { recursive: true });
      }
    } catch (error) {
      console.error('Error migrating old session:', error);
    }
  }

  async initialize(): Promise<void> {
    if (this.destroyed) return;

    this.connectionState = 'connecting';
    this.reconnectAttempts = 0;

    try {
      await this.migrateOldSession();
      await this.connectSocket();
    } catch (error) {
      this.connectionState = 'error';
      this.lastError = error instanceof Error ? error.message : 'Erro ao inicializar WhatsApp';
      console.error('Failed to initialize WhatsApp client:', error);
      this.emit('auth_failure', this.lastError);
      throw error;
    }
  }

  private async connectSocket(): Promise<void> {
    if (this.destroyed) return;

    const baileys = await import('@whiskeysockets/baileys');
    const makeWASocket = baileys.default;
    const { useMultiFileAuthState, makeCacheableSignalKeyStore, fetchLatestBaileysVersion } = baileys;

    const { state, saveCreds } = await useMultiFileAuthState(this.authDir);
    const { version } = await fetchLatestBaileysVersion();

    this.sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger),
      },
      logger,
      browser: ['Valor Boletos', 'Desktop', '1.0.0'],
      generateHighQualityLinkPreview: false,
      printQRInTerminal: false,
      syncFullHistory: false,
      markOnlineOnConnect: false,
      shouldSyncHistoryMessage: () => false,
    });

    this.sock.ev.on('creds.update', saveCreds);

    this.sock.ev.on('connection.update', (update: any) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        this.connectionState = 'disconnected';
        this.emit('qr', qr);
      }

      if (connection === 'open') {
        this.isReady = true;
        this.connectionState = 'connected';
        this.lastError = null;
        this.reconnectAttempts = 0;
        this.emit('ready');
      }

      if (connection === 'close') {
        this.isReady = false;
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode as number | undefined;

        this.handleDisconnect(statusCode);
      }
    });
  }

  private handleDisconnect(statusCode: number | undefined): void {
    if (this.destroyed) return;

    // Deslogado (401) — não reconecta
    if (statusCode === 401) {
      this.connectionState = 'disconnected';
      this.emit('disconnected', 'loggedOut');
      return;
    }

    // Reinício necessário (515) — reconecta imediatamente
    if (statusCode === 515) {
      this.reconnectAttempts = 0;
      this.reconnect(0);
      return;
    }

    // Sessão inválida (500) — limpa e reconecta
    if (statusCode === 500) {
      console.log('Bad session detected, clearing auth data...');
      try {
        fs.rmSync(this.authDir, { recursive: true, force: true });
        fs.mkdirSync(this.authDir, { recursive: true });
      } catch (err) {
        console.error('Failed to clear session:', err);
      }
      this.reconnectAttempts = 0;
      this.reconnect(1000);
      return;
    }

    // Outros motivos — reconecta com backoff
    if (this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      const delay = BASE_RECONNECT_DELAY * Math.pow(2, this.reconnectAttempts);
      this.reconnect(delay);
    } else {
      this.connectionState = 'error';
      this.lastError = 'Falha ao reconectar após múltiplas tentativas';
      this.emit('auth_failure', this.lastError);
    }
  }

  private reconnect(delay: number): void {
    if (this.destroyed) return;

    this.reconnectAttempts++;
    this.connectionState = 'connecting';
    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);

    setTimeout(async () => {
      if (this.destroyed) return;
      try {
        await this.connectSocket();
      } catch (error) {
        console.error('Reconnection failed:', error);
        if (this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          const nextDelay = BASE_RECONNECT_DELAY * Math.pow(2, this.reconnectAttempts);
          this.reconnect(nextDelay);
        } else {
          this.connectionState = 'error';
          this.lastError = 'Falha ao reconectar após múltiplas tentativas';
          this.emit('auth_failure', this.lastError);
        }
      }
    }, delay);
  }

  async getGroups(): Promise<WhatsAppGroup[]> {
    if (!this.isReady || !this.sock) {
      return [];
    }

    try {
      const groupsObj = await this.sock.groupFetchAllParticipating();
      return Object.entries(groupsObj).map(([jid, metadata]: [string, any]) => ({
        id: jid,
        name: metadata.subject,
      }));
    } catch (error) {
      console.error('Failed to get groups:', error);
      return [];
    }
  }

  async sendFile(groupId: string, filePath: string): Promise<void> {
    if (!this.isReady || !this.sock) {
      throw new Error('Cliente WhatsApp não está pronto');
    }

    try {
      const fileName = path.basename(filePath);

      await this.sock.sendMessage(groupId, {
        document: { stream: fs.createReadStream(filePath) },
        mimetype: 'application/pdf',
        fileName,
      });
    } catch (error) {
      console.error(`Failed to send file to ${groupId}:`, error);
      throw error;
    }
  }

  async sendMessage(groupId: string, text: string): Promise<void> {
    if (!this.isReady || !this.sock) {
      throw new Error('Cliente WhatsApp não está pronto');
    }

    try {
      await this.sock.sendMessage(groupId, { text });
    } catch (error) {
      console.error(`Failed to send message to ${groupId}:`, error);
      throw error;
    }
  }

  async destroy(): Promise<void> {
    this.destroyed = true;
    this.isReady = false;
    try {
      this.sock?.end(undefined);
    } catch (error) {
      console.error('Error destroying client:', error);
    }
    this.sock = null;
  }

  async logout(): Promise<void> {
    try {
      if (this.sock) {
        await this.sock.logout();
      }
      this.isReady = false;
      this.connectionState = 'disconnected';

      try {
        fs.rmSync(this.authDir, { recursive: true, force: true });
        fs.mkdirSync(this.authDir, { recursive: true });
      } catch (err) {
        console.error('Failed to clean auth dir after logout:', err);
      }
    } catch (error) {
      console.error('Error logging out:', error);
      throw error;
    }
  }

  getConnectionState(): WhatsAppConnectionState {
    return this.connectionState;
  }

  getLastError(): string | null {
    return this.lastError;
  }
}
