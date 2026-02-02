/**
 * Algorithm configurations with their specific parameters
 */
export const ALGORITHMS = {
  hillclimb: {
    name: 'Hill Climbing',
    description: 'Simple local search that iteratively improves by small steps. Fast but may get stuck in local optima.',
    params: {
      iterations: { type: 'number', label: 'Iterations', default: 50, min: 10, max: 500 },
    }
  },
  sim_anneal: {
    name: 'Simulated Annealing',
    description: 'Probabilistic search that can escape local optima by occasionally accepting worse solutions.',
    params: {
      iterations: { type: 'number', label: 'Iterations', default: 100, min: 10, max: 500 },
      initialTemperature: { type: 'number', label: 'Initial Temperature', default: 1.0, min: 0.1, max: 10, step: 0.1 },
      coolingRate: { type: 'number', label: 'Cooling Rate', default: 0.95, min: 0.5, max: 0.99, step: 0.01 },
    }
  },
  ga: {
    name: 'Genetic Algorithm',
    description: 'Population-based evolution with crossover and mutation. Great for exploring discrete phoneme combinations.',
    params: {
      iterations: { type: 'number', label: 'Generations', default: 50, min: 5, max: 200 },
      populationSize: { type: 'number', label: 'Population Size', default: 16, min: 4, max: 64 },
    }
  },
  bayes: {
    name: 'Bayesian Optimization (TPE)',
    description: 'Efficient search using Tree-structured Parzen Estimators. Models probability of good configurations.',
    params: {
      iterations: { type: 'number', label: 'Iterations', default: 50, min: 10, max: 200 },
    }
  },
  cluster: {
    name: 'Cluster Discovery',
    description: 'Analyzes generated names to discover effective consonant clusters and borrows from sibling domains.',
    params: {}
  }
};
