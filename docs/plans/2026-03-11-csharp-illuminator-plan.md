# Illuminator + NameForge + ApiClients Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the Illuminator enrichment pipeline, NameForge name generation, and API clients from TypeScript to C#, building on the completed Schema + Engine projects.

**Architecture:** Three new projects — NameForge (pure generation), ApiClients (HTTP clients for Claude/OpenAI/BFL/fal.ai), Illuminator (enrichment tasks, queue, prompts). NameForge is independent; Illuminator depends on both ApiClients and Engine.

**Tech Stack:** .NET 10, xUnit, System.Net.Http, System.Threading.Channels, System.Text.Json. No external NuGet packages.

**Source Reference:**
- NameForge: `~/src/the-canonry/apps/name-forge/lib/`
- Illuminator: `~/src/the-canonry/apps/illuminator/webui/src/`
- Lore Weave naming: `~/src/the-canonry/apps/lore-weave/lib/naming/`

---

## Chunk 1: NameForge — Name Generation Library

### Task 1: Scaffold NameForge Projects

**Files:**
- Create: `src/Core/TheCanonry.NameForge/TheCanonry.NameForge.csproj`
- Create: `tests/TheCanonry.NameForge.Tests/TheCanonry.NameForge.Tests.csproj`

- [ ] **Step 1: Create projects and add to solution**

```bash
cd ~/src/the-canonry-desktop
mkdir -p src/Core/TheCanonry.NameForge
dotnet new classlib -o src/Core/TheCanonry.NameForge --no-restore
dotnet sln TheCanonry.slnx add src/Core/TheCanonry.NameForge/TheCanonry.NameForge.csproj
dotnet add src/Core/TheCanonry.NameForge reference src/Core/TheCanonry.Schema/TheCanonry.Schema.csproj

mkdir -p tests/TheCanonry.NameForge.Tests
dotnet new xunit -o tests/TheCanonry.NameForge.Tests --no-restore
dotnet sln TheCanonry.slnx add tests/TheCanonry.NameForge.Tests/TheCanonry.NameForge.Tests.csproj
dotnet add tests/TheCanonry.NameForge.Tests reference src/Core/TheCanonry.NameForge/TheCanonry.NameForge.csproj
```

Delete auto-generated Class1.cs and UnitTest1.cs.

- [ ] **Step 2: Verify, commit**

```bash
dotnet test tests/TheCanonry.NameForge.Tests/ --verbosity minimal
git add -A && git commit -m "chore: scaffold NameForge project and test project"
```

---

### Task 2: NameForge Types and RNG

Port the type system and seeded random number generator.

**Reference TS:** `types/domain.ts`, `types/project.ts`, `utils/rng.ts`

**Files:**
- Create: `src/Core/TheCanonry.NameForge/Types/NamingDomain.cs` — PhonologyProfile, MorphologyProfile, StyleRules
- Create: `src/Core/TheCanonry.NameForge/Types/NamingCulture.cs` — Culture, Grammar, LexemeList, Profile, StrategyGroup, Strategy
- Create: `src/Core/TheCanonry.NameForge/Types/GenerationTypes.cs` — GenerateRequest, GenerateResult, NameDebugInfo
- Create: `src/Core/TheCanonry.NameForge/Utils/SeededRng.cs` — Seeded PRNG with pickRandom, pickWeighted, chance, shuffle
- Create: `src/Core/TheCanonry.NameForge/Utils/StringHelpers.cs` — capitalize, findSyllableBoundaries, hasForbiddenCluster
- Create: `tests/TheCanonry.NameForge.Tests/Utils/SeededRngTests.cs`

- [ ] **Step 1: Write domain and culture types** — Records for all naming configuration
- [ ] **Step 2: Write SeededRng** — Deterministic PRNG wrapping System.Random with seed. Methods: NextDouble, NextInt, PickRandom, PickWeighted, Chance, Shuffle
- [ ] **Step 3: Write StringHelpers** — Capitalize, CapitalizeWords, FindSyllableBoundaries, HasForbiddenCluster, HasFavoredCluster
- [ ] **Step 4: Write tests for RNG** — Determinism (same seed = same output), distribution, weighted picks
- [ ] **Step 5: Commit**

---

### Task 3: Phonology — Syllable and Word Generation

**Reference TS:** `phonology.ts`

