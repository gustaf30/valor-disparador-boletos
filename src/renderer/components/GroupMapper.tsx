import React, { useState } from 'react';
import { Link, FolderOpen, Search, AlertTriangle, Check } from 'lucide-react';
import type { WhatsAppGroup } from '../../shared/types';

interface GroupMapperProps {
  folderName: string;
  whatsappGroups: WhatsAppGroup[];
  onSave: (whatsappId: string) => void;
  onCancel: () => void;
}

export function GroupMapper({ folderName, whatsappGroups, onSave, onCancel }: GroupMapperProps) {
  const [selectedId, setSelectedId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredGroups = whatsappGroups.filter(g =>
    g.name.toLowerCase().includes(searchTerm.toLowerCase())
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

        {whatsappGroups.length === 0 && (
          <div className="no-groups-warning">
            <AlertTriangle size={16} className="warning-icon" />
            <span>Nenhum grupo encontrado. Certifique-se de que voce esta em grupos no WhatsApp.</span>
          </div>
        )}

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onCancel}>
            Cancelar
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={!selectedId}
          >
            <Check size={16} className="btn-icon" />
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
