## Prominence
- **Model**: Numeric 0–5 mapped to labels (forgotten, marginal, recognized, renowned, mythic). We target a roughly normal distribution centered ~3.0 (slight high skew) with only ~10–15% of entities reaching mythic.
- **Primary source (actions)**: Actions are the intentional source of prominence; all gains/losses in `apps/canonry/webui/public/default-project/actions.json` are tuned to be frequency‑aware so high‑volume actions don’t inflate everyone. We use an inverse scaling rule per action: `success = clamp(2.5 / avg_count, 0.02..0.6)`, `failure = 0.5 * success`, and when a target delta exists `target_success = 0.6 * success`, `target_failure = 0.3 * success`. `adjust_prominence` mutations use the target_success value. Action success/failure deltas always apply (see `universal_catalyst` in `apps/canonry/webui/public/default-project/systems.json`).
- **Primary sink (prominence_evolution)**: `prominence_evolution` is the decay sink in `apps/canonry/webui/public/default-project/systems.json`: entities with <=2 connections lose 0.25 (p=0.9), >=3 lose 0.15 (p=0.75), throttle 0.08. This keeps idle entities drifting down.
- **Smoother (reflected_glory)**: `reflected_glory` is the homeostatic smoother: +0.08 if neighbor prominence >=3, -0.06 if <=2 (p=0.4), throttle 0.25. It dampens extremes without being a primary source.
- **Other contributors**: Additional system‑level nudges exist and are intentionally smaller/rarer than actions: `heroic_sacrifice` (+0.4 related), `merchant_prosperity` (+0.2/-0.15), `ability_fade` (-0.15), `armed_hero_detector` (+0.3), `devout_believer_detector` (+0.25), `control_collapse` (-0.25), `alliance_defense_call` (+0.25), `oath_breaker_detector` (-0.25), `oath_breaker_consequences` (-0.15), `ice_memory_witness` (+0.2), `anomaly_activation` (+0.3). Generators in `apps/canonry/webui/public/default-project/generators.json` set initial prominence labels (mostly marginal/recognized, with rare renowned/mythic seeds).
- **Tuning methodology**: We tune action deltas using the 10‑run averages in `apps/canonry/webui/public/default-project/validity-search-4-runs/`, then re‑run and check prominence distribution against the target (median near 3–3.5, mythic 10–15%). If mythic share drifts high, lower the constant (2.5) or the cap (0.6); if too low, raise them modestly.

## Distribution Targets
- **Definition**: Per-subtype numeric targets in `apps/canonry/webui/public/default-project/distributionTargets.json`, keyed as `entities.<kind>.<subtype>.target`.
- **What it controls**: Two levers only: (1) growth budgeting uses the sum of remaining deficits per kind to decide how many templates to run this epoch, and (2) template weights are nudged up/down based on subtype deviation (homeostasis).
- **What it does not control**: It does not set per-era overrides, does not change system behavior, and does not force creation. If no template can create a subtype (or it is gated behind hard preconditions), targets will not be met.
- **Coupling reality**: Templates often create multiple subtypes at once. Homeostasis can only bias selection, so bundles can overshoot one subtype while chasing another.
- **Dependency on lifecycle**: Targets are for current counts, not cumulative creation. High attrition (e.g., NPCs) can keep a subtype under target even when it is created frequently.

## Growth Phases and Eras
- **Epochs**: An epoch is `ticksPerEpoch` simulation ticks; the run is bounded by `maxEpochs`.
- **Growth phases**: Growth runs across ticks in the epoch until the target is met or templates are exhausted; completion is recorded at the tick it happens.
- **Era correlation**: Each completed growth phase is attributed to the era that is current at completion time.
- **Era exits**: Use `growth_phases_complete` in era exit conditions to require N completed growth phases during the era; transitions can happen mid-epoch.
