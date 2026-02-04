import React from 'react';
import { AlertTriangle, Send } from 'lucide-react';

interface ConfirmDialogProps {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ title, message, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <AlertTriangle size={24} className="modal-header-icon warning" />
          <h3>{title}</h3>
        </div>
        <p>{message}</p>
        <p className="helper-text" style={{ paddingLeft: 0, marginTop: 12 }}>
          Os arquivos serao excluidos apos o envio bem-sucedido.
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
