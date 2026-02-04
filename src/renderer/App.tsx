import React, { useEffect, useState, useCallback } from 'react';
import { Settings as SettingsIcon } from 'lucide-react';
import { QRCode } from './components/QRCode';
import { GroupList } from './components/GroupList';
import { SendButton } from './components/SendButton';
import { Status } from './components/Status';
import { GroupMapper } from './components/GroupMapper';
import { ConfirmDialog } from './components/ConfirmDialog';
import { Settings } from './components/Settings';
import type { GroupStatus, SendProgress, WhatsAppGroup, Config } from '../shared/types';
import logo from './public/logo.jpg';

declare global {
  interface Window {
    electronAPI: {
      getConfig: () => Promise<Config>;
      setConfig: (config: Partial<Config>) => Promise<Config>;
      mapGroup: (folderName: string, whatsappId: string) => Promise<Config>;
      scanBoletos: () => Promise<GroupStatus[]>;
      selectFiles: (defaultPath?: string) => Promise<string[]>;
      addFiles: (groupName: string, filePaths: string[]) => Promise<string[]>;
      deleteFile: (filePath: string) => Promise<boolean>;
      getGroupPath: (groupName: string) => Promise<string>;
      getWhatsAppGroups: () => Promise<WhatsAppGroup[]>;
      getWhatsAppStatus: () => Promise<'connected' | 'connecting' | 'disconnected' | 'error'>;
      getInitError: () => Promise<string | null>;
      logout: () => Promise<void>;
      openFile: (filePath: string) => Promise<string>;
      sendAll: () => Promise<SendProgress>;
      onQrCode: (callback: (qr: string) => void) => () => void;
      onWhatsAppReady: (callback: () => void) => () => void;
      onWhatsAppDisconnected: (callback: () => void) => () => void;
      onWhatsAppAuthFailure: (callback: (msg: string) => void) => () => void;
      onWhatsAppInitError: (callback: (msg: string) => void) => () => void;
      onSendProgress: (callback: (progress: SendProgress) => void) => () => void;
      onSendComplete: (callback: (progress: SendProgress) => void) => () => void;
    };
  }
}

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

function formatInitError(error: string): string {
  // Traduzir erros comuns do Puppeteer/Chrome para português
  if (error.includes('Failed to launch the browser process') ||
      error.includes('spawn') ||
      error.includes('ENOENT') ||
      error.includes('4294967295')) {
    return 'Não foi possível iniciar o navegador Chrome. Verifique se o Google Chrome está instalado corretamente no seu computador.';
  }
  if (error.includes('Chrome') && error.includes('not found')) {
    return 'Google Chrome não encontrado. Por favor, instale o Google Chrome para usar este aplicativo.';
  }
  if (error.includes('timeout')) {
    return 'Tempo esgotado ao iniciar o navegador. Tente fechar outros programas e reiniciar o aplicativo.';
  }
  return error;
}

