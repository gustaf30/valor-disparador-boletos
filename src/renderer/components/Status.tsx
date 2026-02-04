import React from 'react';
import { CheckCircle, Loader2, WifiOff, AlertCircle, LogOut } from 'lucide-react';
import type { SendProgress } from '../../shared/types';

interface StatusProps {
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  errorMessage?: string | null;
  sendProgress?: SendProgress | null;
  onLogout?: () => void;
}

export function Status({ status, errorMessage, sendProgress, onLogout }: StatusProps) {
  const statusText: Record<string, string> = {
    connecting: 'Conectando ao WhatsApp...',
    connected: 'Conectado ao WhatsApp',
    disconnected: 'Desconectado',
    error: 'Erro de conexão',
  };

  const renderStatusIcon = () => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="status-icon connected" />;
      case 'connecting':
        return <Loader2 className="status-icon connecting" />;
      case 'disconnected':
        return <WifiOff className="status-icon disconnected" />;
      case 'error':
        return <AlertCircle className="status-icon error" />;
      default:
        return null;
    }
  };

  return (
    <div className="status-bar">
      <div className="status-icon-wrapper">
        {renderStatusIcon()}
      </div>
      <span className={`status-text ${status === 'connected' ? 'connected' : ''}`}>
        {statusText[status]}
      </span>
      {status === 'error' && errorMessage && (
        <span className="error-message"> - {errorMessage}</span>
      )}
      {sendProgress && sendProgress.currentGroup && (
        <span className="status-current-group">
          Enviando para: <strong>{sendProgress.currentGroup}</strong>
        </span>
      )}
      <div className="status-spacer" />
      {status === 'connected' && onLogout && (
        <button className="btn-logout" onClick={onLogout} title="Desconectar do WhatsApp">
          <LogOut size={14} />
          Sair
        </button>
      )}
    </div>
  );
}
