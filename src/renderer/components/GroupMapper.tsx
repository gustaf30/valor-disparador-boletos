import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, FolderOpen, Search, AlertTriangle, Check, Loader2, RefreshCw } from 'lucide-react';
import type { WhatsAppGroup } from '../../shared/types';

interface GroupMapperProps {
  folderName: string;
  onFetchGroups: () => Promise<WhatsAppGroup[]>;
  onSave: (whatsappId: string) => void;
  onCancel: () => void;
}

export const GroupMapper = React.memo(function GroupMapper({ folderName, onFetchGroups, onSave, onCancel }: GroupMapperProps) {
  const [selectedId, setSelectedId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [groups, setGroups] = useState<WhatsAppGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadGroups = useCallback(async (signal?: { cancelled: boolean }) => {
    setIsLoading(true);
    setError(null);
    try {
      const fetchedGroups = await onFetchGroups();
      if (!signal?.cancelled) setGroups(fetchedGroups);
    } catch (err) {
      if (!signal?.cancelled) setError('Erro ao carregar grupos. Tente novamente.');
    } finally {
      if (!signal?.cancelled) setIsLoading(false);
    }
  }, [onFetchGroups]);

  useEffect(() => {
    const signal = { cancelled: false };
    loadGroups(signal);
    return () => { signal.cancelled = true; };
  }, [loadGroups]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  const filteredGroups = useMemo(() =>
    groups.filter(g => g.name.toLowerCase().includes(searchTerm.toLowerCase())),
    [groups, searchTerm]
  );

  const handleSave = () => {
    if (selectedId) {
      onSave(selectedId);
    }
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <Link size={24} className="modal-header-icon" />
          <h3>Vincular grupo WhatsApp</h3>
        </div>

        <div className="group-mapper-info">
          <FolderOpen size={18} className="folder-icon" />
          <span>Pasta: <strong>{folderName}</strong></span>
        </div>

        {isLoading ? (
          <div className="loading-state">
            <Loader2 size={24} className="spinner" />
            <span>Carregando grupos...</span>
          </div>
        ) : error ? (
          <div className="error-state">
            <AlertTriangle size={24} className="warning-icon" />
            <span>{error}</span>
            <button className="btn btn-secondary" onClick={() => loadGroups()}>
              Tentar novamente
            </button>
          </div>
        ) : (
          <>
            <div className="search-input-wrapper">
              <Search size={16} className="search-icon" />
              <input
                type="text"
                className="new-group-input"
                placeholder="Buscar grupo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ marginBottom: 0 }}
              />
              <button
                className="btn btn-icon-only btn-secondary refresh-btn"
                onClick={() => loadGroups()}
                title="Atualizar lista"
                aria-label="Atualizar lista"
                disabled={isLoading}
              >
                <RefreshCw size={16} />
              </button>
            </div>

            <select
              className="group-select"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              size={8}
              style={{ height: 200, marginTop: 12 }}
            >
              <option value="">Selecione um grupo...</option>
              {filteredGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>

            {groups.length === 0 && (
              <div className="no-groups-warning">
                <AlertTriangle size={16} className="warning-icon" />
                <span>Nenhum grupo encontrado. Verifique sua conexão com o WhatsApp.</span>
              </div>
            )}
          </>
        )}

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onCancel}>
            Cancelar
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={!selectedId || isLoading}
          >
            <Check size={16} className="btn-icon" />
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
});
