import React, { useEffect } from 'react';
import { AlertTriangle, Send } from 'lucide-react';

interface ConfirmDialogProps {
  title: string;
  message: string;
  deleteOriginalFiles?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ title, message, deleteOriginalFiles, onConfirm, onCancel }: ConfirmDialogProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <AlertTriangle size={24} className="modal-header-icon warning" />
          <h3>{title}</h3>
        </div>
        <p>{message}</p>
        <p className="helper-text" style={{ paddingLeft: 0, marginTop: 12 }}>
          As cópias na pasta de boletos serão removidas após o envio.
          {deleteOriginalFiles && ' Os arquivos originais também serão excluídos.'}
        </p>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onCancel}>
            Cancelar
          </button>
          <button className="btn btn-primary" onClick={onConfirm}>
            <Send size={16} className="btn-icon" />
            Confirmar Envio
          </button>
        </div>
      </div>
    </div>
  );
}
