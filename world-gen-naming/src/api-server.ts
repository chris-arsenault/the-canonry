#!/usr/bin/env node
/**
 * API Server for Web UI
 *
 * Exposes REST endpoints for LLM generation and domain management.
 */

import express from "express";
import cors from "cors";
import { readdirSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { createLLMClient } from "./builder/llm-client.js";
import { generateLexemeList } from "./builder/lexeme-generator.js";
import { generateTemplates } from "./builder/template-generator.js";
import { writeLexemeResult, writeTemplateResult } from "./builder/file-writer.js";
import { optimizeDomain, optimizeBatch } from "./lib/optimizer.js";
import type {
  LexemeSlotSpec,
  TemplateSpec,
  LLMConfig,
} from "./types/builder-spec.js";

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

/**
 * POST /api/generate/lexeme
 * Generate a lexeme list from a spec
 */
app.post("/api/generate/lexeme", async (req, res) => {
  try {
    const spec: LexemeSlotSpec = req.body.spec;
    const metaDomain = req.body.metaDomain;
    const apiKey = req.body.apiKey || process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return res.status(400).json({
        error: "API key required. Provide in request body or ANTHROPIC_API_KEY env var.",
      });
    }

    const llmConfig: LLMConfig = {
      provider: "anthropic",
      apiKey,
      model: req.body.model || "claude-haiku-4-5-20251001",
      temperature: req.body.temperature ?? 1.0,
    };

    const client = createLLMClient(llmConfig);

    const result = await generateLexemeList(spec, client, {
      verbose: false,
    });

    // Save to disk if metaDomain provided
    if (metaDomain) {
      const outputDir = `./data/${metaDomain}/lexemes`;
      const filepath = writeLexemeResult(result, {
        outputDir,
        overwrite: true,
        verbose: false,
      });
      console.log(`📝 GENERATED & SAVED: Lexeme list "${spec.id}" for "${metaDomain}"`);
      console.log(`   - ${result.entries.length} entries (${result.filtered} filtered)`);
      console.log(`   - ${result.metadata?.tokensUsed || 0} tokens, ${result.metadata?.durationMs || 0}ms`);
      console.log(`   - → ${filepath}`);
    }

    res.json({
      success: true,
      result: {
        entries: result.entries,
        filtered: result.filtered,
        tokensUsed: result.metadata?.tokensUsed,
        durationMs: result.metadata?.durationMs,
      },
    });
  } catch (error) {
    console.error("Lexeme generation error:", error);
    res.status(500).json({
      error: (error as Error).message,
    });
  }
});

/**
 * POST /api/generate/template
 * Generate templates from a spec
 */
app.post("/api/generate/template", async (req, res) => {
  try {
    const spec: TemplateSpec = req.body.spec;
    const metaDomain = req.body.metaDomain;
    const apiKey = req.body.apiKey || process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return res.status(400).json({
        error: "API key required. Provide in request body or ANTHROPIC_API_KEY env var.",
      });
    }

    const llmConfig: LLMConfig = {
      provider: "anthropic",
      apiKey,
      model: req.body.model || "claude-haiku-4-5-20251001",
      temperature: req.body.temperature ?? 1.0,
    };

    const client = createLLMClient(llmConfig);

    const result = await generateTemplates(spec, client, {
      verbose: false,
    });

    // Save to disk if metaDomain provided
    if (metaDomain) {
      const outputDir = `./data/${metaDomain}/profiles`;
      const filepath = writeTemplateResult(result, {
        outputDir,
        overwrite: true,
        verbose: false,
      });
      console.log(`📝 GENERATED & SAVED: Templates "${spec.id}" for "${metaDomain}"`);
      console.log(`   - ${result.templates.length} templates (${result.filtered} filtered)`);
      console.log(`   - ${result.metadata?.tokensUsed || 0} tokens, ${result.metadata?.durationMs || 0}ms`);
      console.log(`   - → ${filepath}`);
    }

    res.json({
      success: true,
      result: {
        templates: result.templates,
        filtered: result.filtered,
        tokensUsed: result.metadata?.tokensUsed,
        durationMs: result.metadata?.durationMs,
      },
    });
  } catch (error) {
    console.error("Template generation error:", error);
    res.status(500).json({
      error: (error as Error).message,
    });
  }
});

