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
import { generateFromProfile, type ExecutionContext } from "./lib/profile-executor.js";
import type { NamingProfile, LexemeList, GrammarRule } from "./types/profile.js";
import type { NamingDomain } from "./types/domain.js";
import { createRNG } from "./utils/rng.js";
import { generateWordWithDebug } from "./lib/phonology.js";
import { applyMorphologyBest, canApplyMorphology } from "./lib/morphology.js";
import { applyStyle } from "./lib/style.js";
import type {
  LexemeSlotSpec,
  TemplateSpec,
  LLMConfig,
} from "./types/builder-spec.js";
import { validateLexemeSlotSpec, validateTemplateSpec } from "./builder/spec-loader.js";

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
    const { metaDomain, profileId, count = 10, profile, domains, grammars, lexemes, templates } = req.body;

    if (!profile) {
      return res.status(400).json({ error: "Profile required" });
    }

    console.log(`🧪 TEST: Generating ${count} names with profile "${profileId}"`);
    console.log(`📥 Received from UI:`);
    console.log(`   - profile.strategies: ${JSON.stringify(profile.strategies?.map((s: any) => ({ type: s.type || s.kind, weight: s.weight, grammarId: s.grammarId, templateIds: s.templateIds })))}`);
    console.log(`   - domains count: ${(domains || []).length}, ids: ${(domains || []).map((d: any) => d.id).join(', ') || 'none'}`);
    console.log(`   - grammars count: ${(grammars || []).length}`);
    console.log(`   - templates count: ${(templates || []).length}`);
    console.log(`   - lexemes keys: ${Object.keys(lexemes || {}).join(', ')}`);

    // Convert lexemes object to array format for ExecutionContext
    const lexemeLists: LexemeList[] = Object.keys(lexemes || {})
      .filter(id => !lexemes[id].type || lexemes[id].type === 'lexeme')
      .map(id => ({
        id,
        description: lexemes[id].description || '',
        entries: lexemes[id].entries || []
      }));

    // Filter strategies - only phonotactic is fully supported by executor
    // Grammar and templated strategies with references need custom handling
    const supportedStrategies = (profile.strategies || [])
      .filter((s: any) => {
        const strategyType = s.kind || s.type;
        // Only phonotactic works reliably with the executor
        // Templated with inline template/slots would work, but templateIds references don't
        if (strategyType === 'phonotactic') return true;
        if (strategyType === 'templated' && s.template && s.slots) return true; // Has inline template
        return false;
      })
      .map((s: any) => ({
        ...s,
        kind: s.kind || s.type,
      }));

    // Templated strategies with templateIds need custom handling
    const templatedRefStrategies = (profile.strategies || []).filter((s: any) =>
      (s.kind || s.type) === 'templated' && s.templateIds && !s.template
    );

    // Grammar strategies also need custom handling
    const grammarStrategies = (profile.strategies || []).filter((s: any) =>
      (s.kind || s.type) === 'grammar'
    );

    // Build execution context for standard strategies
    const transformedProfile: NamingProfile = {
      id: profile.id,
      cultureId: profile.cultureId || '',
      type: profile.entityType || profile.type || '',
      strategies: supportedStrategies.length > 0 ? supportedStrategies : []
    };

    const context: ExecutionContext = {
      domains: domains || [],
      profiles: [transformedProfile],
      lexemeLists,
      grammarRules: [],
    };

    // Log available resources
    console.log(`📋 Available lexeme lists: ${lexemeLists.map(l => l.id).join(', ')}`);
    console.log(`📋 Available templates: ${(templates || []).map((t: any) => t.id).join(', ') || 'none'}`);
    console.log(`📋 Available grammars: ${(grammars || []).map((g: any) => g.id).join(', ') || 'none'}`);
    console.log(`📋 All strategies: ${(profile.strategies || []).map((s: any) => `${s.type || s.kind}(${(s.weight * 100).toFixed(0)}%)`).join(', ')}`);

    // Calculate weights for each strategy category
    const grammarWeight = getTotalWeight(grammarStrategies, profile.strategies);
    const templatedWeight = getTotalWeight(templatedRefStrategies, profile.strategies);
    const standardWeight = getTotalWeight(supportedStrategies, profile.strategies);

    console.log(`📊 Strategy weights - Grammar: ${(grammarWeight * 100).toFixed(0)}%, Templated: ${(templatedWeight * 100).toFixed(0)}%, Standard: ${(standardWeight * 100).toFixed(0)}%`);

    // Generate names
    const names: string[] = [];
    const strategyUsage: Record<string, number> = { grammar: 0, phonotactic: 0, templated: 0, fallback: 0 };

    for (let i = 0; i < count; i++) {
      try {
        let name: string;
        let strategyUsed: string;

        // Weighted selection between all strategy types
        const roll = Math.random();
        console.log(`  [${i}] Roll: ${roll.toFixed(3)}`);

        // Determine which strategy to use based on weighted selection
        if (grammarStrategies.length > 0 && roll < grammarWeight) {
          // Use grammar strategy
          const grammarStrategy = grammarStrategies[Math.floor(Math.random() * grammarStrategies.length)];
          const grammar = grammars?.find((g: any) => g.id === grammarStrategy.grammarId);
          console.log(`  [${i}] → GRAMMAR (roll < ${grammarWeight.toFixed(3)}), grammarId: ${grammarStrategy.grammarId}, found: ${!!grammar}`);

          if (grammar) {
            name = expandUIGrammar(grammar, lexemeLists, domains || []);
            strategyUsed = 'grammar';
          } else {
            console.log(`  [${i}]   Grammar not found, using fallback`);
            name = generateFallbackName(lexemeLists, i);
            strategyUsed = 'fallback';
          }
        } else if (templatedRefStrategies.length > 0 && roll < grammarWeight + templatedWeight) {
          // Use templated strategy with templateIds reference
          const templatedStrategy = templatedRefStrategies[Math.floor(Math.random() * templatedRefStrategies.length)];
          const templateId = templatedStrategy.templateIds?.[Math.floor(Math.random() * templatedStrategy.templateIds.length)];
          const template = templates?.find((t: any) => t.id === templateId);
          console.log(`  [${i}] → TEMPLATED (roll < ${(grammarWeight + templatedWeight).toFixed(3)}), templateId: ${templateId}, found: ${!!template}`);

          if (template) {
            name = expandUITemplate(template, lexemeLists, domains || []);
            strategyUsed = 'templated';
          } else {
            console.log(`  [${i}]   Template not found, using fallback`);
            name = generateFallbackName(lexemeLists, i);
            strategyUsed = 'fallback';
          }
        } else if (supportedStrategies.length > 0) {
          // Use standard profile executor (phonotactic)
          console.log(`  [${i}] → STANDARD (phonotactic)`);
          name = generateFromProfile(transformedProfile, {
            ...context,
            seed: `${Date.now()}-${i}`
          });
          strategyUsed = supportedStrategies[0]?.kind || 'phonotactic';
        } else {
          // Fallback to simple generation from lexemes
          console.log(`  [${i}] → FALLBACK (no valid strategies)`);
          name = generateFallbackName(lexemeLists, i);
          strategyUsed = 'fallback';
        }

        strategyUsage[strategyUsed] = (strategyUsage[strategyUsed] || 0) + 1;
        console.log(`  [${i}] ✓ Generated: "${name}" via ${strategyUsed}`);
        names.push(name);
      } catch (genError) {
        console.warn(`  [${i}] ❌ Failed:`, (genError as Error).message);
        strategyUsage['fallback'] = (strategyUsage['fallback'] || 0) + 1;
        names.push(generateFallbackName(lexemeLists, i));
      }
    }

    console.log(`📊 Strategy usage: ${JSON.stringify(strategyUsage)}`);
    console.log(`✅ Generated ${names.length} test names`);
    console.log(`   Sample: ${names.slice(0, 3).join(', ')}...`);

    res.json({
      success: true,
      names,
      strategyUsage,
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
 * Calculate total weight of given strategies relative to all strategies
 */
function getTotalWeight(strategies: any[], allStrategies: any[]): number {
  const selectedWeight = strategies.reduce((sum, s) => sum + (s.weight || 0), 0);
  const totalWeight = allStrategies.reduce((sum, s) => sum + (s.weight || 0), 0);
  return totalWeight > 0 ? selectedWeight / totalWeight : 0;
}

/**
 * Expand a grammar from UI format
 * Grammar format: { id, start, rules: { name: [["slot:list1", "literal", "slot:list2"], [...]] } }
 * Supports:
 *   - slot:lexeme_id  → pick from lexeme list
 *   - domain:domain_id → generate phonotactic name from domain
 */
function expandUIGrammar(grammar: any, lexemeLists: LexemeList[], domains: NamingDomain[]): string {
  const startSymbol = grammar.start || 'name';
  console.log(`    🔧 Grammar expansion starting from "${startSymbol}"`);
  console.log(`    🔧 Rules: ${JSON.stringify(grammar.rules)}`);
  const result = expandSymbol(startSymbol, grammar.rules || {}, lexemeLists, domains, 0);
  console.log(`    🔧 Final result: "${result}"`);
  return result;
}

function expandSymbol(symbol: string, rules: Record<string, string[][]>, lexemeLists: LexemeList[], domains: NamingDomain[], depth: number): string {
  const indent = '    ' + '  '.repeat(depth);
  console.log(`${indent}↳ Expanding symbol: "${symbol}" (depth: ${depth})`);

  if (depth > 10) {
    console.log(`${indent}⚠️ Max depth reached, returning symbol as-is`);
    return symbol;
  }

  const productions = rules[symbol];
  if (!productions || productions.length === 0) {
    console.log(`${indent}📌 No rule for "${symbol}", treating as literal/slot`);
    return resolveToken(symbol, lexemeLists, domains, depth);
  }

  // Pick random production
  const prodIndex = Math.floor(Math.random() * productions.length);
  const production = productions[prodIndex];
  console.log(`${indent}📝 Rule "${symbol}" has ${productions.length} productions, picked #${prodIndex}: ${JSON.stringify(production)}`);

  // Expand each token in the production
  const parts = production.map((token, idx) => {
    console.log(`${indent}  Token[${idx}]: "${token}"`);
    // Check if token contains multiple references separated by hyphens
    // e.g., "slot:nouns-slot:verbs" or "slot:title-domain:fantasy"
    if (token.includes('-') && (token.includes('slot:') || token.includes('domain:'))) {
      console.log(`${indent}  🔗 Compound token with hyphens, splitting...`);
      const subParts = token.split('-');
      console.log(`${indent}  🔗 Sub-parts: ${JSON.stringify(subParts)}`);
      return subParts.map((part, subIdx) => {
        const resolved = resolveToken(part.trim(), lexemeLists, domains, depth);
        console.log(`${indent}    Sub[${subIdx}]: "${part.trim()}" → "${resolved}"`);
        return resolved;
      }).join('-');
    }
    const resolved = resolveToken(token, lexemeLists, domains, depth);
    console.log(`${indent}  → Resolved to: "${resolved}"`);
    return resolved;
  });

  const result = parts.join(' ').trim();
  console.log(`${indent}✓ Symbol "${symbol}" expanded to: "${result}"`);
  return result;
}

/**
 * Generate a phonotactic name from a domain
 */
function generatePhonotacticName(domain: NamingDomain): string {
  const rng = createRNG(`${Date.now()}-${Math.random()}`);

  // Generate base word
  const { word } = generateWordWithDebug(rng, domain.phonology);

  // Apply morphology if configured
  let morphedName = word;
  if (canApplyMorphology(domain.morphology)) {
    const morphed = applyMorphologyBest(rng, word, domain.morphology);
    morphedName = morphed.result;
  }

  // Apply style
  const styled = applyStyle(rng, morphedName, domain.style);
  return styled.result;
}

function resolveToken(token: string, lexemeLists: LexemeList[], domains: NamingDomain[], depth: number = 0): string {
  const indent = '    ' + '  '.repeat(depth + 1);

  // Check for ^ terminator suffix (e.g., "domain:tech_domain^'s" → resolve domain, append "'s")
  let suffix = '';
  let baseToken = token;
  const caretIndex = token.indexOf('^');
  if (caretIndex !== -1) {
    baseToken = token.substring(0, caretIndex);
    suffix = token.substring(caretIndex + 1); // Everything after ^
    console.log(`${indent}📎 Token has suffix: base="${baseToken}", suffix="${suffix}"`);
  }

  // Handle slot:listId references (lexeme lists)
  if (baseToken.startsWith('slot:')) {
    const listId = baseToken.substring(5); // Remove 'slot:' prefix
    console.log(`${indent}🎰 Slot reference: listId="${listId}"`);
    const list = lexemeLists.find(l => l.id === listId);
    if (list && list.entries.length > 0) {
      const entry = list.entries[Math.floor(Math.random() * list.entries.length)];
      console.log(`${indent}✓ Found list with ${list.entries.length} entries, picked: "${entry}"`);
      return entry + suffix;
    }
    console.log(`${indent}❌ List "${listId}" not found! Available: ${lexemeLists.map(l => l.id).join(', ')}`);
    return listId + suffix; // Return the ID if list not found
  }

  // Handle domain:domainId references (phonotactic generation)
  if (baseToken.startsWith('domain:')) {
    const domainId = baseToken.substring(7); // Remove 'domain:' prefix
    console.log(`${indent}🔮 Domain reference: domainId="${domainId}"`);
    const domain = domains.find(d => d.id === domainId);
    if (domain) {
      const name = generatePhonotacticName(domain);
      console.log(`${indent}✓ Generated phonotactic name: "${name}"`);
      return name + suffix;
    }
    console.log(`${indent}❌ Domain "${domainId}" not found! Available: ${domains.map(d => d.id).join(', ')}`);
    return domainId + suffix; // Return the ID if domain not found
  }

  // Return literal as-is (including any ^ which wasn't part of a reference)
  console.log(`${indent}📜 Literal: "${token}"`);
  return token;
}

/**
 * Expand a template from UI format
 * Template format: { id, template: "{{slot1}}-{{slot2}}", slots: { slot1: { kind, listId?, domainId? }, ... } }
 * Supports:
 *   - kind: "lexemeList" with listId → pick from lexeme list
 *   - kind: "phonotactic" with domainId → generate from domain
 *   - No kind → use slot name as lexeme list ID (legacy behavior)
 */
function expandUITemplate(template: any, lexemeLists: LexemeList[], domains: NamingDomain[]): string {
  console.log(`    🎨 Template expansion: "${template.template}"`);
  console.log(`    🎨 Slots: ${JSON.stringify(template.slots || {})}`);

  let result = template.template || '';
  const slots = template.slots || {};

  // Find all {{placeholder}} patterns
  const placeholderRegex = /\{\{([^}]+)\}\}/g;
  let match;

  while ((match = placeholderRegex.exec(template.template)) !== null) {
    const slotName = match[1];
    const fullMatch = match[0];
    const slotConfig = slots[slotName] || {};
    console.log(`    🎯 Found placeholder: ${fullMatch} → slot "${slotName}", config: ${JSON.stringify(slotConfig)}`);

    let slotValue: string | null = null;

    // Check slot kind
    if (slotConfig.kind === 'phonotactic' && slotConfig.domainId) {
      // Generate phonotactic name from domain
      const domain = domains.find(d => d.id === slotConfig.domainId);
      if (domain) {
        slotValue = generatePhonotacticName(domain);
        console.log(`    🔮 Phonotactic slot "${slotName}" → "${slotValue}" (from domain ${slotConfig.domainId})`);
      } else {
        console.log(`    ❌ Domain "${slotConfig.domainId}" not found for slot "${slotName}"! Available: ${domains.map(d => d.id).join(', ')}`);
      }
    } else if (slotConfig.kind === 'lexemeList' && slotConfig.listId) {
      // Pick from specified lexeme list
      const list = lexemeLists.find(l => l.id === slotConfig.listId);
      if (list && list.entries.length > 0) {
        slotValue = list.entries[Math.floor(Math.random() * list.entries.length)];
        console.log(`    🎰 Lexeme slot "${slotName}" → "${slotValue}" (from list ${slotConfig.listId})`);
      } else {
        console.log(`    ❌ Lexeme list "${slotConfig.listId}" not found for slot "${slotName}"!`);
      }
    } else {
      // Legacy: use slot name as lexeme list ID
      const list = lexemeLists.find(l => l.id === slotName);
      if (list && list.entries.length > 0) {
        slotValue = list.entries[Math.floor(Math.random() * list.entries.length)];
        console.log(`    ✓ Legacy resolved "${slotName}" → "${slotValue}" (from ${list.entries.length} entries)`);
      } else {
        console.log(`    ❌ Lexeme list "${slotName}" not found! Available: ${lexemeLists.map(l => l.id).join(', ')}`);
      }
    }

    // Replace placeholder with value or fallback to slot name
    result = result.replace(fullMatch, slotValue || slotName);
  }

  // Capitalize first letter
  if (result.length > 0) {
    result = result.charAt(0).toUpperCase() + result.slice(1);
  }

  console.log(`    🎨 Final result: "${result}"`);
  return result;
}

/**
 * Generate a fallback name from available lexeme lists
 */
function generateFallbackName(lexemeLists: LexemeList[], index: number): string {
  if (lexemeLists.length === 0) {
    return `Name-${index + 1}`;
  }

  // Pick from random lists
  const parts: string[] = [];
  const numParts = Math.floor(Math.random() * 2) + 1; // 1-2 parts

  for (let i = 0; i < numParts; i++) {
    const list = lexemeLists[Math.floor(Math.random() * lexemeLists.length)];
    if (list.entries.length > 0) {
      const entry = list.entries[Math.floor(Math.random() * list.entries.length)];
      parts.push(entry);
    }
  }

  if (parts.length === 0) {
    return `Name-${index + 1}`;
  }

  // Capitalize first letter
  const name = parts.join('-');
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * POST /api/validate/lexeme-spec
 * Validate a lexeme slot spec
 */
app.post("/api/validate/lexeme-spec", (req, res) => {
  try {
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
