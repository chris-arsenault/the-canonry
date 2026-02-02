/**
 * React hook for managing Canonry projects in IndexedDB.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  openDatabase,
  saveProject,
  loadProject,
  deleteProject,
  listProjects,
  createEmptyProject,
} from './db.js';
import { loadLastProjectId, saveLastProjectId } from './uiState.js';
import { loadWorldStore, saveWorldStore } from './worldStore.js';
import {
  getStaticPagesForProject,
  importStaticPages,
  deleteStaticPagesForProject,
  loadAndImportSeedPages,
} from './staticPageStorage.js';
import {
  compileCanonProject,
  compileCanonStaticPages,
  serializeCanonProject,
  serializeCanonStaticPages,
} from '@canonry/dsl';

/**
 * Default project ID - used to identify the default project for reload functionality
 */
export const DEFAULT_PROJECT_ID = 'project_1765083188592';

const USE_CANON_DSL = false;

/**
 * Canon project file names (default layout)
 */
const CANON_PROJECT_FILES = [
  'project',
  'entity_kinds',
  'relationship_kinds',
  'cultures',
  'tag_registry',
  'axis_definitions',
  'ui_config',
  'eras',
  'pressures',
  'generators',
  'systems',
  'actions',
  'seed_entities',
  'seed_relationships',
  'distribution_targets',
];

const PROJECT_JSON_FILES = [
  'entityKinds',
  'relationshipKinds',
  'cultures',
  'tagRegistry',
  'axisDefinitions',
  'uiConfig',
  'eras',
  'pressures',
  'generators',
  'systems',
  'actions',
  'seedEntities',
  'seedRelationships',
  'distributionTargets',
];

const PROJECT_DEFAULTS = {
  entityKinds: [],
  relationshipKinds: [],
  cultures: [],
  tagRegistry: [],
  axisDefinitions: [],
  uiConfig: null,
  eras: [],
  pressures: [],
  generators: [],
  systems: [],
  actions: [],
  seedEntities: [],
  seedRelationships: [],
  distributionTargets: null,
};

function normalizeProjectConfig(raw) {
  const project = { ...raw };
  for (const [key, fallback] of Object.entries(PROJECT_DEFAULTS)) {
    if (Array.isArray(fallback)) {
      if (!Array.isArray(project[key])) {
        project[key] = fallback;
      }
      continue;
    }
    if (project[key] === undefined) {
      project[key] = fallback;
    }
  }

  if (!project.id) {
    project.id = `project_${Date.now()}`;
  }
  if (!project.name) {
    project.name = 'New World';
  }
  if (!project.version) {
    project.version = '1.0';
  }

  return project;
}

function formatCanonDiagnostics(diagnostics = []) {
  return diagnostics
    .map((diag) => {
      if (!diag) return null;
      const location = diag.span?.start
        ? ` (${diag.span.file}:${diag.span.start.line}:${diag.span.start.column})`
        : '';
      return `${diag.message}${location}`;
    })
    .filter(Boolean)
    .join('\n');
}

/**
 * Fetch and load the default seed project from individual files
 */
async function fetchDefaultProject() {
  if (USE_CANON_DSL) {
    return fetchDefaultProjectCanon();
  }

  return fetchDefaultProjectJson();
}

async function fetchDefaultProjectCanon() {
  try {
    const baseUrl = `${import.meta.env.BASE_URL}default-project/`;

    const responses = await Promise.all(
      CANON_PROJECT_FILES.map(async (file) => {
        const response = await fetch(`${baseUrl}${file}.canon`);
        if (!response.ok) {
          console.warn(`Default project file ${file}.canon not found`);
          return { file, content: null };
        }
        const content = await response.text();
        return { file, content };
      })
    );

    const sources = responses
      .filter((entry) => entry.content !== null)
      .map((entry) => ({
        path: `${entry.file}.canon`,
        content: entry.content,
      }));

    if (sources.length === 0) {
      console.warn('Default project .canon files not found');
      return null;
    }

    const { config, diagnostics } = compileCanonProject(sources);
    if (!config || diagnostics.some((diag) => diag.severity === 'error')) {
      console.warn('Failed to compile default project:', formatCanonDiagnostics(diagnostics));
      return null;
    }

    let project = normalizeProjectConfig(config);

    let illuminatorConfig = null;
    const illuminatorResponse = await fetch(`${baseUrl}illuminatorConfig.json`);
    if (illuminatorResponse.ok) {
      illuminatorConfig = await illuminatorResponse.json();
    } else {
      console.warn('Default project illuminatorConfig.json not found');
    }

    // Update timestamps to now
    const now = new Date().toISOString();
    project.createdAt = now;
    project.updatedAt = now;
    return { project, illuminatorConfig };
  } catch (error) {
    console.warn('Failed to load default project:', error);
    return null;
  }
}

