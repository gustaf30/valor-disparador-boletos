import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, X, FolderOpen, Trash2 } from 'lucide-react';
import type { Config } from '../../shared/types';

interface SettingsProps {
  config: Config;
  onSave: (config: Partial<Config>) => void;
  onClose: () => void;
}

export const Settings = React.memo(function Settings({ config, onSave, onClose }: SettingsProps) {
  const [messageSingular, setMessageSingular] = useState(config.messageSingular);
  const [messagePlural, setMessagePlural] = useState(config.messagePlural);
  const [deleteOriginalFiles, setDeleteOriginalFiles] = useState(config.deleteOriginalFiles ?? false);
  const [defaultSourceFolder, setDefaultSourceFolder] = useState(config.defaultSourceFolder ?? '');

  const canSave = messageSingular.trim().length > 0 && messagePlural.trim().length > 0;

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      messageSingular: messageSingular.trim(),
      messagePlural: messagePlural.trim(),
      deleteOriginalFiles,
      defaultSourceFolder,
    });
    onClose();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

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

        <div className="form-group">
          <label>Diretório padrão para busca de boletos:</label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="text"
              className="settings-input"
              value={defaultSourceFolder}
              readOnly
              placeholder="(pasta do grupo)"
              style={{ flex: 1 }}
            />
            <button
              className="btn btn-secondary"
              onClick={async () => {
                const folder = await window.electronAPI.selectFolder(defaultSourceFolder || undefined);
                if (folder) setDefaultSourceFolder(folder);
              }}
              title="Procurar pasta"
              type="button"
            >
              <FolderOpen size={16} className="btn-icon" />
              Procurar
            </button>
            {defaultSourceFolder && (
              <button
                className="btn btn-secondary"
                onClick={() => setDefaultSourceFolder('')}
                title="Limpar (usar pasta do grupo)"
                type="button"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
          <span className="helper-text">
            Pasta que abre ao clicar em "Adicionar". Se vazio, abre na pasta do grupo.
          </span>
        </div>

        <div className="form-group checkbox-group">
          <label htmlFor="deleteOriginalFiles" className="checkbox-label">
            <input
              id="deleteOriginalFiles"
              type="checkbox"
              checked={deleteOriginalFiles}
              onChange={(e) => setDeleteOriginalFiles(e.target.checked)}
            />
            <span className="checkbox-text">Excluir arquivos originais após envio</span>
          </label>
          <span className="helper-text">
            Quando ativado, os arquivos PDF originais selecionados via "Adicionar" serão excluídos após o envio bem-sucedido.
          </span>
        </div>

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>
            <X size={16} className="btn-icon" />
            Cancelar
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={!canSave}>
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
});