/**
 * POST /api/manual-lexeme
 * Save a manually created lexeme list
 */
app.post("/api/manual-lexeme", (req, res) => {
  try {
    const { metaDomain, lexemeList } = req.body;

    if (!metaDomain || !lexemeList || !lexemeList.id || !lexemeList.entries) {
      return res.status(400).json({
        error: "Missing required fields: metaDomain, lexemeList.id, lexemeList.entries",
      });
    }

    const lexemesDir = `./data/${metaDomain}/lexemes`;
    if (!existsSync(lexemesDir)) {
      mkdirSync(lexemesDir, { recursive: true });
    }

    // Save as a collection file with a single list
    const filename = `${lexemeList.id}.json`;
    const filepath = `${lexemesDir}/${filename}`;

    const fileContent = {
      lexemeLists: [
        {
          id: lexemeList.id,
          description: lexemeList.description || "Manual list",
          entries: lexemeList.entries,
        },
      ],
    };

    writeFileSync(filepath, JSON.stringify(fileContent, null, 2), "utf-8");

    console.log(`📝 SAVED: Manual lexeme list "${lexemeList.id}" for "${metaDomain}"`);
    console.log(`   - ${lexemeList.entries.length} entries`);
    console.log(`   - → ${filepath}`);

    res.json({
      success: true,
      filepath,
      list: lexemeList,
    });
  } catch (error) {
    console.error("Manual lexeme save error:", error);
    res.status(500).json({
      error: (error as Error).message,
    });
  }
});

/**
 * POST /api/test-names
 * Generate test names using a profile
 */
app.post("/api/test-names", async (req, res) => {
  try {
    const { metaDomain, profileId, count = 10, profile, domains, grammars, lexemes } = req.body;

    if (!profile) {
      return res.status(400).json({ error: "Profile required" });
    }

    console.log(`🧪 TEST: Generating ${count} names with profile "${profileId}"`);

    // Import name generation modules
    const { createNameGenerator } = require("./index.js");

    // Convert lexemes object to array format
    const lexemeLists = Object.keys(lexemes || {})
      .filter(id => !lexemes[id].type || lexemes[id].type === 'lexeme')
      .map(id => ({
        id,
        description: lexemes[id].description || '',
        entries: lexemes[id].entries || []
      }));

    // Build configuration
    const config = {
      domains: domains || [],
      grammars: grammars || [],
      lexemeLists,
      profiles: [profile]
    };

    // Create name generator
    const generator = createNameGenerator(config);

    // Generate names
    const names: string[] = [];
    for (let i = 0; i < count; i++) {
      const name = generator.generate(profile.id);
      names.push(name);
    }

    console.log(`✅ Generated ${names.length} test names`);
    console.log(`   Sample: ${names.slice(0, 3).join(', ')}...`);

    res.json({
      success: true,
      names,
      profileId,
      count: names.length
    });
  } catch (error) {
    console.error("Test name generation error:", error);
    res.status(500).json({
      error: (error as Error).message,
    });
  }
});

/**
 * POST /api/validate/lexeme-spec
 * Validate a lexeme slot spec
 */
app.post("/api/validate/lexeme-spec", (req, res) => {
  try {
    const { validateLexemeSlotSpec } = require("./builder/spec-loader.js");
    const spec = validateLexemeSlotSpec(req.body);
    res.json({ valid: true, spec });
  } catch (error) {
    res.status(400).json({
      valid: false,
      error: (error as Error).message,
    });
  }
});

/**
 * POST /api/validate/template-spec
 * Validate a template spec
 */
app.post("/api/validate/template-spec", (req, res) => {
  try {
    const { validateTemplateSpec } = require("./builder/spec-loader.js");
    const spec = validateTemplateSpec(req.body);
    res.json({ valid: true, spec });
  } catch (error) {
    res.status(400).json({
      valid: false,
      error: (error as Error).message,
    });
  }
});

