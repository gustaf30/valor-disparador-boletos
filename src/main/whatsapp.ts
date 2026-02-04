import { Client, LocalAuth, MessageMedia } from 'whatsapp-web.js';
import { EventEmitter } from 'events';
import path from 'path';
import { WhatsAppGroup, WhatsAppConnectionState } from '../shared/types';

export class WhatsAppClient extends EventEmitter {
  private client: Client;
  private isReady: boolean = false;
  private connectionState: WhatsAppConnectionState = 'disconnected';
  private lastError: string | null = null;

  constructor(dataPath: string) {
    super();

    this.client = new Client({
      authStrategy: new LocalAuth({
        dataPath: path.join(dataPath, 'whatsapp-session'),
      }),
      puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      },
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.on('qr', (qr) => {
      this.connectionState = 'disconnected';
      this.emit('qr', qr);
    });

    this.client.on('ready', () => {
      this.isReady = true;
      this.connectionState = 'connected';
      this.lastError = null;
      this.emit('ready');
    });

    this.client.on('authenticated', () => {
      this.emit('authenticated');
    });

    this.client.on('auth_failure', (msg) => {
      this.isReady = false;
      this.connectionState = 'error';
      this.lastError = msg || 'Falha na autenticação';
      this.emit('auth_failure', this.lastError);
    });

    this.client.on('disconnected', (reason) => {
      this.isReady = false;
      this.connectionState = 'disconnected';
      this.emit('disconnected', reason);
    });
  }

  async initialize(): Promise<void> {
    this.connectionState = 'connecting';
    try {
      await this.client.initialize();
    } catch (error) {
      this.connectionState = 'error';
      this.lastError = error instanceof Error ? error.message : 'Erro ao inicializar WhatsApp';
      console.error('Failed to initialize WhatsApp client:', error);
      this.emit('auth_failure', this.lastError);
      throw error;
    }
  }

  async getGroups(): Promise<WhatsAppGroup[]> {
    if (!this.isReady) {
      return [];
    }

    try {
      const chats = await this.client.getChats();
      const groups = chats
        .filter((chat) => chat.isGroup)
        .map((chat) => ({
          id: chat.id._serialized,
          name: chat.name,
        }));

      return groups;
    } catch (error) {
      console.error('Failed to get groups:', error);
      return [];
    }
  }

  async sendFile(groupId: string, filePath: string): Promise<void> {
    if (!this.isReady) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const media = MessageMedia.fromFilePath(filePath);
      await this.client.sendMessage(groupId, media);
    } catch (error) {
      console.error(`Failed to send file to ${groupId}:`, error);
      throw error;
    }
  }

  async sendMessage(groupId: string, text: string): Promise<void> {
    if (!this.isReady) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      await this.client.sendMessage(groupId, text);
    } catch (error) {
      console.error(`Failed to send message to ${groupId}:`, error);
      throw error;
    }
  }

  async destroy(): Promise<void> {
    try {
      await this.client.destroy();
    } catch (error) {
      console.error('Error destroying client:', error);
    }
  }

  async logout(): Promise<void> {
    try {
      await this.client.logout();
      this.isReady = false;
      this.connectionState = 'disconnected';
    } catch (error) {
      console.error('Error logging out:', error);
      throw error;
    }
  }

  getIsReady(): boolean {
    return this.isReady;
  }

  getConnectionState(): WhatsAppConnectionState {
    return this.connectionState;
  }

  getLastError(): string | null {
    return this.lastError;
  }
}
