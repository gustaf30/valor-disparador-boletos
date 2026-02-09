import React from 'react';
import { Send, Loader2, Check, AlertCircle } from 'lucide-react';
import type { SendProgress } from '../../shared/types';

interface SendButtonProps {
  totalFiles: number;
  disabled: boolean;
  isSending: boolean;
  progress: SendProgress | null;
  onClick: () => void;
}

function getStatusMessage(progress: SendProgress): string {
  switch (progress.status) {
    case 'sending':
      return `Enviando "${progress.currentFile}" para ${progress.currentGroup}...`;
    case 'deleting':
      return `Removendo arquivo enviado...`;
    case 'waiting':
      return `Aguardando para enviar o arquivo...`;
    case 'complete':
      return `Envio finalizado!`;
    case 'error':
      return `Erro ao enviar ${progress.currentFile}`;
    default:
      return '';
  }
}

export function SendButton({ totalFiles, disabled, isSending, progress, onClick }: SendButtonProps) {
  const percentage = progress && progress.total > 0 ? Math.round((progress.sent / progress.total) * 100) : 0;
  const isComplete = progress?.status === 'complete';

  return (
    <div className="send-section">
      <div className="send-summary">
        Total: <strong>{totalFiles}</strong> boleto{totalFiles !== 1 ? 's' : ''} para enviar
      </div>

      <button
        className="btn btn-primary send-button"
        disabled={disabled}
        onClick={onClick}
      >
        {isSending ? (
          isComplete ? (
            <>
              <Check size={20} className="btn-icon success-icon" />
              Enviado!
            </>
          ) : (
            <>
              <Loader2 size={20} className="btn-icon spinner-svg" />
              Enviando...
            </>
          )
        ) : (
          <>
            <Send size={20} className="btn-icon" />
            ENVIAR TODOS
          </>
        )}
      </button>

      {isSending && progress && (
        <div className="progress-section">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${percentage}%` }} />
          </div>
          <p className="progress-text">
            {getStatusMessage(progress)} ({progress.sent}/{progress.total})
          </p>
        </div>
      )}

      {!isSending && progress && progress.errors.length > 0 && (
        <div className="error-list">
          <h4>
            <AlertCircle size={16} className="error-icon" />
            Erros durante o envio:
          </h4>
          {progress.errors.map((error, index) => (
            <p key={index} className="error-item">
              {error.file} ({error.group}): {error.error}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