/**
 * GET /api/meta-domains
 * List all available meta-domains
 */
app.get("/api/meta-domains", (req, res) => {
  try {
    const dataDir = "./data";
    if (!existsSync(dataDir)) {
      return res.json({ metaDomains: [] });
    }

    const entries = readdirSync(dataDir, { withFileTypes: true });
    const metaDomains = entries
      .filter(entry => entry.isDirectory() && entry.name !== "seed") // Exclude seed
      .map(entry => entry.name);

    res.json({ metaDomains });
  } catch (error) {
    res.status(500).json({
      error: (error as Error).message,
    });
  }
});

/**
 * POST /api/meta-domains
 * Create a new meta-domain
 */
app.post("/api/meta-domains", (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !/^[a-z0-9_-]+$/.test(name)) {
      return res.status(400).json({
        error: "Invalid meta-domain name. Use lowercase letters, numbers, hyphens, and underscores only."
      });
    }

    const metaDomainPath = `./data/${name}`;
    if (existsSync(metaDomainPath)) {
      return res.status(400).json({
        error: `Meta-domain '${name}' already exists.`
      });
    }

    // Create directory structure
    mkdirSync(`${metaDomainPath}/domains`, { recursive: true });
    mkdirSync(`${metaDomainPath}/grammars`, { recursive: true });
    mkdirSync(`${metaDomainPath}/lexemes`, { recursive: true });
    mkdirSync(`${metaDomainPath}/profiles`, { recursive: true });

    res.json({ success: true, name });
  } catch (error) {
    res.status(500).json({
      error: (error as Error).message,
    });
  }
});

/**
 * GET /api/meta-domains/:name
 * Get contents of a meta-domain
 */
app.get("/api/meta-domains/:name", (req, res) => {
  try {
    const { name } = req.params;
    const metaDomainPath = `./data/${name}`;

    if (!existsSync(metaDomainPath)) {
      return res.status(404).json({
        error: `Meta-domain '${name}' not found.`
      });
    }

    const loadFiles = (dir: string, collectionKey?: string) => {
      const fullPath = `${metaDomainPath}/${dir}`;
      if (!existsSync(fullPath)) return [];

      const files = readdirSync(fullPath)
        .filter(file => file.endsWith('.json'))
        .map(file => {
          const content = readFileSync(`${fullPath}/${file}`, 'utf-8');
          return { filename: file, content: JSON.parse(content) };
        });

      // If collectionKey provided, flatten collection files ONLY
      if (collectionKey) {
        const items: any[] = [];
        for (const file of files) {
          if (file.content[collectionKey]) {
            // This is a collection file, extract the array
            items.push(...file.content[collectionKey]);
          }
          // Skip individual files - only load from collection files
        }
        return items;
      }

      // Otherwise return individual files only
      return files
        .filter(file => {
          const content = file.content;
          return !(content.domains || content.lexemeLists || content.profiles || content.grammarRules);
        })
        .map(f => f.content);
    };

    // Load specs from root if exists
    let specs = null;
    const specsPath = `${metaDomainPath}/specs.json`;
    if (existsSync(specsPath)) {
      const specsContent = readFileSync(specsPath, 'utf-8');
      specs = JSON.parse(specsContent);
    }

    res.json({
      name,
      domains: loadFiles('domains', 'domains'),
      grammars: loadFiles('grammars', 'grammarRules'),
      lexemes: loadFiles('lexemes', 'lexemeLists'),
      profiles: loadFiles('profiles', 'profiles'),
      specs: specs,
    });
  } catch (error) {
    res.status(500).json({
      error: (error as Error).message,
    });
  }
});

/**
 * POST /api/save
 * Save generated content to file system
 */
app.post("/api/save", async (req, res) => {
  try {
    const { metaDomain, type, data } = req.body;

    if (!metaDomain || !type || !data) {
      return res.status(400).json({
        error: "Missing required fields: metaDomain, type, data"
      });
    }

    // For now, just acknowledge - actual saving happens in generation endpoints
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({
      error: (error as Error).message,
    });
  }
});

