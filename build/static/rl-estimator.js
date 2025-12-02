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

  function computeBestConfig(params) {
    let best = null;

    for (let gT = 1; gT < params.totalGpus; gT += 1) {
      const gI = params.totalGpus - gT;
      const nT = Math.floor(gT / params.trainerGpusPerReplica);
      const nI = Math.floor(gI / params.inferenceGpusPerReplica);
      if (nT === 0 || nI === 0) continue;

      const trainerTrajRate = nT * params.trainerTrajPerSPerReplica;
      const infStepCapacity = nI * params.inferenceReqsPerSPerReplica;
      const maxRolloutTrajRate = Math.min(trainerTrajRate, infStepCapacity / params.actorStepsPerTraj);

      // Actors needed to saturate the slower stage (rollout vs trainer).
      const actorsNeeded = Math.max(
        1,
        Math.ceil((maxRolloutTrajRate * params.actorStepsPerTraj) / params.actorStepsPerS)
      );

      const result = evaluateConfig(params, { gT, gI, actors: actorsNeeded });
      if (!result.valid) continue;

      if (!best || result.samplesPerSecond > best.samplesPerSecond) {
        best = result;
      }
    }

    return best;
  }

  function renderPipeline(result, params = defaultParams) {
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
      totalGpus: params.totalGpus,
      "pipeline-train-traj": result.trajectoriesPerSecond.toFixed(2),
      "pipeline-train-samples": result.samplesPerSecond.toFixed(0),
      "pipeline-rollout-traj": result.rolloutTrajRate.toFixed(2),
      "pipeline-rollout-samples": (result.rolloutTrajRate * result.L).toFixed(0),
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
      node.classList.remove("bg-red-50", "opacity-50");

      const isBottleneck = bottleneckTargets.includes(key);
      if (hasBottleneck && !isBottleneck) {
        node.classList.add("opacity-50");
      }
      if (isBottleneck) {
        node.classList.add("bg-red-50");
        node.classList.remove("opacity-50");
      }
    });
  }

  const uiState = {
    totalGpusInput: null,
    trainerGpusPerReplicaInput: null,
    trainerTrajPerSPerReplicaInput: null,
    inferenceGpusPerReplicaInput: null,
    inferenceReqsPerSPerReplicaInput: null,
    actorStepsPerTrajInput: null,
    actorStepsPerSInput: null,
  };

  function clamp(value, min, max, fallback) {
    const num = Number(value);
    if (Number.isNaN(num)) return fallback;
    return Math.min(max, Math.max(min, num));
  }

  function readParamsFromInputs() {
    return {
      totalGpus: clamp(uiState.totalGpusInput?.value, 1, 512, defaultParams.totalGpus),
      trainerGpusPerReplica: clamp(
        uiState.trainerGpusPerReplicaInput?.value,
        0.1,
        64,
        defaultParams.trainerGpusPerReplica
      ),
      trainerTrajPerSPerReplica: clamp(
        uiState.trainerTrajPerSPerReplicaInput?.value,
        0.001,
        10000,
        defaultParams.trainerTrajPerSPerReplica
      ),
      inferenceGpusPerReplica: clamp(
        uiState.inferenceGpusPerReplicaInput?.value,
        0.1,
        64,
        defaultParams.inferenceGpusPerReplica
      ),
      inferenceReqsPerSPerReplica: clamp(
        uiState.inferenceReqsPerSPerReplicaInput?.value,
        1,
        1_000_000,
        defaultParams.inferenceReqsPerSPerReplica
      ),
      actorStepsPerTraj: clamp(
        uiState.actorStepsPerTrajInput?.value,
        1,
        1_000_000,
        defaultParams.actorStepsPerTraj
      ),
      actorStepsPerS: clamp(
        uiState.actorStepsPerSInput?.value,
        0.001,
        10_000,
        defaultParams.actorStepsPerS
      ),
    };
  }

  function recomputeFromInputs() {
    const params = readParamsFromInputs();
    if (uiState.totalGpusInput) uiState.totalGpusInput.value = params.totalGpus;
    if (uiState.trainerGpusPerReplicaInput) uiState.trainerGpusPerReplicaInput.value = params.trainerGpusPerReplica;
    if (uiState.trainerTrajPerSPerReplicaInput) uiState.trainerTrajPerSPerReplicaInput.value = params.trainerTrajPerSPerReplica;
    if (uiState.inferenceGpusPerReplicaInput) uiState.inferenceGpusPerReplicaInput.value = params.inferenceGpusPerReplica;
    if (uiState.inferenceReqsPerSPerReplicaInput) uiState.inferenceReqsPerSPerReplicaInput.value = params.inferenceReqsPerSPerReplica;
    if (uiState.actorStepsPerTrajInput) uiState.actorStepsPerTrajInput.value = params.actorStepsPerTraj;
    if (uiState.actorStepsPerSInput) uiState.actorStepsPerSInput.value = params.actorStepsPerS;

    const result = computeBestConfig(params);
    if (!result) {
      console.warn("No valid RL estimator configuration found");
      return;
    }
    renderPipeline(result, params);
  }

  function initPage() {
    uiState.totalGpusInput = document.getElementById("input-totalGpus");
    uiState.trainerGpusPerReplicaInput = document.getElementById("input-trainerGpusPerReplica");
    uiState.trainerTrajPerSPerReplicaInput = document.getElementById("input-trainerTrajPerSPerReplica");
    uiState.inferenceGpusPerReplicaInput = document.getElementById("input-inferenceGpusPerReplica");
    uiState.inferenceReqsPerSPerReplicaInput = document.getElementById("input-inferenceReqsPerSPerReplica");
    uiState.actorStepsPerTrajInput = document.getElementById("input-actorStepsPerTraj");
    uiState.actorStepsPerSInput = document.getElementById("input-actorStepsPerS");

    if (!uiState.totalGpusInput) return;

    const inputs = [
      uiState.totalGpusInput,
      uiState.trainerGpusPerReplicaInput,
      uiState.trainerTrajPerSPerReplicaInput,
      uiState.inferenceGpusPerReplicaInput,
      uiState.inferenceReqsPerSPerReplicaInput,
      uiState.actorStepsPerTrajInput,
      uiState.actorStepsPerSInput,
    ].filter(Boolean);

    inputs.forEach((input) => input.addEventListener("input", recomputeFromInputs));
    recomputeFromInputs();
  }

  const rlEstimator = {
    defaultParams,
    evaluateConfig,
    computeBestConfig,
    renderPipeline,
    recomputeFromInputs,
    initPage,
  };

  globalObject.rlEstimator = rlEstimator;
})(typeof window !== "undefined" ? window : globalThis);