async function fetchDefaultProjectJson() {
  try {
    const baseUrl = `${import.meta.env.BASE_URL}default-project/`;

    const manifestResponse = await fetch(`${baseUrl}manifest.json`);
    if (!manifestResponse.ok) {
      console.warn('Default project manifest.json not found');
      return null;
    }

    const manifest = await manifestResponse.json();
    const project = { ...manifest };

    const responses = await Promise.all(
      PROJECT_JSON_FILES.map(async (file) => {
        const response = await fetch(`${baseUrl}${file}.json`);
        if (!response.ok) {
          console.warn(`Default project file ${file}.json not found`);
          return { file, content: undefined };
        }
        const content = await response.json();
        return { file, content };
      })
    );

    for (const entry of responses) {
      if (entry.content !== undefined) {
        project[entry.file] = entry.content;
      }
    }

    let normalized = normalizeProjectConfig(project);

    let illuminatorConfig = null;
    const illuminatorResponse = await fetch(`${baseUrl}illuminatorConfig.json`);
    if (illuminatorResponse.ok) {
      illuminatorConfig = await illuminatorResponse.json();
    } else {
      console.warn('Default project illuminatorConfig.json not found');
    }

    const now = new Date().toISOString();
    normalized.createdAt = now;
    normalized.updatedAt = now;
    return { project: normalized, illuminatorConfig };
  } catch (error) {
    console.warn('Failed to load default project:', error);
    return null;
  }
}

/**
 * Create a zip file from project data using JSZip-like structure
 * Returns a Blob containing the zip file
 *
 * @param {Object} project - The project data
 * @param {Object} options - Optional config
 * @param {Object} options.illuminatorConfig - Illuminator settings to include
 * @param {Array} options.staticPages - Static pages to include
 */
async function createProjectZip(project, options = {}) {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();

  if (USE_CANON_DSL) {
    const canonFiles = serializeCanonProject(project);
    for (const file of canonFiles) {
      zip.file(file.path, file.content);
    }

    const { staticPages } = options;
    if (staticPages && staticPages.length > 0) {
      const staticFiles = serializeCanonStaticPages(staticPages, { includeEmpty: false });
      for (const file of staticFiles) {
        zip.file(file.path, file.content);
      }
    }
  } else {
    const manifest = { ...project };
    for (const key of PROJECT_JSON_FILES) {
      delete manifest[key];
    }
    zip.file('manifest.json', JSON.stringify(manifest, null, 2));

    for (const key of PROJECT_JSON_FILES) {
      const fallback = Array.isArray(PROJECT_DEFAULTS[key]) ? [] : PROJECT_DEFAULTS[key];
      const resolved = project[key] === undefined ? fallback : project[key];
      zip.file(`${key}.json`, JSON.stringify(resolved, null, 2));
    }
  }

  // Add Illuminator configuration if provided
  const { illuminatorConfig, staticPages } = options;
  if (illuminatorConfig) {
    zip.file('illuminatorConfig.json', JSON.stringify(illuminatorConfig, null, 2));
  }

  // Add static pages if provided (JSON mode only)
  if (!USE_CANON_DSL && staticPages && staticPages.length > 0) {
    zip.file('staticPages.json', JSON.stringify(staticPages, null, 2));
  }

  return zip.generateAsync({ type: 'blob' });
}

/**
 * Extract project data from a zip file
 * Returns { project, illuminatorConfig, staticPages }
 */