/**
 * POST /api/optimize/domain
 * Optimize a single domain configuration
 */
app.post("/api/optimize/domain", async (req, res) => {
  try {
    const { domain, validationSettings, fitnessWeights, optimizationSettings } = req.body;

    if (!domain) {
      return res.status(400).json({ error: "Domain configuration required" });
    }

    const result = await optimizeDomain(
      domain,
      validationSettings,
      fitnessWeights,
      optimizationSettings
    );

    res.json({
      success: true,
      result
    });
  } catch (error) {
    console.error("Domain optimization error:", error);
    res.status(500).json({
      error: (error as Error).message,
    });
  }
});

/**
 * POST /api/optimize/batch
 * Optimize multiple domains
 */
app.post("/api/optimize/batch", async (req, res) => {
  try {
    const { domains, validationSettings, fitnessWeights, optimizationSettings } = req.body;

    if (!domains || !Array.isArray(domains) || domains.length === 0) {
      return res.status(400).json({ error: "Domains array required" });
    }

    const results = await optimizeBatch(
      domains,
      validationSettings,
      fitnessWeights,
      optimizationSettings
    );

    res.json({
      success: true,
      results
    });
  } catch (error) {
    console.error("Batch optimization error:", error);
    res.status(500).json({
      error: (error as Error).message,
    });
  }
});

/**
 * POST /api/meta-domains/:name/specs
 * Save lexeme and template specs to file system
 */