function App() {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [groups, setGroups] = useState<GroupStatus[]>([]);
  const [whatsappGroups, setWhatsappGroups] = useState<WhatsAppGroup[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [sendProgress, setSendProgress] = useState<SendProgress | null>(null);
  const [lastSendTime, setLastSendTime] = useState<Date | null>(null);
  const [mapperOpen, setMapperOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [config, setConfig] = useState<Config | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refreshGroups = useCallback(async () => {
    if (!window.electronAPI) return;
    try {
      const scanned = await window.electronAPI.scanBoletos();
      setGroups(scanned);
    } catch (error) {
      console.error('Failed to scan boletos:', error);
    }
  }, []);

  const fetchWhatsAppGroups = useCallback(async () => {
    if (!window.electronAPI) return;
    try {
      const waGroups = await window.electronAPI.getWhatsAppGroups();
      setWhatsappGroups(waGroups);
      return waGroups;
    } catch (error) {
      console.error('Failed to fetch WhatsApp groups:', error);
      return [];
    }
  }, []);

  const autoMapGroups = useCallback(async (folders: GroupStatus[], waGroups: WhatsAppGroup[]) => {
    let anyMapped = false;
    for (const folder of folders) {
      if (!folder.whatsappId) {
        const match = waGroups.find(
          wg => wg.name.toLowerCase() === folder.name.toLowerCase()
        );
        if (match) {
          await window.electronAPI.mapGroup(folder.name, match.id);
          anyMapped = true;
        }
      }
    }
    if (anyMapped) {
      await refreshGroups();
    }
  }, [refreshGroups]);

  useEffect(() => {
    if (!window.electronAPI) {
      console.error('electronAPI not available - preload script may not have loaded');
      return;
    }

    const unsubQr = window.electronAPI.onQrCode((qr) => {
      setQrCode(qr);
      setConnectionStatus('disconnected');
    });

    const unsubReady = window.electronAPI.onWhatsAppReady(async () => {
      setConnectionStatus('connected');
      setQrCode(null);
      const [scanned, waGroups] = await Promise.all([
        window.electronAPI.scanBoletos(),
        fetchWhatsAppGroups()
      ]);
      setGroups(scanned);
      if (waGroups && waGroups.length > 0) {
        await autoMapGroups(scanned, waGroups);
      }
    });

    const unsubDisconnected = window.electronAPI.onWhatsAppDisconnected(() => {
      setConnectionStatus('disconnected');
    });

    const unsubAuthFailure = window.electronAPI.onWhatsAppAuthFailure((msg) => {
      setConnectionStatus('error');
      setErrorMessage(formatInitError(msg));
      setQrCode(null);
    });

    const unsubInitError = window.electronAPI.onWhatsAppInitError((msg) => {
      setConnectionStatus('error');
      setErrorMessage(formatInitError(msg));
      setQrCode(null);
    });

    const unsubProgress = window.electronAPI.onSendProgress((progress) => {
      setSendProgress(progress);
    });

    const unsubComplete = window.electronAPI.onSendComplete((progress) => {
      setSendProgress(progress);
      setIsSending(false);
      setLastSendTime(new Date());
      refreshGroups();
    });

    // Initial scan
    refreshGroups();

    // Load config
    window.electronAPI.getConfig().then(setConfig);

    // Consultar status atual do WhatsApp (caso ready já tenha sido emitido)
    window.electronAPI.getWhatsAppStatus().then(async (status) => {
      if (status === 'connected') {
        setConnectionStatus('connected');
        const [scanned, waGroups] = await Promise.all([
          window.electronAPI.scanBoletos(),
          fetchWhatsAppGroups()
        ]);
        setGroups(scanned);
        if (waGroups && waGroups.length > 0) {
          await autoMapGroups(scanned, waGroups);
        }
      } else if (status === 'error') {
        setConnectionStatus('error');
        // Buscar mensagem de erro se houver
        const initErr = await window.electronAPI.getInitError();
        if (initErr) {
          setErrorMessage(formatInitError(initErr));
        }
      } else if (status === 'disconnected') {
        setConnectionStatus('disconnected');
      }
      // 'connecting' é o estado inicial, mantém como está
    });

    return () => {
      unsubQr();
      unsubReady();
      unsubDisconnected();
      unsubAuthFailure();
      unsubInitError();
      unsubProgress();
      unsubComplete();
    };
  }, [refreshGroups, fetchWhatsAppGroups, autoMapGroups]);

  const handleAddFiles = async (groupName: string) => {
    try {
      const groupPath = await window.electronAPI.getGroupPath(groupName);
      const files = await window.electronAPI.selectFiles(groupPath);
      if (files.length > 0) {
        await window.electronAPI.addFiles(groupName, files);
        await refreshGroups();
      }
    } catch (error) {
      console.error('Failed to add files:', error);
    }
  };

  const handleDeleteFile = async (groupName: string, filePath: string) => {
    try {
      await window.electronAPI.deleteFile(filePath);
      await refreshGroups();
    } catch (error) {
      console.error('Failed to delete file:', error);
    }
  };

  const handleMapGroup = (groupName: string) => {
    setSelectedGroup(groupName);
    setMapperOpen(true);
  };

  const handleSaveMapping = async (whatsappId: string) => {
    if (selectedGroup) {
      try {
        await window.electronAPI.mapGroup(selectedGroup, whatsappId);
        await refreshGroups();
      } catch (error) {
        console.error('Failed to save mapping:', error);
      }
    }
    setMapperOpen(false);
    setSelectedGroup(null);
  };

  const handleSendClick = () => {
    setConfirmOpen(true);
  };

  const handleConfirmSend = async () => {
    setConfirmOpen(false);
    setIsSending(true);
    setSendProgress(null);
    try {
      await window.electronAPI.sendAll();
    } catch (error) {
      console.error('Failed to send:', error);
      setIsSending(false);
    }
  };

  const handleSaveSettings = async (newConfig: Partial<Config>) => {
    try {
      const updated = await window.electronAPI.setConfig(newConfig);
      setConfig(updated);
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  const totalFiles = groups.reduce((sum, g) => sum + g.fileCount, 0);
  const mappedGroupsWithFiles = groups.filter(g => g.whatsappId && g.fileCount > 0);
  const filesToSend = mappedGroupsWithFiles.reduce((sum, g) => sum + g.fileCount, 0);

  return (
    <div className="app">
      <header className="header">
        <div className="header-brand">
          <img src={logo} alt="Valor Capital Mercantil" className="header-logo" />
          <div className="header-titles">
            <h1>Disparador de Boletos WhatsApp</h1>
            <p className="header-subtitle">Valor Capital Mercantil</p>
          </div>
        </div>
        <button
          className="btn btn-icon-only btn-secondary"
          onClick={() => setSettingsOpen(true)}
          title="Configurar mensagens de envio"
        >
          <SettingsIcon size={18} />
        </button>
      </header>

      <Status
        status={connectionStatus}
        errorMessage={errorMessage}
        sendProgress={isSending ? sendProgress : null}
        onLogout={async () => {
          setConnectionStatus('connecting');
          try {
            await window.electronAPI.logout();
          } catch (error) {
            console.error('Logout failed:', error);
          }
        }}
      />

      {connectionStatus === 'error' && !qrCode && (
        <div className="error-panel">
          <h3>Erro ao inicializar</h3>
          <p>{errorMessage || 'Ocorreu um erro ao conectar ao WhatsApp.'}</p>
          <p className="error-hint">
            Certifique-se de que o Google Chrome está instalado e tente reiniciar o aplicativo.
          </p>
        </div>
      )}

      {qrCode && connectionStatus !== 'connected' && (
        <QRCode qrData={qrCode} />
      )}

      {connectionStatus === 'connected' && (
        <>
          <GroupList
            groups={groups}
            whatsappGroups={whatsappGroups}
            onAddFiles={handleAddFiles}
            onMapGroup={handleMapGroup}
            onRefresh={refreshGroups}
            onDeleteFile={handleDeleteFile}
            onOpenFile={(filePath) => window.electronAPI.openFile(filePath)}
          />

          <SendButton
            totalFiles={filesToSend}
            disabled={filesToSend === 0 || isSending}
            isSending={isSending}
            progress={sendProgress}
            onClick={handleSendClick}
          />

          {lastSendTime && (
            <p className="last-send">
              Ultimo envio: {lastSendTime.toLocaleDateString('pt-BR')} {lastSendTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </>
      )}

      {mapperOpen && selectedGroup && (
        <GroupMapper
          folderName={selectedGroup}
          whatsappGroups={whatsappGroups}
          onSave={handleSaveMapping}
          onCancel={() => {
            setMapperOpen(false);
            setSelectedGroup(null);
          }}
        />
      )}

      {confirmOpen && (
        <ConfirmDialog
          title="Confirmar Envio"
          message={`Deseja enviar ${filesToSend} boleto(s) para ${mappedGroupsWithFiles.length} grupo(s)?`}
          onConfirm={handleConfirmSend}
          onCancel={() => setConfirmOpen(false)}
        />
      )}

      {settingsOpen && config && (
        <Settings
          config={config}
          onSave={handleSaveSettings}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}

export default App;