async function extractProjectZip(zipBlob) {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(zipBlob);

  const canonFiles = zip.file(/\.canon$/);
  if (USE_CANON_DSL && canonFiles && canonFiles.length > 0) {
    const sources = await Promise.all(
      canonFiles.map(async (file) => ({
        path: file.name,
        content: await file.async('string'),
      }))
    );

    const { config, diagnostics } = compileCanonProject(sources);
    if (!config || diagnostics.some((diag) => diag.severity === 'error')) {
      throw new Error(`Invalid .canon project:\n${formatCanonDiagnostics(diagnostics)}`);
    }

    const project = normalizeProjectConfig(config);

    let illuminatorConfig = null;
    const illuminatorFile = zip.file('illuminatorConfig.json');
    if (illuminatorFile) {
      illuminatorConfig = JSON.parse(await illuminatorFile.async('string'));
    }

    let staticPages = [];
    const mdFiles = zip.file(/\.md$/);
    const staticSources = await Promise.all(
      [...canonFiles, ...mdFiles].map(async (file) => ({
        path: file.name,
        content: await file.async('string'),
      }))
    );
    const { pages, diagnostics: staticPageDiagnostics } = compileCanonStaticPages(staticSources);
    if (staticPageDiagnostics.some((diag) => diag.severity === 'error')) {
      throw new Error(`Invalid static pages:\n${formatCanonDiagnostics(staticPageDiagnostics)}`);
    }
    if (pages && pages.length > 0) {
      staticPages = pages;
    } else {
      const staticPagesFile = zip.file('staticPages.json');
      if (staticPagesFile) {
        staticPages = JSON.parse(await staticPagesFile.async('string'));
      }
    }

    return { project, illuminatorConfig, staticPages };
  }

  // Legacy JSON export fallback
  const manifestFile = zip.file('manifest.json');
  if (!manifestFile) {
    throw new Error('Invalid project zip: missing manifest.json');
  }
  const manifest = JSON.parse(await manifestFile.async('string'));

  const project = { ...manifest };

  const defaultValues = {
    uiConfig: null,
    distributionTargets: null,
  };

  for (const fileName of PROJECT_JSON_FILES) {
    const file = zip.file(`${fileName}.json`);
    if (file) {
      project[fileName] = JSON.parse(await file.async('string'));
    } else {
      project[fileName] = Object.prototype.hasOwnProperty.call(defaultValues, fileName)
        ? defaultValues[fileName]
        : [];
    }
  }

  // Load Illuminator config if present
  let illuminatorConfig = null;
  const illuminatorFile = zip.file('illuminatorConfig.json');
  if (illuminatorFile) {
    illuminatorConfig = JSON.parse(await illuminatorFile.async('string'));
  }

  // Load static pages if present
  let staticPages = [];
  const staticPagesFile = zip.file('staticPages.json');
  if (staticPagesFile) {
    staticPages = JSON.parse(await staticPagesFile.async('string'));
  }

  return { project, illuminatorConfig, staticPages };
}

