import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { Settings as SettingsIcon } from 'lucide-react';
import { QRCode } from './components/QRCode';
import { GroupList } from './components/GroupList';
import { SendButton } from './components/SendButton';
import { Status } from './components/Status';
import { GroupMapper } from './components/GroupMapper';
import { ConfirmDialog } from './components/ConfirmDialog';
import { Settings } from './components/Settings';
import type { GroupStatus, SendProgress, WhatsAppGroup, WhatsAppConnectionState, Config, AddFilesResult } from '../shared/types';
import logo from './public/logo.jpg';

declare global {
  interface Window {
    electronAPI: {
      getConfig: () => Promise<Config>;
      setConfig: (config: Partial<Config>) => Promise<Config>;
      mapGroup: (folderName: string, whatsappId: string) => Promise<Config>;
      scanBoletos: () => Promise<GroupStatus[]>;
      selectFiles: (defaultPath?: string) => Promise<string[]>;
      addFiles: (groupName: string, filePaths: string[]) => Promise<AddFilesResult>;
      deleteFile: (filePath: string) => Promise<boolean>;
      getGroupPath: (groupName: string) => Promise<string>;
      getWhatsAppGroups: () => Promise<WhatsAppGroup[]>;
      getWhatsAppStatus: () => Promise<WhatsAppConnectionState>;
      getInitError: () => Promise<string | null>;
      logout: () => Promise<void>;
      openFile: (filePath: string) => Promise<string>;
      sendAll: () => Promise<SendProgress>;
      onQrCode: (callback: (qr: string) => void) => () => void;
      onWhatsAppReady: (callback: () => void) => () => void;
      onWhatsAppDisconnected: (callback: () => void) => () => void;
      onWhatsAppAuthFailure: (callback: (msg: string) => void) => () => void;
      onWhatsAppInitError: (callback: (msg: string) => void) => () => void;
      onFilesChanged: (callback: () => void) => () => void;
      onSendProgress: (callback: (progress: SendProgress) => void) => () => void;
      onSendComplete: (callback: (progress: SendProgress) => void) => () => void;
    };
  }
}


