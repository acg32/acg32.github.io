// RL estimator: lightweight, DOM-driven version (no LiteGraph).
(function attachRlEstimator(globalObject) {
  const defaultParams = {
    totalGpus: 16,
    trainerGpusPerReplica: 4,
    trainerTrajPerSPerReplica: 5,
    inferenceGpusPerReplica: 1,
    inferenceReqsPerSPerReplica: 2000,
    actorStepsPerTraj: 30,
    actorStepsPerS: 4,
  };

  // Compute throughput and bottleneck for a given GPU split and actor count.
  function evaluateConfig(params, config) {
    const {
      totalGpus,
      trainerGpusPerReplica,
      inferenceGpusPerReplica,
      actorStepsPerTraj,
      actorStepsPerS,
      trainerTrajPerSPerReplica,
      inferenceReqsPerSPerReplica,
    } = params;
    const { gT, gI, actors } = config;

    if (gT < 0 || gI < 0 || gT + gI > totalGpus) {
      return { valid: false, reason: "invalid_gpu_split" };
    }

    const nT = Math.floor(gT / trainerGpusPerReplica);
    const nI = Math.floor(gI / inferenceGpusPerReplica);

    if (nT === 0) return { valid: false, reason: "no_trainer" };
    if (nI === 0) return { valid: false, reason: "no_inference" };
    if (!Number.isFinite(actors) || actors <= 0) return { valid: false, reason: "no_actors" };

    const envStepDemand = actors * actorStepsPerS;
    const infStepCapacity = nI * inferenceReqsPerSPerReplica;
    const envStepRate = Math.min(envStepDemand, infStepCapacity);
    const rolloutTrajRate = envStepRate / actorStepsPerTraj;

    const trainerTrajRate = nT * trainerTrajPerSPerReplica;
    const throughputTraj = Math.min(rolloutTrajRate, trainerTrajRate);

    // Decide which stage limits throughput for simple highlighting.
    let bottleneck = "trainer";
    if (throughputTraj <= rolloutTrajRate) {
      if (envStepRate === envStepDemand && envStepRate === infStepCapacity) {
        bottleneck = "env";
      } else if (envStepRate === envStepDemand) {
        bottleneck = "actors";
      } else {
        bottleneck = "inference";
      }
    }

    return {
      valid: true,
      gT,
      gI,
      actors,
      nT,
      nI,
      rolloutTrajRate,
      trainerTrajRate,
      envStepDemand,
      infStepCapacity,
      trajectoriesPerSecond: throughputTraj,
      samplesPerSecond: throughputTraj * actorStepsPerTraj,
      L: actorStepsPerTraj,
      bottleneck, // "actors" | "inference" | "trainer" | "env"
    };
  }

  function renderPipeline(result) {
    const fields = {
      actors: result.actors,
      actorsRate: result.rolloutTrajRate.toFixed(2),
      nI: result.nI,
      infRate: (result.infStepCapacity / result.L).toFixed(2),
      nT: result.nT,
      trainRate: result.trainerTrajRate.toFixed(2),
      gT: result.gT,
      gI: result.gI,
      actorsDemand: result.envStepDemand.toFixed(0),
      totalGpus: defaultParams.totalGpus,
    };

    Object.entries(fields).forEach(([key, value]) => {
      const el = document.querySelector(`[data-field="${key}"]`);
      if (el) el.textContent = value;
    });

    const nodes = {
      actors: document.getElementById("node-actors"),
      inference: document.getElementById("node-inference"),
      trainer: document.getElementById("node-trainer"),
    };

    const bottleneckTargets = [];
    if (result.bottleneck === "actors") bottleneckTargets.push("actors");
    if (result.bottleneck === "inference") bottleneckTargets.push("inference");
    if (result.bottleneck === "trainer") bottleneckTargets.push("trainer");
    if (result.bottleneck === "env") bottleneckTargets.push("actors", "inference");

    const hasBottleneck = bottleneckTargets.length > 0;
    Object.entries(nodes).forEach(([key, node]) => {
      if (!node) return;
      node.classList.add("border-slate-200", "shadow-sm", "opacity-100");
      node.classList.remove("border-red-500", "shadow-red-200", "opacity-50");

      const isBottleneck = bottleneckTargets.includes(key);
      if (hasBottleneck && !isBottleneck) {
        node.classList.add("opacity-50");
      }
      if (isBottleneck) {
        node.classList.add("border-red-500", "shadow-red-200");
        node.classList.remove("opacity-50");
      }
    });
  }

  const uiState = {
    gTInput: null,
    actorsInput: null,
  };

  function clamp(value, min, max, fallback) {
    const num = Number(value);
    if (Number.isNaN(num)) return fallback;
    return Math.min(max, Math.max(min, num));
  }

  function recomputeFromInputs() {
    if (!uiState.gTInput || !uiState.actorsInput) return;

    const gT = clamp(uiState.gTInput.value, 0, defaultParams.totalGpus, defaultParams.totalGpus / 2);
    const actors = clamp(uiState.actorsInput.value, 1, 1_000_000, 32);
    const gI = Math.max(0, defaultParams.totalGpus - gT);

    uiState.gTInput.value = gT;
    uiState.actorsInput.value = actors;

    const result = evaluateConfig(defaultParams, { gT, gI, actors });
    if (!result.valid) {
      console.warn("Invalid RL estimator config", result.reason);
      return;
    }
    renderPipeline(result);
  }

  function initPage() {
    uiState.gTInput = document.getElementById("input-gT");
    uiState.actorsInput = document.getElementById("input-actors");

    if (!uiState.gTInput || !uiState.actorsInput) return;

    uiState.gTInput.max = defaultParams.totalGpus;
    uiState.gTInput.min = 0;

    uiState.gTInput.addEventListener("input", recomputeFromInputs);
    uiState.actorsInput.addEventListener("input", recomputeFromInputs);
    recomputeFromInputs();
  }

  const rlEstimator = {
    defaultParams,
    evaluateConfig,
    renderPipeline,
    recomputeFromInputs,
    initPage,
  };

  globalObject.rlEstimator = rlEstimator;
})(typeof window !== "undefined" ? window : globalThis);