**Files:**
- Create: `src/Core/TheCanonry.NameForge/Generation/Phonology.cs`
- Create: `tests/TheCanonry.NameForge.Tests/Generation/PhonologyTests.cs`

- [ ] **Step 1: Write Phonology** — GenerateSyllable (C→consonant, V→vowel template substitution), GenerateWord (multi-syllable with forbidden cluster avoidance), GenerateWordWithFavoredClusters (best-of-N)
- [ ] **Step 2: Write tests** — syllable template expansion, forbidden cluster rejection, word length within range, favored cluster boost. At least 6 tests.
- [ ] **Step 3: Commit**

---

### Task 4: Morphology and Style

**Reference TS:** `morphology.ts`, `style.ts`, `derivation.ts`

**Files:**
- Create: `src/Core/TheCanonry.NameForge/Generation/Morphology.cs`
- Create: `src/Core/TheCanonry.NameForge/Generation/Style.cs`
- Create: `src/Core/TheCanonry.NameForge/Generation/Derivation.cs`
- Create: `tests/TheCanonry.NameForge.Tests/Generation/MorphologyTests.cs`

- [ ] **Step 1: Write Morphology** — ApplyMorphology (prefix/suffix/infix attachment), ApplyMorphologyBest (best-of-N scoring), GenerateCompound, ApplyHonorific
- [ ] **Step 2: Write Style** — ApplyStyle (apostrophe/hyphen insertion at syllable boundaries, capitalization rules, rhythm bias)
- [ ] **Step 3: Write Derivation** — Agentive (-er), Superlative (-est), Gerund (-ing), Past (-ed), Possessive (-'s) with irregular verb table (~250 entries)
- [ ] **Step 4: Write tests** — morphology application, style transforms, derivation cases. At least 8 tests.
- [ ] **Step 5: Commit**

---

### Task 5: Grammar Expansion and Markov Chains

**Reference TS:** `generate.ts` (grammar expansion), `markov.ts`, `markov-loader-node.ts`

**Files:**
- Create: `src/Core/TheCanonry.NameForge/Generation/GrammarExpander.cs`
- Create: `src/Core/TheCanonry.NameForge/Generation/MarkovGenerator.cs`
- Create: `src/Core/TheCanonry.NameForge/Generation/MarkovModel.cs`
- Create: `tests/TheCanonry.NameForge.Tests/Generation/GrammarExpanderTests.cs`

- [ ] **Step 1: Write GrammarExpander** — Recursive symbol expansion. Token types: `slot:name` (grammar rule), `domain:id` (phonotactic pipeline), `markov:model` (markov chain), literals. Token modifiers: `~cap`, `~er`, `~chopL`. Strategy selection by entity kind/subtype/prominence/tags.
- [ ] **Step 2: Write MarkovGenerator** — Character-level Markov chain generation from pre-trained model. GenerateFromMarkov(model, options) with min/max length constraints.
- [ ] **Step 3: Write MarkovModel** — Record type for serialized models: order, startStates, transitions. Load from embedded JSON resources.
- [ ] **Step 4: Write tests** — grammar token expansion, modifier application, markov chain output determinism. At least 6 tests.
- [ ] **Step 5: Commit**

---

### Task 6: Phonotactic Pipeline and Main Generator

**Reference TS:** `phonotactic-pipeline.ts`, `generate.ts`

**Files:**
- Create: `src/Core/TheCanonry.NameForge/Generation/PhonotacticPipeline.cs`
- Create: `src/Core/TheCanonry.NameForge/NameGenerator.cs` — Main public API
- Create: `src/Core/TheCanonry.NameForge/NameForgeService.cs` — INameGenerationService implementation
- Create: `tests/TheCanonry.NameForge.Tests/NameGeneratorTests.cs`

- [ ] **Step 1: Write PhonotacticPipeline** — Execute 3-phase pipeline: phonology → morphology → style. Returns name string + debug info.
- [ ] **Step 2: Write NameGenerator** — Main public API: Generate(culture, request) → GenerateResult, GenerateOne(culture, kind, subtype, prominence, tags, context) → string
- [ ] **Step 3: Write NameForgeService** — Implements `TheCanonry.Engine.Engine.INameGenerationService`. Constructor takes cultures from domain config. Translates Engine types to NameForge types.
- [ ] **Step 4: Write tests** — End-to-end name generation with minimal culture config, deterministic output with seed, service integration. At least 8 tests.
- [ ] **Step 5: Commit**

---

## Chunk 2: API Clients

### Task 7: Scaffold ApiClients Project

**Files:**
- Create: `src/Infrastructure/TheCanonry.ApiClients/TheCanonry.ApiClients.csproj`
- Create: `tests/TheCanonry.ApiClients.Tests/TheCanonry.ApiClients.Tests.csproj`

- [ ] **Step 1: Create projects**

```bash
cd ~/src/the-canonry-desktop
mkdir -p src/Infrastructure/TheCanonry.ApiClients
dotnet new classlib -o src/Infrastructure/TheCanonry.ApiClients --no-restore
dotnet sln TheCanonry.slnx add src/Infrastructure/TheCanonry.ApiClients/TheCanonry.ApiClients.csproj
dotnet add src/Infrastructure/TheCanonry.ApiClients reference src/Core/TheCanonry.Schema/TheCanonry.Schema.csproj

mkdir -p tests/TheCanonry.ApiClients.Tests
dotnet new xunit -o tests/TheCanonry.ApiClients.Tests --no-restore
dotnet sln TheCanonry.slnx add tests/TheCanonry.ApiClients.Tests/TheCanonry.ApiClients.Tests.csproj
dotnet add tests/TheCanonry.ApiClients.Tests reference src/Infrastructure/TheCanonry.ApiClients/TheCanonry.ApiClients.csproj
```

- [ ] **Step 2: Verify, commit**

---

### Task 8: LLM Client Types and Interface

**Reference TS:** `llmClient.types.ts`, `llmCallTypes.ts`, `costEstimation.ts`

**Files:**
- Create: `src/Infrastructure/TheCanonry.ApiClients/Llm/ILlmClient.cs`
- Create: `src/Infrastructure/TheCanonry.ApiClients/Llm/LlmRequest.cs`
- Create: `src/Infrastructure/TheCanonry.ApiClients/Llm/LlmResponse.cs`
- Create: `src/Infrastructure/TheCanonry.ApiClients/Llm/LlmModel.cs`
- Create: `src/Infrastructure/TheCanonry.ApiClients/Llm/TokenUsage.cs`
- Create: `src/Infrastructure/TheCanonry.ApiClients/Shared/ApiKeyStore.cs`
- Create: `src/Infrastructure/TheCanonry.ApiClients/Shared/CostCalculator.cs`

- [ ] **Step 1: Write LLM types** — LlmRequest (systemPrompt, userPrompt, model, maxTokens, temperature, topP, thinkingBudget), LlmResponse (text, thinking, usage, cached, error), TokenUsage (inputTokens, outputTokens), LlmModel enum (Opus46, Sonnet46, Haiku45)
- [ ] **Step 2: Write ILlmClient interface** — CompleteAsync(request, ct), StreamAsync(request, ct) returning IAsyncEnumerable<LlmChunk>
- [ ] **Step 3: Write ApiKeyStore** — Simple dictionary-based key management. GetKey(provider), SetKey(provider, key), HasKey(provider).
- [ ] **Step 4: Write CostCalculator** — Per-model input/output token costs, image costs. EstimateTextCost, CalculateActualCost, EstimateImageCost, FormatCost.
- [ ] **Step 5: Commit**

---

### Task 9: Claude LLM Client

**Reference TS:** `llmClient.browser.ts`

**Files:**
- Create: `src/Infrastructure/TheCanonry.ApiClients/Llm/ClaudeLlmClient.cs`
- Create: `tests/TheCanonry.ApiClients.Tests/Llm/ClaudeLlmClientTests.cs`

- [ ] **Step 1: Write ClaudeLlmClient** — Implements ILlmClient. Uses HttpClient to call `https://api.anthropic.com/v1/messages`. Handles:
  - Request body construction (model, max_tokens, system, messages, thinking budget)
  - anthropic-version header, x-api-key header
  - SSE streaming response parsing (content_block_delta events with text_delta and thinking_delta)
  - Non-streaming response parsing
  - Retry logic (3 attempts with exponential backoff on 429/529)
  - Rate limit header extraction (retry-after)
  - In-memory SHA-256 cache (optional)

- [ ] **Step 2: Write tests** — Request construction verification, response parsing, retry on 429. Mock HttpMessageHandler for testing without real API calls. At least 5 tests.
- [ ] **Step 3: Commit**

---

### Task 10: Image Client Types and Implementations

**Reference TS:** `imageClient.ts`, `imageClient.bfl.ts`, `imageClient.wavespeed.ts`, `imageClient.fal.ts`

**Files:**
- Create: `src/Infrastructure/TheCanonry.ApiClients/Images/IImageClient.cs`
- Create: `src/Infrastructure/TheCanonry.ApiClients/Images/ImageRequest.cs`
- Create: `src/Infrastructure/TheCanonry.ApiClients/Images/ImageResult.cs`
- Create: `src/Infrastructure/TheCanonry.ApiClients/Images/ImageProvider.cs`
- Create: `src/Infrastructure/TheCanonry.ApiClients/Images/DalleImageClient.cs`
- Create: `src/Infrastructure/TheCanonry.ApiClients/Images/BflImageClient.cs`
- Create: `src/Infrastructure/TheCanonry.ApiClients/Images/FalImageClient.cs`
- Create: `src/Infrastructure/TheCanonry.ApiClients/Images/WaveSpeedImageClient.cs`
- Create: `tests/TheCanonry.ApiClients.Tests/Images/ImageClientTests.cs`

- [ ] **Step 1: Write image types** — IImageClient (Provider, GenerateAsync, IsEnabled), ImageRequest (prompt, size, model, quality, aspectRatio), ImageResult (imageData as byte[], revisedPrompt, usage, error), ImageProvider enum (DallE, BflFlux, FalAi, WaveSpeed, GptImage)
- [ ] **Step 2: Write DalleImageClient** — POST to `https://api.openai.com/v1/images/generations`. Handles DALL-E 2/3 model selection, size validation, response_format b64_json.
- [ ] **Step 3: Write BflImageClient** — Async queue-based: POST submit → poll status → download result. Models: flux-pro-1.1-ultra, flux-dev, flux-pro-1.0. Polling with configurable interval/timeout.
- [ ] **Step 4: Write FalImageClient** — Queue-based upscaling: POST submit → poll → download. Models: clarity, creative, topaz. Factor 2x/4x. Creativity/resemblance parameters.
- [ ] **Step 5: Write WaveSpeedImageClient** — Async task-based generation with polling.
- [ ] **Step 6: Write tests** — Request construction for each provider, polling logic for BFL/fal.ai. Mock HTTP handlers. At least 6 tests.
- [ ] **Step 7: Commit**

---

## Chunk 3: Illuminator Core Types

### Task 11: Scaffold Illuminator Project

**Files:**
- Create: `src/TheCanonry.Illuminator/TheCanonry.Illuminator.csproj`
- Create: `tests/TheCanonry.Illuminator.Tests/TheCanonry.Illuminator.Tests.csproj`

- [ ] **Step 1: Create projects**

```bash
cd ~/src/the-canonry-desktop
mkdir -p src/TheCanonry.Illuminator
dotnet new classlib -o src/TheCanonry.Illuminator --no-restore
dotnet sln TheCanonry.slnx add src/TheCanonry.Illuminator/TheCanonry.Illuminator.csproj
dotnet add src/TheCanonry.Illuminator reference src/Core/TheCanonry.Schema/TheCanonry.Schema.csproj
dotnet add src/TheCanonry.Illuminator reference src/Core/TheCanonry.Engine/TheCanonry.Engine.csproj
dotnet add src/TheCanonry.Illuminator reference src/Infrastructure/TheCanonry.ApiClients/TheCanonry.ApiClients.csproj

mkdir -p tests/TheCanonry.Illuminator.Tests
dotnet new xunit -o tests/TheCanonry.Illuminator.Tests --no-restore
dotnet sln TheCanonry.slnx add tests/TheCanonry.Illuminator.Tests/TheCanonry.Illuminator.Tests.csproj
dotnet add tests/TheCanonry.Illuminator.Tests reference src/TheCanonry.Illuminator/TheCanonry.Illuminator.csproj
dotnet add tests/TheCanonry.Illuminator.Tests reference src/Infrastructure/TheCanonry.ApiClients/TheCanonry.ApiClients.csproj
```

- [ ] **Step 2: Verify, commit**

---

### Task 12: Illuminator Domain Types

Port the core type system for enrichment, chronicles, images, historians, and eras.

**Reference TS:** `enrichmentTypes.ts`, `chronicleTypes.ts`, `imageTypes.ts` (in `lib/`), `historianTypes.ts`, `eraNarrativeTypes.ts`, `costTypes.ts`

**Files:**
- Create: `src/TheCanonry.Illuminator/Types/EnrichmentTypes.cs` — EnrichmentType enum (19 values), EntityEnrichment record, EnrichmentResult
- Create: `src/TheCanonry.Illuminator/Types/ChronicleTypes.cs` — ChronicleRecord, ChronicleFormat enum, ChronicleImageRef, ChronicleVersion
- Create: `src/TheCanonry.Illuminator/Types/ImageTypes.cs` — ImageRecord, ImageMetadata, ImageAspect enum, ImageType enum
- Create: `src/TheCanonry.Illuminator/Types/HistorianTypes.cs` — HistorianConfig, HistorianTone enum, HistorianNote, HistorianRun
- Create: `src/TheCanonry.Illuminator/Types/EraNarrativeTypes.cs` — EraNarrative, EraNarrativeThread
- Create: `src/TheCanonry.Illuminator/Types/CostTypes.cs` — ApiCostEntry, CostSummary
- Create: `src/TheCanonry.Illuminator/Types/LlmCallType.cs` — LlmCallType enum (39 values grouped by category), LlmCallMetadata with defaults per call type

- [ ] **Step 1: Write EnrichmentTypes** — 19-value enum, EntityEnrichment aggregating text/image/chronicle enrichment state
- [ ] **Step 2: Write ChronicleTypes** — Full chronicle domain model
- [ ] **Step 3: Write ImageTypes, HistorianTypes, EraNarrativeTypes**
- [ ] **Step 4: Write LlmCallType** — 39 call types with metadata (label, description, category, default model, thinkingBudget, maxTokens)
- [ ] **Step 5: Write CostTypes**
- [ ] **Step 6: Commit**

---

### Task 13: Enrichment Job and Queue

Port the enrichment job lifecycle and Channel-based processing queue.

**Reference TS:** `enrichmentQueueStore.ts`, worker infrastructure

**Files:**
- Create: `src/TheCanonry.Illuminator/Enrichment/EnrichmentJob.cs`
- Create: `src/TheCanonry.Illuminator/Enrichment/JobStatus.cs`
- Create: `src/TheCanonry.Illuminator/Enrichment/EnrichmentQueue.cs`
- Create: `src/TheCanonry.Illuminator/Enrichment/IEnrichmentTaskExecutor.cs`
- Create: `tests/TheCanonry.Illuminator.Tests/Enrichment/EnrichmentQueueTests.cs`

- [ ] **Step 1: Write EnrichmentJob** — Full lifecycle: Queued → Running → Completed/Failed/Cancelled. Properties: Id, TaskType, TargetEntityId, SlotId, Status, QueuedAt, StartedAt, CompletedAt, InputTokens, OutputTokens, EstimatedCost, ErrorMessage, ErrorDetail, AttemptCount, ProgressMessage, ProgressFraction. Methods: MarkRunning, MarkCompleted(TokenUsage), MarkFailed(Exception), MarkCancelled.

- [ ] **Step 2: Write EnrichmentQueue** — Uses System.Threading.Channels.Channel<long> for job IDs. Events: JobEnqueued, JobStarted, JobCompleted, JobFailed, JobCancelled. Methods: EnqueueAsync(taskType, targetEntityId, input), ProcessAsync(maxConcurrency, ct) — reads from channel, resolves job from DB, dispatches to IEnrichmentTaskExecutor, updates job status. On startup: find orphaned Running jobs → mark Failed.

- [ ] **Step 3: Write IEnrichmentTaskExecutor** — Interface: Task<EnrichmentResult> ExecuteAsync(EnrichmentJob job, IProgress<TaskProgress> progress, CancellationToken ct)

- [ ] **Step 4: Write tests** — Job lifecycle transitions, queue enqueue/dequeue ordering, cancellation, concurrent processing. At least 8 tests.
- [ ] **Step 5: Commit**

---

### Task 14: Enrichment Task Base and Description Task

Port the enrichment task pattern and implement the description generation task (the most commonly used).

**Reference TS:** `workers/tasks/descriptionTask.ts`, `workers/tasks/llmCallConfig.ts`

**Files:**
- Create: `src/TheCanonry.Illuminator/Enrichment/Tasks/EnrichmentTask.cs` — Abstract base: TaskType, ExecuteAsync(input, progress, ct)
- Create: `src/TheCanonry.Illuminator/Enrichment/Tasks/DescriptionTask.cs`
- Create: `src/TheCanonry.Illuminator/Enrichment/Tasks/TaskContext.cs` — LLM client, domain schema, progress reporter
- Create: `src/TheCanonry.Illuminator/Enrichment/Prompts/DescriptionPrompts.cs`
- Create: `tests/TheCanonry.Illuminator.Tests/Enrichment/DescriptionTaskTests.cs`

- [ ] **Step 1: Write EnrichmentTask base** — Generic abstract class with typed input/output
- [ ] **Step 2: Write TaskContext** — Holds ILlmClient, DomainSchema, IProgress, CancellationToken
- [ ] **Step 3: Write DescriptionPrompts** — System/user prompt construction for the 3-call chain: description.narrative → description.visualThesis → description.visualTraits
- [ ] **Step 4: Write DescriptionTask** — 3-step LLM chain producing summary, description, aliases, visualThesis, visualTraits. JSON response parsing.
- [ ] **Step 5: Write tests** — Prompt construction, response parsing, 3-step chain execution with mock LLM. At least 5 tests.
- [ ] **Step 6: Commit**

---

### Task 15: Image Generation Task

**Reference TS:** `workers/tasks/imageTask.ts`, `lib/imageSettings.ts`

**Files:**
- Create: `src/TheCanonry.Illuminator/ImagePipeline/ImageGenerationTask.cs`
- Create: `src/TheCanonry.Illuminator/ImagePipeline/ImageSettings.cs`
- Create: `src/TheCanonry.Illuminator/ImagePipeline/ImagePromptFormatter.cs`
- Create: `tests/TheCanonry.Illuminator.Tests/ImagePipeline/ImageGenerationTaskTests.cs`

- [ ] **Step 1: Write ImageSettings** — Model families, size resolution, prompt templates per model
- [ ] **Step 2: Write ImagePromptFormatter** — Optional Claude-based prompt reformatting for image API
- [ ] **Step 3: Write ImageGenerationTask** — Dispatches to appropriate IImageClient based on model selection. Handles prompt formatting, API call, image data retrieval.
- [ ] **Step 4: Write tests** — Provider dispatch, prompt formatting, settings resolution. At least 4 tests.
- [ ] **Step 5: Commit**

---

### Task 16: Chronicle Task

**Reference TS:** `workers/tasks/chronicleTask.ts`

**Files:**
- Create: `src/TheCanonry.Illuminator/Chronicle/ChronicleTask.cs`
- Create: `src/TheCanonry.Illuminator/Chronicle/ChroniclePrompts.cs`
- Create: `src/TheCanonry.Illuminator/Chronicle/ChronicleContextBuilder.cs`
- Create: `tests/TheCanonry.Illuminator.Tests/Chronicle/ChronicleTaskTests.cs`

- [ ] **Step 1: Write ChronicleContextBuilder** — Assembles generation context from entities, relationships, narrative style, historian config
- [ ] **Step 2: Write ChroniclePrompts** — System/user prompts for generate, compare, combine, copy_edit, summary, title, imageRefs calls
- [ ] **Step 3: Write ChronicleTask** — Handles 15+ chronicle steps: generate_v2, regenerate, combine, compare, copy_edit, quick_check, validate, edit, summary, title, image_refs, cover_image_scene
- [ ] **Step 4: Write tests** — Context building, prompt construction, step dispatch. At least 5 tests.
- [ ] **Step 5: Commit**

---

### Task 17: Remaining Enrichment Tasks (Batch)

Port the remaining enrichment task types in a single batch.

**Reference TS:** All remaining `workers/tasks/*.ts` files

**Files:**
- Create: `src/TheCanonry.Illuminator/Enrichment/Tasks/VisualThesisTask.cs`
- Create: `src/TheCanonry.Illuminator/Enrichment/Tasks/EraNarrativeTask.cs`
- Create: `src/TheCanonry.Illuminator/Enrichment/Tasks/SummaryRevisionTask.cs`
- Create: `src/TheCanonry.Illuminator/Enrichment/Tasks/ChronicleBackportTask.cs`
- Create: `src/TheCanonry.Illuminator/Enrichment/Tasks/DynamicsGenerationTask.cs`
- Create: `src/TheCanonry.Illuminator/Enrichment/Tasks/PaletteExpansionTask.cs`
- Create: `src/TheCanonry.Illuminator/Enrichment/Tasks/HistorianEditionTask.cs`
- Create: `src/TheCanonry.Illuminator/Enrichment/Tasks/HistorianReviewTask.cs`
- Create: `src/TheCanonry.Illuminator/Enrichment/Tasks/HistorianChronologyTask.cs`
- Create: `src/TheCanonry.Illuminator/Enrichment/Tasks/HistorianPrepTask.cs`
- Create: `src/TheCanonry.Illuminator/Enrichment/Tasks/MotifVariationTask.cs`
- Create: `src/TheCanonry.Illuminator/Enrichment/Tasks/ToneRankingTask.cs`
- Create: `src/TheCanonry.Illuminator/Enrichment/Tasks/FactCoverageTask.cs`
- Create: `src/TheCanonry.Illuminator/Enrichment/Tasks/EntityTagImageStylesTask.cs`
- Create: `src/TheCanonry.Illuminator/Enrichment/Tasks/UpscaleTask.cs`
- Create: `src/TheCanonry.Illuminator/Enrichment/Tasks/TaskRegistry.cs` — Maps EnrichmentType → task class

- [ ] **Step 1: Write historian tasks** — HistorianEdition, HistorianReview, HistorianChronology, HistorianPrep, MotifVariation. Each has a prompt builder and LLM call.
- [ ] **Step 2: Write chronicle-related tasks** — ToneRanking, FactCoverage, EraNarrative (threads/generate/edit/coverImageScene/imageRefs steps)
- [ ] **Step 3: Write revision tasks** — SummaryRevision, ChronicleBackport, DynamicsGeneration, PaletteExpansion
- [ ] **Step 4: Write image tasks** — VisualThesis, EntityTagImageStyles, UpscaleTask
- [ ] **Step 5: Write TaskRegistry** — Static dictionary mapping EnrichmentType to factory functions for each task
- [ ] **Step 6: Commit**

---

### Task 18: JSON Response Parsing Utilities

Port the robust JSON extraction utilities used by enrichment tasks.

**Reference TS:** `workers/tasks/textParsing.ts`, `lib/jsonParsing.ts`

**Files:**
- Create: `src/TheCanonry.Illuminator/Enrichment/LlmResponseParser.cs`
- Create: `tests/TheCanonry.Illuminator.Tests/Enrichment/LlmResponseParserTests.cs`

- [ ] **Step 1: Write LlmResponseParser** — ExtractJson(response) handles: raw JSON, JSON in markdown code blocks, JSON embedded in prose. Robust against LLM formatting quirks (trailing commas, unquoted keys). Parse specific response shapes: DescriptionResponse, ChronicleResponse, etc.
- [ ] **Step 2: Write tests** — JSON extraction from various LLM response formats, malformed input handling. At least 6 tests.
- [ ] **Step 3: Commit**

---

## Chunk 4: Persistence Extensions

### Task 19: Extend Persistence for Illuminator

Add Illuminator tables to the existing CanonryDbContext.

**Files:**
- Modify: `src/Infrastructure/TheCanonry.Persistence/CanonryDbContext.cs` — Add DbSets for Chronicles, HistorianRuns, EraNarratives, Images, StyleLibraries, EnrichmentJobs, ApiCosts
- Create: `src/Infrastructure/TheCanonry.Persistence/Repositories/ChronicleRepository.cs`
- Create: `src/Infrastructure/TheCanonry.Persistence/Repositories/ImageRepository.cs`
- Create: `src/Infrastructure/TheCanonry.Persistence/Repositories/EnrichmentJobRepository.cs`
- Create: `src/Infrastructure/TheCanonry.Persistence/Repositories/CostRepository.cs`
- Create: `tests/TheCanonry.Persistence.Tests/Repositories/RepositoryTests.cs`

- [ ] **Step 1: Add DbSets and entity configurations** — Configure Illuminator entities in DbContext with proper relationships, indexes
- [ ] **Step 2: Write ChronicleRepository** — CRUD for chronicles, versions, image refs
- [ ] **Step 3: Write ImageRepository** — Save/load image metadata, search by entity, file path management
- [ ] **Step 4: Write EnrichmentJobRepository** — CRUD for jobs, query by status/slot, orphan detection
- [ ] **Step 5: Write CostRepository** — Record costs, query by project/simulation, aggregate summaries
- [ ] **Step 6: Write tests** — CRUD operations for each repository. At least 8 tests.
- [ ] **Step 7: Commit**

---
