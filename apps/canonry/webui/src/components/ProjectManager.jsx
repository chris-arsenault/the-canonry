/**
 * ProjectManager - Header bar with project and slot dropdowns
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import ValidationPopover from './ValidationPopover';
import TracePopover from './TracePopover';
import SlotSelector from './SlotSelector';

const EMPTY_SLOTS = Object.freeze({});

export default function ProjectManager({
  projects,
  currentProject,
  onCreateProject,
  onOpenProject,
  onDeleteProject,
  onDuplicateProject,
  onExportProject,
  onImportProject,
  onReloadFromDefaults,
  defaultProjectId,
  onGoHome,
  validationResult,
  onNavigateToValidation,
  onRemoveProperty,
  simulationState,
  systems = [],
  // Slot management props
  slots = EMPTY_SLOTS,
  activeSlotIndex = 0,
  onLoadSlot,
  onSaveToSlot,
  onClearSlot,
  onUpdateSlotTitle,
  onExportSlot,
  onImportSlot,
  onLoadExampleOutput,
  hasDataInScratch = false,
}) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [hoveredProject, setHoveredProject] = useState(null);
  const dropdownRef = useRef(null);
  const fileInputRef = useRef(null);
  const mouseDownOnOverlay = useRef(false);

  const handleOverlayMouseDown = useCallback((e) => {
    mouseDownOnOverlay.current = e.target === e.currentTarget;
  }, []);

  const handleOverlayClick = useCallback((e) => {
    if (mouseDownOnOverlay.current && e.target === e.currentTarget) {
      setShowNewModal(false);
    }
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCreate = () => {
    if (newProjectName.trim()) {
      onCreateProject(newProjectName.trim());
      setNewProjectName('');
      setShowNewModal(false);
      setShowDropdown(false);
    }
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // Require zip file imports
      if (!file.name.endsWith('.zip') && file.type !== 'application/zip') {
        throw new Error('Unsupported file type. Import requires a .zip project export.');
      }
      await onImportProject(file);
      setShowDropdown(false);
    } catch (err) {
      alert('Failed to import: ' + err.message);
    }
    e.target.value = '';
  };

  const handleExport = async () => {
    try {
      const zipBlob = await onExportProject();
      if (!zipBlob) return;

      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentProject?.name || 'world'}.canonry.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to export: ' + err.message);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  return (
    <header className="app-header">
      <div className="app-header-left">
        <div className="app-logo" onClick={onGoHome} title="Go to home">
          The Canonry
        </div>

        <div className="project-selector" ref={dropdownRef}>
          <button
            className="project-selector-trigger"
            onClick={() => setShowDropdown(!showDropdown)}
          >
            <span className="project-selector-name">
              {currentProject?.name || 'Select Project'}
            </span>
            <span className="project-selector-chevron">{showDropdown ? '▲' : '▼'}</span>
          </button>

          {showDropdown && (
            <div className="project-dropdown">
              <div className="project-dropdown-header">
                <span className="project-dropdown-title">Projects</span>
                <div className="project-dropdown-actions">
                  <button
                    className="btn-sm btn-sm-primary"
                    onClick={() => {
                      setShowDropdown(false);
                      setShowNewModal(true);
                    }}
                  >
                    + New
                  </button>
                  <button
                    className="btn-sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Import
                  </button>
                </div>
              </div>

              <div className="project-list">
                {projects.length === 0 ? (
                  <div className="empty-state-compact">
                    No projects yet. Create one to get started!
                  </div>
                ) : (
                  projects.map((project) => (
                    <div
                      key={project.id}
                      className={`project-item ${
                        currentProject?.id === project.id
                          ? 'project-item-active'
                          : hoveredProject === project.id
                          ? ''
                          : ''
                      }`}
                      onClick={() => {
                        onOpenProject(project.id);
                        setShowDropdown(false);
                      }}
                      onMouseEnter={() => setHoveredProject(project.id)}
                      onMouseLeave={() => setHoveredProject(null)}
                    >
                      <div className="project-item-name">{project.name}</div>
                      <div className="project-item-meta">
                        <span>{project.entityCount} entities</span>
                        <span>{project.cultureCount} cultures</span>
                        <span>{formatDate(project.updatedAt)}</span>
                      </div>
                      <div
                        className="project-item-actions"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {project.id === defaultProjectId && onReloadFromDefaults && (
                          <button
                            className="btn-xs"
                            onClick={async () => {
                              if (confirm('Reload project from defaults? This will overwrite your configuration changes but preserve world data.')) {
                                try {
                                  await onReloadFromDefaults();
                                  setShowDropdown(false);
                                } catch (err) {
                                  alert('Failed to reload: ' + err.message);
                                }
                              }
                            }}
                          >
                            Reload Defaults
                          </button>
                        )}
                        <button
                          className="btn-xs"
                          onClick={() => onDuplicateProject(project.id)}
                        >
                          Duplicate
                        </button>
                        <button
                          className="btn-xs btn-xs-danger"
                          onClick={() => {
                            if (confirm(`Delete "${project.name}"?`)) {
                              onDeleteProject(project.id);
                            }
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {currentProject && onLoadSlot && (
          <SlotSelector
            slots={slots}
            activeSlotIndex={activeSlotIndex}
            onLoadSlot={onLoadSlot}
            onSaveToSlot={onSaveToSlot}
            onClearSlot={onClearSlot}
            onUpdateTitle={onUpdateSlotTitle}
            onExportSlot={onExportSlot}
            onImportSlot={onImportSlot}
            onLoadExampleOutput={onLoadExampleOutput}
            hasDataInScratch={hasDataInScratch}
          />
        )}
      </div>

      <div className="app-header-right">
        {currentProject && (
          <TracePopover simulationState={simulationState} systems={systems} />
        )}
        {currentProject && (
          <ValidationPopover
            validationResult={validationResult}
            onNavigateToValidation={onNavigateToValidation}
            onRemoveProperty={onRemoveProperty}
          />
        )}
        <button
          className="btn btn-secondary"
          onClick={handleExport}
          disabled={!currentProject}
        >
          Export
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".zip"
          style={{ display: 'none' }}
          onChange={handleImport}
        />
      </div>

      {showNewModal && (
        <div className="modal-overlay" onMouseDown={handleOverlayMouseDown} onClick={handleOverlayClick}>
          <div className="modal modal-simple">
            <div className="modal-header">
              <div className="modal-title">Create New Project</div>
              <button className="btn-close" onClick={() => setShowNewModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <input
                className="input"
                type="text"
                placeholder="Project name..."
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                autoFocus
              />
              <div className="modal-actions">
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowNewModal(false)}
                >
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={handleCreate}>
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
