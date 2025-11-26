/**
 * Fitness Pool Manager
 *
 * Manages a pool of worker threads for parallel fitness evaluation.
 * Uses Piscina for efficient thread pooling.
 */

import { Piscina } from "piscina";
import { cpus } from "os";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { computeFitness } from "../fitness.js";
import type { NamingDomain } from "../../lib/types/domain.js";
import type {
  ValidationSettings,
  FitnessWeights,
  EvaluationResult,
} from "../optimization.js";
import type { FitnessTask } from "./fitness-worker.js";

// Get project root and resolve worker path to dist (workers must be compiled JS)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Resolve to dist regardless of whether we're running from validation (tsx) or dist (node)
const projectRoot = __dirname.includes("/validation/")
  ? __dirname.replace("/validation/optimizers", "")
  : __dirname.replace("/dist/validation/optimizers", "");
const workerDir = join(projectRoot, "dist/validation/optimizers");

// Singleton pool instance
let pool: Piscina | null = null;
let poolInitialized = false;
let useWorkers = true;

/**
 * Get or create the worker pool
 */
function getPool(): Piscina | null {
  if (!useWorkers) return null;

  if (!poolInitialized) {
    poolInitialized = true;

    try {
      // Worker path always points to compiled dist version
      const workerPath = join(workerDir, "fitness-worker.js");

      pool = new Piscina({
        filename: workerPath,
        minThreads: 1,
        maxThreads: Math.max(1, cpus().length - 1), // Leave one core free
        idleTimeout: 30000, // 30 seconds
      });

      console.log(
        `[FitnessPool] Initialized with ${pool.threads.length} workers (${cpus().length} CPUs)`
      );
    } catch (error) {
      console.warn(
        `[FitnessPool] Failed to initialize worker pool, falling back to single-threaded: ${error}`
      );
      useWorkers = false;
      pool = null;
    }
  }

  return pool;
}

/**
 * Evaluate fitness using worker pool (or fallback to single-threaded)
 */
async function evaluateSingle(
  config: NamingDomain,
  validationSettings: ValidationSettings,
  fitnessWeights: FitnessWeights,
  siblingDomains: NamingDomain[],
  iteration: number
): Promise<EvaluationResult> {
  const workerPool = getPool();

  if (workerPool) {
    const task: FitnessTask = {
      config,
      validationSettings,
      fitnessWeights,
      siblingDomains,
      iteration,
    };

    return workerPool.run(task);
  }

  // Fallback to single-threaded
  return computeFitness(
    config,
    {
      consonantWeights: [],
      vowelWeights: [],
      templateWeights: [],
      structureWeights: [],
      apostropheRate: 0,
      hyphenRate: 0,
      lengthMin: 0,
      lengthMax: 0,
    },
    validationSettings,
    fitnessWeights,
    siblingDomains,
    iteration,
    false
  );
}

/**
 * Evaluate multiple configurations in parallel
 */
export async function evaluateBatch(
  configs: NamingDomain[],
  validationSettings: ValidationSettings,
  fitnessWeights: FitnessWeights,
  siblingDomains: NamingDomain[],
  generation: number
): Promise<EvaluationResult[]> {
  const workerPool = getPool();

  if (workerPool && configs.length > 1) {
    // Create tasks for all configs
    const tasks: FitnessTask[] = configs.map((config, i) => ({
      config,
      validationSettings,
      fitnessWeights,
      siblingDomains,
      iteration: generation * 1000 + i, // Unique iteration for each
    }));

    // Run all in parallel using the pool
    return Promise.all(tasks.map((task) => workerPool.run(task)));
  }

  // Fallback to sequential single-threaded
  const results: EvaluationResult[] = [];
  for (let i = 0; i < configs.length; i++) {
    const result = await evaluateSingle(
      configs[i],
      validationSettings,
      fitnessWeights,
      siblingDomains,
      generation * 1000 + i
    );
    results.push(result);
  }
  return results;
}

/**
 * Shutdown the worker pool
 */
export async function shutdownPool(): Promise<void> {
  if (pool) {
    await pool.destroy();
    pool = null;
    poolInitialized = false;
    console.log("[FitnessPool] Pool shutdown complete");
  }
}

/**
 * Disable worker threads (useful for debugging)
 */
export function disableWorkers(): void {
  useWorkers = false;
  if (pool) {
    pool.destroy();
    pool = null;
  }
}

/**
 * Get pool statistics
 */
export function getPoolStats(): {
  threads: number;
  completed: number;
  waiting: number;
} | null {
  if (!pool) return null;

  return {
    threads: pool.threads.length,
    completed: pool.completed,
    waiting: pool.queueSize,
  };
}