app.post("/api/meta-domains/:name/specs", async (req, res) => {
  try {
    const { name } = req.params;
    const { lexemeSpecs, templateSpecs } = req.body;

    const specsDir = `./data/${name}`;
    if (!existsSync(specsDir)) {
      mkdirSync(specsDir, { recursive: true });
    }

    const specs = {
      lexemeSpecs: lexemeSpecs || [],
      templateSpecs: templateSpecs || []
    };

    const filepath = `${specsDir}/specs.json`;
    writeFileSync(filepath, JSON.stringify(specs, null, 2), "utf-8");

    console.log(`📝 SAVED: Specs for "${name}" → ${filepath}`);
    console.log(`   - ${lexemeSpecs?.length || 0} lexeme specs, ${templateSpecs?.length || 0} template specs`);

    res.json({ success: true, filepath });
  } catch (error) {
    console.error("Save specs error:", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/meta-domains/:name/domains
 * Save domains to file system
 */
app.post("/api/meta-domains/:name/domains", async (req, res) => {
  try {
    const { name } = req.params;
    const { domains } = req.body;

    if (!domains || !Array.isArray(domains)) {
      return res.status(400).json({ error: "Domains array required" });
    }

    const domainsDir = `./data/${name}/domains`;
    if (!existsSync(domainsDir)) {
      mkdirSync(domainsDir, { recursive: true });
    }

    const filepath = `${domainsDir}/all-domains.json`;
    writeFileSync(filepath, JSON.stringify({ domains }, null, 2), "utf-8");

    const cultures = [...new Set(domains.map(d => d.cultureId).filter(Boolean))];
    console.log(`📝 SAVED: Domains for "${name}" → ${filepath}`);
    console.log(`   - ${domains.length} domains`);
    console.log(`   - Cultures: ${cultures.join(', ')}`);
    domains.forEach(d => {
      console.log(`     • ${d.id} (culture: ${d.cultureId || 'NONE'})`);
    });

    res.json({ success: true, filepath });
  } catch (error) {
    console.error("Save domains error:", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/meta-domains/:name/grammars
 * Save grammars to file system
 */
app.post("/api/meta-domains/:name/grammars", async (req, res) => {
  try {
    const { name } = req.params;
    const { grammars } = req.body;

    if (!grammars || !Array.isArray(grammars)) {
      return res.status(400).json({ error: "Grammars array required" });
    }

    const grammarsDir = `./data/${name}/grammars`;
    if (!existsSync(grammarsDir)) {
      mkdirSync(grammarsDir, { recursive: true });
    }

    // Group grammars by cultureId and save each culture's grammars
    const byCulture = grammars.reduce((acc, grammar) => {
      const cultureId = grammar.cultureId || "default";
      if (!acc[cultureId]) acc[cultureId] = [];
      acc[cultureId].push(grammar);
      return acc;
    }, {} as Record<string, any[]>);

    const filepaths: string[] = [];
    console.log(`📝 SAVED: Grammars for "${name}"`);
    for (const [cultureId, cultureGrammars] of Object.entries(byCulture)) {
      const filepath = `${grammarsDir}/${cultureId}.json`;
      writeFileSync(
        filepath,
        JSON.stringify({ grammarRules: cultureGrammars }, null, 2),
        "utf-8"
      );
      filepaths.push(filepath);
      console.log(`   - ${cultureId}: ${(cultureGrammars as any[]).length} rules → ${filepath}`);
    }

    res.json({ success: true, filepaths });
  } catch (error) {
    console.error("Save grammars error:", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/meta-domains/:name/profiles
 * Save profiles to file system
 */
app.post("/api/meta-domains/:name/profiles", async (req, res) => {
  try {
    const { name } = req.params;
    const { profiles } = req.body;

    if (!profiles || !Array.isArray(profiles)) {
      return res.status(400).json({ error: "Profiles array required" });
    }

    const profilesDir = `./data/${name}/profiles`;
    if (!existsSync(profilesDir)) {
      mkdirSync(profilesDir, { recursive: true });
    }

    // Group profiles by cultureId and save each culture's profiles
    const byCulture = profiles.reduce((acc, profile) => {
      const cultureId = profile.cultureId || "default";
      if (!acc[cultureId]) acc[cultureId] = [];
      acc[cultureId].push(profile);
      return acc;
    }, {} as Record<string, any[]>);

    const filepaths: string[] = [];
    console.log(`📝 SAVED: Profiles for "${name}"`);
    for (const [cultureId, cultureProfiles] of Object.entries(byCulture)) {
      const filepath = `${profilesDir}/${cultureId}.json`;
      writeFileSync(
        filepath,
        JSON.stringify({ profiles: cultureProfiles }, null, 2),
        "utf-8"
      );
      filepaths.push(filepath);
      console.log(`   - ${cultureId}: ${(cultureProfiles as any[]).length} profiles → ${filepath}`);
    }

    res.json({ success: true, filepaths });
  } catch (error) {
    console.error("Save profiles error:", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * ============================================================================
 * V2 API - Culture-Centric Endpoints
 * ============================================================================
 */

import {
  loadMetaDomain,
  loadCulture,
  saveCulture,
  saveEntityConfig,
  createCulture,
  listCultures,
  deleteCulture as deleteCultureFromDisk,
  migrateOldStructure,
} from "./schema/cultureStorage.js";
import {
  loadWorldSchema as loadSchema,
  autoGenerateProfile,
} from "./schema/worldSchemaLoader.js";

/**
 * GET /api/v2/schema
 * Get world schema
 */
app.get("/api/v2/schema", (req, res) => {
  try {
    const schema = loadSchema();
    res.json({ success: true, schema });
  } catch (error) {
    console.error("Schema load error:", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/v2/meta-domains/:metaDomain
 * Load full meta-domain v2 structure
 */
app.get("/api/v2/meta-domains/:metaDomain", (req, res) => {
  try {
    const { metaDomain } = req.params;
    const data = loadMetaDomain(metaDomain);

    if (!data) {
      return res.status(404).json({ error: `Meta-domain '${metaDomain}' not found` });
    }

    res.json({ success: true, data });
  } catch (error) {
    console.error("Meta-domain load error:", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/v2/cultures/:metaDomain
 * List all cultures in a meta-domain
 */
app.get("/api/v2/cultures/:metaDomain", (req, res) => {
  try {
    const { metaDomain } = req.params;
    const cultures = listCultures(metaDomain);

    res.json({ success: true, cultures });
  } catch (error) {
    console.error("Culture list error:", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/v2/cultures/:metaDomain/:cultureId
 * Load specific culture configuration
 */
app.get("/api/v2/cultures/:metaDomain/:cultureId", (req, res) => {
  try {
    const { metaDomain, cultureId } = req.params;
    const culture = loadCulture(metaDomain, cultureId);

    if (!culture) {
      return res.status(404).json({
        error: `Culture '${cultureId}' not found in meta-domain '${metaDomain}'`
      });
    }

    res.json({ success: true, culture });
  } catch (error) {
    console.error("Culture load error:", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/v2/cultures/:metaDomain
 * Create new culture
 */
app.post("/api/v2/cultures/:metaDomain", (req, res) => {
  try {
    const { metaDomain } = req.params;
    const { cultureId, cultureName } = req.body;

    if (!cultureId || !/^[a-z0-9_-]+$/.test(cultureId)) {
      return res.status(400).json({
        error: "Invalid culture ID. Use lowercase letters, numbers, hyphens, and underscores only."
      });
    }

    const culture = createCulture(metaDomain, cultureId, cultureName || cultureId);

    res.json({ success: true, culture });
  } catch (error) {
    console.error("Culture creation error:", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * PUT /api/v2/cultures/:metaDomain/:cultureId
 * Update culture configuration
 */
app.put("/api/v2/cultures/:metaDomain/:cultureId", (req, res) => {
  try {
    const { metaDomain, cultureId } = req.params;
    const { culture } = req.body;

    if (!culture) {
      return res.status(400).json({ error: "Culture data required" });
    }

    // Ensure IDs match
    culture.id = cultureId;

    saveCulture(metaDomain, culture);

    res.json({ success: true, culture });
  } catch (error) {
    console.error("Culture update error:", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * DELETE /api/v2/cultures/:metaDomain/:cultureId
 * Delete culture
 */
app.delete("/api/v2/cultures/:metaDomain/:cultureId", (req, res) => {
  try {
    const { metaDomain, cultureId } = req.params;

    const deleted = deleteCultureFromDisk(metaDomain, cultureId);

    if (!deleted) {
      return res.status(404).json({
        error: `Culture '${cultureId}' not found in meta-domain '${metaDomain}'`
      });
    }

    res.json({ success: true, deleted: true });
  } catch (error) {
    console.error("Culture deletion error:", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * PUT /api/v2/entity-config/:metaDomain/:cultureId/:entityKind
 * Update entity configuration
 */
app.put("/api/v2/entity-config/:metaDomain/:cultureId/:entityKind", (req, res) => {
  try {
    const { metaDomain, cultureId, entityKind } = req.params;
    const { config } = req.body;

    if (!config) {
      return res.status(400).json({ error: "Entity config data required" });
    }

    // Ensure kind matches
    config.kind = entityKind;

    saveEntityConfig(metaDomain, cultureId, config);

    res.json({ success: true, config });
  } catch (error) {
    console.error("Entity config update error:", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/v2/auto-profile/:metaDomain/:cultureId/:entityKind
 * Generate auto-profile from entity config components
 */
app.post("/api/v2/auto-profile/:metaDomain/:cultureId/:entityKind", (req, res) => {
  try {
    const { metaDomain, cultureId, entityKind } = req.params;
    const { config } = req.body;

    if (!config) {
      return res.status(400).json({ error: "Entity config required" });
    }

    const profile = autoGenerateProfile(cultureId, entityKind, config);

    // Save the profile back to the entity config
    config.profile = profile;
    config.completionStatus.profile = true;
    saveEntityConfig(metaDomain, cultureId, config);

    res.json({ success: true, profile });
  } catch (error) {
    console.error("Auto-profile generation error:", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/v2/migrate/:metaDomain
 * Migrate old flat structure to new hierarchical structure
 */
app.post("/api/v2/migrate/:metaDomain", (req, res) => {
  try {
    const { metaDomain } = req.params;

    migrateOldStructure(metaDomain);

    res.json({ success: true, message: `Migration complete for '${metaDomain}'` });
  } catch (error) {
    console.error("Migration error:", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Start server
app.listen(port, () => {
  console.log(`API server running on http://localhost:${port}`);
  console.log(`API key: ${process.env.ANTHROPIC_API_KEY ? "Set" : "Not set (will require in requests)"}`);
});
