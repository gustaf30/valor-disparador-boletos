import React, { useState } from 'react';
import { Settings as SettingsIcon, X } from 'lucide-react';
import type { Config } from '../../shared/types';

interface SettingsProps {
  config: Config;
  onSave: (config: Partial<Config>) => void;
  onClose: () => void;
}

export function Settings({ config, onSave, onClose }: SettingsProps) {
  const [messageSingular, setMessageSingular] = useState(config.messageSingular);
  const [messagePlural, setMessagePlural] = useState(config.messagePlural);
  const [deleteOriginalFiles, setDeleteOriginalFiles] = useState(config.deleteOriginalFiles ?? false);

  const handleSave = () => {
    onSave({ messageSingular, messagePlural, deleteOriginalFiles });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <SettingsIcon size={24} className="modal-header-icon" />
          <h3>Configurar Mensagens</h3>
        </div>

        <div className="form-group">
          <label htmlFor="messageSingular">Mensagem (1 boleto):</label>
          <input
            id="messageSingular"
            type="text"
            className="settings-input"
            value={messageSingular}
            onChange={(e) => setMessageSingular(e.target.value)}
            placeholder="Segue boleto em anexo."
          />
        </div>

        <div className="form-group">
          <label htmlFor="messagePlural">Mensagem (2+ boletos):</label>
          <input
            id="messagePlural"
            type="text"
            className="settings-input"
            value={messagePlural}
            onChange={(e) => setMessagePlural(e.target.value)}
            placeholder="Seguem os boletos em anexo."
          />
        </div>

        <div className="form-group checkbox-group">
          <label htmlFor="deleteOriginalFiles" className="checkbox-label">
            <input
              id="deleteOriginalFiles"
              type="checkbox"
              checked={deleteOriginalFiles}
              onChange={(e) => setDeleteOriginalFiles(e.target.checked)}
            />
            <span className="checkbox-text">Excluir arquivos originais apos envio</span>
          </label>
          <span className="helper-text">
            Quando ativado, os arquivos PDF originais selecionados via "Adicionar" serao excluidos apos o envio bem-sucedido.
          </span>
        </div>

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>
            <X size={16} className="btn-icon" />
            Cancelar
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
