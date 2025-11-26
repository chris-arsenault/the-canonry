/**
 * React hook for project storage
 *
 * Provides unified interface for IndexedDB operations with React state management.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  openDatabase,
  saveProject,
  loadProject,
  deleteProject,
  listProjects,
  isIndexedDBAvailable
} from './indexeddb.js';
import { exportProject, promptImportProject } from './export-import.js';
import { createEmptyProject } from './types.js';

/**
 * Fetch and load the default example project
 * @returns {Promise<Object|null>} The default project or null if fetch fails
 */
async function fetchDefaultProject() {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}default-project.json`);
    if (!response.ok) {
      console.warn('Default project not found');
      return null;
    }
    const project = await response.json();
    // Update timestamps to now
    const now = new Date().toISOString();
    project.createdAt = now;
    project.updatedAt = now;
    return project;
  } catch (error) {
    console.warn('Failed to load default project:', error);
    return null;
  }
}

/**
 * Hook for managing project storage
 * @returns {Object} Storage operations and state
 */
export function useProjectStorage() {
  const [projects, setProjects] = useState([]);
  const [currentProject, setCurrentProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [storageAvailable, setStorageAvailable] = useState(true);

  // Initialize database and load project list
  useEffect(() => {
    const init = async () => {
      if (!isIndexedDBAvailable()) {
        setStorageAvailable(false);
        setLoading(false);
        setError('IndexedDB not available. Projects will not persist.');
        return;
      }

      try {
        await openDatabase();
        let projectList = await listProjects();

        // If no projects exist, load the default example project
        if (projectList.length === 0) {
          const defaultProject = await fetchDefaultProject();
          if (defaultProject) {
            await saveProject(defaultProject);
            projectList = await listProjects();
          }
        }

        setProjects(projectList);

        // Auto-load most recent project if available
        if (projectList.length > 0) {
          const recent = await loadProject(projectList[0].id);
          setCurrentProject(recent);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  // Refresh project list
  const refreshProjects = useCallback(async () => {
    try {
      const projectList = await listProjects();
      setProjects(projectList);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  // Create new project
  const createProject = useCallback(async (name) => {
    try {
      const project = createEmptyProject(name);
      await saveProject(project);
      setCurrentProject(project);
      await refreshProjects();
      return project;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [refreshProjects]);

  // Load a project by ID
  const loadProjectById = useCallback(async (id) => {
    try {
      setLoading(true);
      const project = await loadProject(id);
      if (project) {
        setCurrentProject(project);
      }
      return project;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Save current project
  const saveCurrentProject = useCallback(async (updatedProject) => {
    try {
      const projectToSave = updatedProject || currentProject;
      if (!projectToSave) return;

      await saveProject(projectToSave);
      setCurrentProject(projectToSave);
      await refreshProjects();
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [currentProject, refreshProjects]);

  // Update current project (merge changes)
  const updateProject = useCallback(async (changes) => {
    if (!currentProject) return;

    const updated = {
      ...currentProject,
      ...changes,
      updatedAt: new Date().toISOString()
    };

    await saveCurrentProject(updated);
    return updated;
  }, [currentProject, saveCurrentProject]);

  // Delete a project
  const deleteProjectById = useCallback(async (id) => {
    try {
      await deleteProject(id);

      // If deleting current project, clear it
      if (currentProject?.id === id) {
        setCurrentProject(null);
      }

      await refreshProjects();
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [currentProject, refreshProjects]);

  // Export current project
  const exportCurrentProject = useCallback((filename) => {
    if (!currentProject) {
      setError('No project to export');
      return;
    }
    exportProject(currentProject, filename);
  }, [currentProject]);

  // Import a project
  const importProjectFromFile = useCallback(async () => {
    try {
      const project = await promptImportProject();
      await saveProject(project);
      setCurrentProject(project);
      await refreshProjects();
      return project;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [refreshProjects]);

  // Update worldSchema
  const updateWorldSchema = useCallback(async (worldSchema) => {
    return updateProject({ worldSchema });
  }, [updateProject]);

  // Update cultures
  const updateCultures = useCallback(async (cultures) => {
    return updateProject({ cultures });
  }, [updateProject]);

  // Update a single culture
  const updateCulture = useCallback(async (cultureId, cultureData) => {
    if (!currentProject) return;

    const cultures = {
      ...currentProject.cultures,
      [cultureId]: cultureData
    };

    return updateProject({ cultures });
  }, [currentProject, updateProject]);

  // Delete a culture
  const deleteCulture = useCallback(async (cultureId) => {
    if (!currentProject) return;

    const cultures = { ...currentProject.cultures };
    delete cultures[cultureId];

    // Also remove from worldSchema.cultures
    const worldSchema = {
      ...currentProject.worldSchema,
      cultures: currentProject.worldSchema.cultures.filter(c => c.id !== cultureId)
    };

    return updateProject({ cultures, worldSchema });
  }, [currentProject, updateProject]);

  // Update entity config for a culture/entityKind
  const updateEntityConfig = useCallback(async (cultureId, entityKind, config) => {
    if (!currentProject) return;

    const culture = currentProject.cultures[cultureId] || { domains: [], entityConfigs: {} };
    const updatedCulture = {
      ...culture,
      entityConfigs: {
        ...culture.entityConfigs,
        [entityKind]: config
      }
    };

    return updateCulture(cultureId, updatedCulture);
  }, [currentProject, updateCulture]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    // State
    projects,
    currentProject,
    loading,
    error,
    storageAvailable,

    // Project operations
    createProject,
    loadProjectById,
    saveCurrentProject,
    updateProject,
    deleteProjectById,
    exportCurrentProject,
    importProjectFromFile,

    // Data operations
    updateWorldSchema,
    updateCultures,
    updateCulture,
    deleteCulture,
    updateEntityConfig,

    // Utilities
    clearError,
    refreshProjects
  };
}