function App() {
  const [connectionStatus, setConnectionStatus] = useState<WhatsAppConnectionState>('connecting');
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

  // Guarda contra chamadas concorrentes ao scanBoletos
  const scanInFlightRef = useRef<Promise<GroupStatus[]> | null>(null);
  const debouncedScan = useCallback((): Promise<GroupStatus[]> => {
    if (scanInFlightRef.current) return scanInFlightRef.current;
    const p = window.electronAPI.scanBoletos().finally(() => {
      scanInFlightRef.current = null;
    });
    scanInFlightRef.current = p;
    return p;
  }, []);

  // Auto-mapeia pastas com grupos WhatsApp de mesmo nome
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
      const updated = await debouncedScan();
      setGroups(updated);
    }
  }, [debouncedScan]);

  // Busca grupos e auto-mapeia (usado em vários callbacks)
  const fetchAndAutoMap = useCallback(async (status?: WhatsAppConnectionState) => {
    const [scanned, waGroups] = await Promise.all([
      debouncedScan(),
      window.electronAPI.getWhatsAppGroups()
    ]);
    setGroups(scanned);
    setWhatsappGroups(waGroups);
    const isConnected = status === 'connected';
    if (isConnected && waGroups.length > 0) {
      await autoMapGroups(scanned, waGroups);
    }
  }, [autoMapGroups, debouncedScan]);

  const refreshGroups = useCallback(async () => {
    if (!window.electronAPI) return;
    try {
      const status = await window.electronAPI.getWhatsAppStatus();
      await fetchAndAutoMap(status);
    } catch (error) {
      console.error('Falha ao atualizar grupos:', error);
    }
  }, [fetchAndAutoMap]);

  // Listeners IPC (montado uma vez)
  useEffect(() => {
    if (!window.electronAPI) {
      console.error('electronAPI não disponível — preload pode não ter carregado');
      return;
    }

    const unsubQr = window.electronAPI.onQrCode((qr) => {
      setQrCode(qr);
      setConnectionStatus('disconnected');
    });

    const unsubReady = window.electronAPI.onWhatsAppReady(async () => {
      setConnectionStatus('connected');
      setQrCode(null);
      try {
        await fetchAndAutoMap('connected');
      } catch (error) {
        console.error('Falha ao buscar grupos após conexão:', error);
      }
    });

    const unsubDisconnected = window.electronAPI.onWhatsAppDisconnected(() => {
      setConnectionStatus('disconnected');
    });

    const unsubAuthFailure = window.electronAPI.onWhatsAppAuthFailure((msg) => {
      setConnectionStatus('error');
      setErrorMessage(msg);
      setQrCode(null);
    });

    const unsubInitError = window.electronAPI.onWhatsAppInitError((msg) => {
      setConnectionStatus('error');
      setErrorMessage(msg);
      setQrCode(null);
    });

    const unsubProgress = window.electronAPI.onSendProgress((progress) => {
      setSendProgress(progress);
    });

    const unsubComplete = window.electronAPI.onSendComplete(async (progress) => {
      setSendProgress(progress);
      setIsSending(false);
      setLastSendTime(new Date());
      try {
        const [scanned, waGroups] = await Promise.all([
          debouncedScan(),
          window.electronAPI.getWhatsAppGroups()
        ]);
        setGroups(scanned);
        setWhatsappGroups(waGroups);
      } catch (error) {
        console.error('Falha ao atualizar após envio:', error);
      }
    });

    refreshGroups();
    window.electronAPI.getConfig().then(setConfig);

    // Consultar status atual do WhatsApp (caso ready já tenha sido emitido)
    window.electronAPI.getWhatsAppStatus().then(async (status) => {
      if (status === 'connected') {
        setConnectionStatus('connected');
        try {
          await fetchAndAutoMap('connected');
        } catch (error) {
          console.error('Falha ao buscar grupos:', error);
        }
      } else if (status === 'error') {
        setConnectionStatus('error');
        const initErr = await window.electronAPI.getInitError();
        if (initErr) {
          setErrorMessage(initErr);
        }
      } else if (status === 'disconnected') {
        setConnectionStatus('disconnected');
      }
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Observador de mudanças no filesystem
  useEffect(() => {
    if (!window.electronAPI) return;

    const unsubFilesChanged = window.electronAPI.onFilesChanged(async () => {
      try {
        const scanned = await debouncedScan();
        setGroups(scanned);
        const status = await window.electronAPI.getWhatsAppStatus();
        if (status === 'connected') {
          const waGroups = await window.electronAPI.getWhatsAppGroups();
          setWhatsappGroups(waGroups);
          if (waGroups.length > 0) {
            await autoMapGroups(scanned, waGroups);
          }
        }
      } catch (error) {
        console.error('Falha ao processar mudança de arquivos:', error);
      }
    });

    return () => unsubFilesChanged();
  }, [autoMapGroups, debouncedScan]);

  const handleAddFiles = useCallback(async (groupName: string) => {
    try {
      const groupPath = await window.electronAPI.getGroupPath(groupName);
      const files = await window.electronAPI.selectFiles(groupPath);
      if (files.length > 0) {
        const result = await window.electronAPI.addFiles(groupName, files);
        await refreshGroups();
        if (result.errors.length > 0) {
          alert(`Alguns arquivos não puderam ser copiados:\n\n${result.errors.join('\n')}`);
        }
      }
    } catch (error) {
      console.error('Falha ao adicionar arquivos:', error);
    }
  }, [refreshGroups]);

  const handleDeleteFile = useCallback(async (groupName: string, filePath: string) => {
    try {
      await window.electronAPI.deleteFile(filePath);
      await refreshGroups();
    } catch (error) {
      console.error('Falha ao excluir arquivo:', error);
    }
  }, [refreshGroups]);

  const handleMapGroup = useCallback((groupName: string) => {
    setSelectedGroup(groupName);
    setMapperOpen(true);
  }, []);

  const handleSaveMapping = useCallback(async (whatsappId: string) => {
    if (selectedGroup) {
      try {
        await window.electronAPI.mapGroup(selectedGroup, whatsappId);
        await refreshGroups();
      } catch (error) {
        console.error('Falha ao salvar mapeamento:', error);
      }
    }
    setMapperOpen(false);
    setSelectedGroup(null);
  }, [selectedGroup, refreshGroups]);

  const handleSendClick = useCallback(() => {
    setConfirmOpen(true);
  }, []);

  const handleConfirmSend = useCallback(async () => {
    setConfirmOpen(false);
    setIsSending(true);
    setSendProgress(null);
    try {
      await window.electronAPI.sendAll();
    } catch (error) {
      console.error('Falha ao enviar:', error);
      setIsSending(false);
    }
  }, []);

  const handleSaveSettings = useCallback(async (newConfig: Partial<Config>) => {
    try {
      const updated = await window.electronAPI.setConfig(newConfig);
      setConfig(updated);
    } catch (error) {
      console.error('Falha ao salvar configurações:', error);
    }
  }, []);

  const handleLogout = useCallback(async () => {
    setConnectionStatus('connecting');
    try {
      await window.electronAPI.logout();
    } catch (error) {
      console.error('Falha ao desconectar:', error);
    }
  }, []);

  const handleOpenFile = useCallback((filePath: string) => {
    window.electronAPI.openFile(filePath);
  }, []);

  const handleSettingsOpen = useCallback(() => {
    setSettingsOpen(true);
  }, []);

  const handleSettingsClose = useCallback(() => {
    setSettingsOpen(false);
  }, []);

  const handleMapperCancel = useCallback(() => {
    setMapperOpen(false);
    setSelectedGroup(null);
  }, []);

  const handleConfirmCancel = useCallback(() => {
    setConfirmOpen(false);
  }, []);

  const handleFetchGroups = useCallback(() => {
    return window.electronAPI.getWhatsAppGroups();
  }, []);

  const totalFiles = useMemo(() => groups.reduce((sum, g) => sum + g.fileCount, 0), [groups]);
  const mappedGroupsWithFiles = useMemo(() => groups.filter(g => g.whatsappId && g.fileCount > 0), [groups]);
  const filesToSend = useMemo(() => mappedGroupsWithFiles.reduce((sum, g) => sum + g.fileCount, 0), [mappedGroupsWithFiles]);

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
          onClick={handleSettingsOpen}
          title="Configurar mensagens de envio"
        >
          <SettingsIcon size={18} />
        </button>
      </header>

      <Status
        status={connectionStatus}
        errorMessage={errorMessage}
        sendProgress={isSending ? sendProgress : null}
        onLogout={handleLogout}
      />

      {connectionStatus === 'error' && !qrCode && (
        <div className="error-panel">
          <h3>Erro ao inicializar</h3>
          <p>{errorMessage || 'Ocorreu um erro ao conectar ao WhatsApp.'}</p>
          <p className="error-hint">
            Tente reiniciar o aplicativo. Se o problema persistir, faça logout e escaneie o QR code novamente.
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
            onOpenFile={handleOpenFile}
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
              Último envio: {lastSendTime.toLocaleDateString('pt-BR')} {lastSendTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </>
      )}

      {mapperOpen && selectedGroup && (
        <GroupMapper
          folderName={selectedGroup}
          onFetchGroups={handleFetchGroups}
          onSave={handleSaveMapping}
          onCancel={handleMapperCancel}
        />
      )}

      {confirmOpen && (
        <ConfirmDialog
          title="Confirmar Envio"
          message={`Deseja enviar ${filesToSend} boleto(s) para ${mappedGroupsWithFiles.length} grupo(s)?`}
          deleteOriginalFiles={config?.deleteOriginalFiles}
          onConfirm={handleConfirmSend}
          onCancel={handleConfirmCancel}
        />
      )}

      {settingsOpen && config && (
        <Settings
          config={config}
          onSave={handleSaveSettings}
          onClose={handleSettingsClose}
        />
      )}
    </div>
  );
}

export default App;