export function useProjectStorage() {
  const [projects, setProjects] = useState([]);
  const [currentProject, setCurrentProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load project list on mount
  useEffect(() => {
    async function init() {
      try {
        await openDatabase();
        let list = await listProjects();

        // If no projects exist, load the default seed project
        if (list.length === 0) {
          const defaultData = await fetchDefaultProject();
          if (defaultData?.project) {
            await saveProject(defaultData.project);
            list = await listProjects();

            // Store illuminatorConfig in worldStore if present
            if (defaultData.illuminatorConfig) {
              const worldStoreData = {
                activeSlotIndex: 0,
                ...defaultData.illuminatorConfig,
              };
              await saveWorldStore(defaultData.project.id, worldStoreData);
            }
          }
        }

        setProjects(list);

        // Auto-load last opened project if possible, otherwise most recent
        if (list.length > 0) {
          const lastProjectId = loadLastProjectId();
          if (lastProjectId) {
            const project = await loadProject(lastProjectId);
            if (project) {
              setCurrentProject(project);
              return;
            }
          }
          const project = await loadProject(list[0].id);
          setCurrentProject(project);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  useEffect(() => {
    if (currentProject?.id) {
      saveLastProjectId(currentProject.id);
    } else {
      saveLastProjectId(null);
    }
  }, [currentProject?.id]);

  // Refresh project list
  const refreshList = useCallback(async () => {
    try {
      const list = await listProjects();
      setProjects(list);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  // Create new project
  const createProject = useCallback(
    async (name) => {
      try {
        const project = createEmptyProject(name);
        await saveProject(project);
        await refreshList();
        setCurrentProject(project);
        return project;
      } catch (err) {
        setError(err.message);
        throw err;
      }
    },
    [refreshList]
  );

  // Open existing project
  const openProject = useCallback(async (id) => {
    try {
      setLoading(true);
      const project = await loadProject(id);
      if (project) {
        setCurrentProject(project);
      } else {
        throw new Error(`Project ${id} not found`);
      }
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Save current project (auto-save on changes)
  // Uses ref to track pending updates and avoid stale closure issues
  const pendingUpdatesRef = useRef({});

  const save = useCallback(
    async (updates = {}) => {
      if (!currentProject) return;

      try {
        // Merge with any pending updates to handle rapid sequential saves
        pendingUpdatesRef.current = { ...pendingUpdatesRef.current, ...updates };
        const allUpdates = pendingUpdatesRef.current;

        const updated = { ...currentProject, ...allUpdates };
        await saveProject(updated);
        setCurrentProject(updated);

        // Clear pending updates after successful save
        pendingUpdatesRef.current = {};
        await refreshList();
      } catch (err) {
        setError(err.message);
        throw err;
      }
    },
    [currentProject, refreshList]
  );

  // Delete project
  const removeProject = useCallback(
    async (id) => {
      try {
        await deleteProject(id);
        await refreshList();

        // If deleted current project, switch to another
        if (currentProject?.id === id) {
          const list = await listProjects();
          if (list.length > 0) {
            const project = await loadProject(list[0].id);
            setCurrentProject(project);
          } else {
            setCurrentProject(null);
          }
        }
      } catch (err) {
        setError(err.message);
        throw err;
      }
    },
    [currentProject, refreshList]
  );

  // Duplicate project
  const duplicateProject = useCallback(
    async (id) => {
      try {
        const source = await loadProject(id);
        if (!source) throw new Error(`Project ${id} not found`);

        const duplicate = {
          ...source,
          id: `project_${Date.now()}`,
          name: `${source.name} (copy)`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await saveProject(duplicate);
        await refreshList();
        return duplicate;
      } catch (err) {
        setError(err.message);
        throw err;
      }
    },
    [refreshList]
  );

  // Export project as a zip file (Blob)
  // Includes Illuminator configuration from worldStore and static pages
  const exportProject = useCallback(
    async (project = currentProject) => {
      if (!project) return null;
      try {
        // Load Illuminator config from worldStore
        let illuminatorConfig = null;
        const worldStore = await loadWorldStore(project.id);
        if (worldStore) {
          // Export entityGuidance and cultureIdentities at top level
          illuminatorConfig = {
            worldContext: worldStore.worldContext || null,
            entityGuidance: worldStore.entityGuidance || null,
            cultureIdentities: worldStore.cultureIdentities || null,
            enrichmentConfig: worldStore.enrichmentConfig || null,
            styleSelection: worldStore.styleSelection || null,
          };
          // Only include if there's actual data
          const hasData = Object.values(illuminatorConfig).some(v => v !== null);
          if (!hasData) {
            illuminatorConfig = null;
          }
        }

        // Load static pages from IndexedDB
        const staticPages = await getStaticPagesForProject(project.id);

        const zipBlob = await createProjectZip(project, { illuminatorConfig, staticPages });
        return zipBlob;
      } catch (err) {
        setError(err.message);
        throw err;
      }
    },
    [currentProject]
  );

  // Import project from zip file (Blob or File)
  // Restores Illuminator configuration to worldStore and imports static pages
  const importProject = useCallback(
    async (input) => {
      try {
        let extractedData;

        // Check if input is a Blob/File (zip)
        if (input instanceof Blob) {
          extractedData = await extractProjectZip(input);
        } else {
          throw new Error('Invalid import format: expected zip file');
        }

        const { project: data, illuminatorConfig, staticPages } = extractedData;

        // Generate new ID to avoid conflicts
        let project = {
          ...data,
          id: `project_${Date.now()}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await saveProject(project);

        // Restore Illuminator configuration to worldStore
        if (illuminatorConfig) {
          const worldStoreData = {
            activeSlotIndex: 0,
            ...illuminatorConfig,
          };
          await saveWorldStore(project.id, worldStoreData);
        }

        // Import static pages if present
        if (staticPages && staticPages.length > 0) {
          await importStaticPages(project.id, staticPages);
        }

        await refreshList();
        setCurrentProject(project);
        return project;
      } catch (err) {
        setError(err.message);
        throw err;
      }
    },
    [refreshList]
  );

  // Reload current project from default files (merge overwrite)
  // Only works for the default project
  const reloadProjectFromDefaults = useCallback(
    async () => {
      if (!currentProject) return null;
      if (currentProject.id !== DEFAULT_PROJECT_ID) {
        throw new Error('Can only reload the default project from defaults');
      }

      try {
        setLoading(true);

        // Fetch fresh default project files
        const defaultData = await fetchDefaultProject();
        if (!defaultData?.project) {
          throw new Error('Failed to load default project files');
        }

        // Merge: use fresh data but preserve the current project's ID and timestamps
        const reloaded = {
          ...defaultData.project,
          id: currentProject.id,
          createdAt: currentProject.createdAt,
          updatedAt: new Date().toISOString(),
        };

        // Save the merged project to IndexedDB
        await saveProject(reloaded);

        // Reload illuminatorConfig to worldStore if present
        if (defaultData.illuminatorConfig) {
          const worldStoreData = {
            activeSlotIndex: 0,
            ...defaultData.illuminatorConfig,
          };
          await saveWorldStore(currentProject.id, worldStoreData);
        }

        // Reload static pages from default staticPages.json
        await loadAndImportSeedPages(currentProject.id);

        await refreshList();
        setCurrentProject(reloaded);
        return reloaded;
      } catch (err) {
        setError(err.message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [currentProject, refreshList]
  );

  return {
    // State
    projects,
    currentProject,
    loading,
    error,

    // Actions
    createProject,
    openProject,
    save,
    removeProject,
    duplicateProject,
    exportProject,
    importProject,
    reloadProjectFromDefaults,
    refreshList,

    // Constants
    DEFAULT_PROJECT_ID,
  };
}
