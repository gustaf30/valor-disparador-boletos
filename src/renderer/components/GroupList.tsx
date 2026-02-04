import React, { useState, useCallback } from 'react';
import {
  CheckCircle,
  AlertTriangle,
  FileText,
  Plus,
  RefreshCw,
  ChevronDown,
  X,
  Upload,
  FolderOpen,
  Link
} from 'lucide-react';
import type { GroupStatus, WhatsAppGroup } from '../../shared/types';

interface GroupListProps {
  groups: GroupStatus[];
  whatsappGroups: WhatsAppGroup[];
  onAddFiles: (groupName: string) => void;
  onMapGroup: (groupName: string) => void;
  onRefresh: () => void;
  onDeleteFile: (groupName: string, filePath: string) => void;
  onOpenFile: (filePath: string) => void;
}

export function GroupList({ groups, whatsappGroups, onAddFiles, onMapGroup, onRefresh, onDeleteFile, onOpenFile }: GroupListProps) {
  const [newGroupName, setNewGroupName] = useState('');
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [dragOverGroup, setDragOverGroup] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleExpand = (groupName: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupName)) {
      newExpanded.delete(groupName);
    } else {
      newExpanded.add(groupName);
    }
    setExpandedGroups(newExpanded);
  };

  const getFileName = (filePath: string) => {
    const parts = filePath.replace(/\\/g, '/').split('/');
    return parts[parts.length - 1];
  };

  const hasAutoMatch = (groupName: string) => {
    return whatsappGroups.some(
      wg => wg.name.toLowerCase() === groupName.toLowerCase()
    );
  };

  const handleCreateGroup = () => {
    if (newGroupName.trim()) {
      onAddFiles(newGroupName.trim());
      setNewGroupName('');
      setShowNewGroup(false);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent, groupName: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverGroup(groupName);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverGroup(null);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, groupName: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverGroup(null);

    const files = Array.from(e.dataTransfer.files);
    const pdfFiles = files.filter(f => f.name.toLowerCase().endsWith('.pdf'));

    if (pdfFiles.length > 0) {
      const paths = pdfFiles.map(f => f.path);
      await window.electronAPI.addFiles(groupName, paths);
      onRefresh();
    }
  }, [onRefresh]);

  return (
    <div className="groups-section">
      <div className="groups-header">
        <h2>Grupos configurados</h2>
        <div className="groups-header-actions">
          <button
            className="btn btn-secondary btn-small"
            onClick={onRefresh}
            title="Atualizar lista de grupos"
          >
            <RefreshCw size={14} className="btn-icon" />
            Atualizar
          </button>
          <button
            className="btn btn-secondary btn-small"
            onClick={() => setShowNewGroup(!showNewGroup)}
          >
            <Plus size={14} className="btn-icon" />
            Novo Grupo
          </button>
        </div>
      </div>

      {showNewGroup && (
        <div className="new-group-form">
          <input
            type="text"
            className="new-group-input"
            placeholder="Nome do grupo (pasta)"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateGroup()}
          />
          <div className="new-group-actions">
            <button className="btn btn-primary btn-small" onClick={handleCreateGroup}>
              <Plus size={14} className="btn-icon" />
              Criar e Adicionar Arquivos
            </button>
            <button className="btn btn-secondary btn-small" onClick={() => setShowNewGroup(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {groups.length === 0 ? (
        <div className="empty-state">
          <FolderOpen className="empty-state-illustration" strokeWidth={1} />
          <h3>Nenhum grupo configurado</h3>
          <p>Clique em "Novo Grupo" para criar uma pasta</p>
          <p>ou arraste arquivos PDF para a area abaixo.</p>
        </div>
      ) : (
        groups.map((group) => (
          <div key={group.name} className="group-container">
            <div
              className={`group-item ${dragOverGroup === group.name ? 'drag-active' : ''}`}
              onDragOver={(e) => handleDragOver(e, group.name)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, group.name)}
            >
              <div className="group-info">
                <div className="group-name-row">
                  {group.whatsappId ? (
                    <CheckCircle size={16} className="group-status-icon mapped" />
                  ) : (
                    <AlertTriangle size={16} className="group-status-icon unmapped" />
                  )}
                  <span className="group-name">{group.name}</span>
                </div>
                <div className="group-meta">
                  <span
                    className={`group-count-badge ${group.fileCount === 0 ? 'empty' : ''} ${group.fileCount > 0 ? 'clickable' : ''}`}
                    onClick={() => group.fileCount > 0 && toggleExpand(group.name)}
                    title={group.fileCount > 0 ? 'Clique para ver/ocultar arquivos' : undefined}
                  >
                    <FileText size={14} className="badge-icon" />
                    {group.fileCount} boleto{group.fileCount !== 1 ? 's' : ''}
                    {group.fileCount > 0 && (
                      <ChevronDown
                        size={12}
                        className={`expand-icon ${expandedGroups.has(group.name) ? 'expanded' : ''}`}
                      />
                    )}
                  </span>
                  {!group.whatsappId && (
                    <span className="group-unmapped">
                      <AlertTriangle size={12} className="badge-icon" />
                      Nao vinculado
                    </span>
                  )}
                </div>
              </div>
              <div className="group-actions">
                <button
                  className="btn btn-secondary btn-small"
                  onClick={() => onAddFiles(group.name)}
                  title="Adicionar boletos"
                >
                  <Plus size={14} className="btn-icon" />
                  Adicionar
                </button>
                {(!hasAutoMatch(group.name) || group.whatsappId) && (
                  <button
                    className="btn btn-secondary btn-small"
                    onClick={() => onMapGroup(group.name)}
                    title="Configurar grupo WhatsApp"
                  >
                    <Link size={14} className="btn-icon" />
                    {group.whatsappId ? 'Alterar' : 'Vincular'}
                  </button>
                )}
              </div>
            </div>
            {expandedGroups.has(group.name) && group.files.length > 0 && (
              <div className="group-files">
                {group.files.map((filePath) => (
                  <div key={filePath} className="file-item">
                    <div className="file-info">
                      <FileText size={14} className="file-icon" />
                      <span
                        className="file-name clickable"
                        onClick={() => onOpenFile(filePath)}
                        title="Clique para abrir o documento"
                      >
                        {getFileName(filePath)}
                      </span>
                    </div>
                    <button
                      className="btn-delete"
                      onClick={() => onDeleteFile(group.name, filePath)}
                      title="Remover arquivo"
                    >
                      <X size={14} className="delete-icon" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))
      )}

      <div
        className={`drop-zone ${dragOverGroup === '__new__' ? 'active' : ''}`}
        onDragOver={(e) => handleDragOver(e, '__new__')}
        onDragLeave={handleDragLeave}
        onDrop={(e) => {
          e.preventDefault();
          setDragOverGroup(null);
          setShowNewGroup(true);
        }}
      >
        <p>
          <Upload size={18} className="drop-zone-icon" />
          Arraste arquivos PDF aqui para criar um novo grupo
        </p>
      </div>
    </div>
  );
}
