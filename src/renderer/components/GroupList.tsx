import React, { useState, useCallback, useMemo } from 'react';
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

interface GroupItemProps {
  group: GroupStatus;
  isExpanded: boolean;
  isDragOver: boolean;
  hasAutoMatch: boolean;
  onToggleExpand: (groupName: string) => void;
  onAddFiles: (groupName: string) => void;
  onMapGroup: (groupName: string) => void;
  onDeleteFile: (groupName: string, filePath: string) => void;
  onOpenFile: (filePath: string) => void;
  onDragOver: (e: React.DragEvent, groupName: string) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, groupName: string) => void;
}

const getFileName = (filePath: string) => {
  const parts = filePath.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1];
};

const GroupItem = React.memo(function GroupItem({
  group,
  isExpanded,
  isDragOver,
  hasAutoMatch,
  onToggleExpand,
  onAddFiles,
  onMapGroup,
  onDeleteFile,
  onOpenFile,
  onDragOver,
  onDragLeave,
  onDrop,
}: GroupItemProps) {
  return (
    <div className="group-container">
      <div
        className={`group-item ${isDragOver ? 'drag-active' : ''}`}
        onDragOver={(e) => onDragOver(e, group.name)}
        onDragLeave={onDragLeave}
        onDrop={(e) => onDrop(e, group.name)}
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
              onClick={() => group.fileCount > 0 && onToggleExpand(group.name)}
              title={group.fileCount > 0 ? 'Clique para ver/ocultar arquivos' : undefined}
            >
              <FileText size={14} className="badge-icon" />
              {group.fileCount} boleto{group.fileCount !== 1 ? 's' : ''}
              {group.fileCount > 0 && (
                <ChevronDown
                  size={12}
                  className={`expand-icon ${isExpanded ? 'expanded' : ''}`}
                />
              )}
            </span>
            {!group.whatsappId && (
              <span className="group-unmapped">
                <AlertTriangle size={12} className="badge-icon" />
                Não vinculado
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
          {(!hasAutoMatch || group.whatsappId) && (
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
      {isExpanded && group.files.length > 0 && (
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
  );
});

interface GroupListProps {
  groups: GroupStatus[];
  whatsappGroups: WhatsAppGroup[];
  onAddFiles: (groupName: string) => void;
  onMapGroup: (groupName: string) => void;
  onRefresh: () => void;
  onDeleteFile: (groupName: string, filePath: string) => void;
  onOpenFile: (filePath: string) => void;
}

export const GroupList = React.memo(function GroupList({ groups, whatsappGroups, onAddFiles, onMapGroup, onRefresh, onDeleteFile, onOpenFile }: GroupListProps) {
  const [newGroupName, setNewGroupName] = useState('');
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [dragOverGroup, setDragOverGroup] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const autoMatchSet = useMemo(() => {
    const set = new Set<string>();
    for (const wg of whatsappGroups) {
      set.add(wg.name.toLowerCase());
    }
    return set;
  }, [whatsappGroups]);

  const toggleExpand = useCallback((groupName: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupName)) {
        next.delete(groupName);
      } else {
        next.add(groupName);
      }
      return next;
    });
  }, []);

  const handleCreateGroup = useCallback(() => {
    const name = newGroupName.trim();
    if (!name) return;
    // Rejeitar caracteres inválidos para nomes de pasta no Windows
    if (/[<>:"/\\|?*]/.test(name)) {
      alert('Nome inválido. Não use os caracteres: < > : " / \\ | ? *');
      return;
    }
    onAddFiles(name);
    setNewGroupName('');
    setShowNewGroup(false);
  }, [newGroupName, onAddFiles]);

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
      try {
        const paths = pdfFiles.map(f => f.path);
        const result = await window.electronAPI.addFiles(groupName, paths);
        if (result.errors.length > 0) {
          alert(`Alguns arquivos não puderam ser copiados:\n\n${result.errors.join('\n')}`);
        }
      } catch (error) {
        console.error('Falha ao adicionar arquivos arrastados:', error);
      } finally {
        onRefresh();
      }
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
          <p>ou arraste arquivos PDF para a área abaixo.</p>
        </div>
      ) : (
        groups.map((group) => (
          <GroupItem
            key={group.name}
            group={group}
            isExpanded={expandedGroups.has(group.name)}
            isDragOver={dragOverGroup === group.name}
            hasAutoMatch={autoMatchSet.has(group.name.toLowerCase())}
            onToggleExpand={toggleExpand}
            onAddFiles={onAddFiles}
            onMapGroup={onMapGroup}
            onDeleteFile={onDeleteFile}
            onOpenFile={onOpenFile}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          />
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
});
