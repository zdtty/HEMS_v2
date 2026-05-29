const { normalizeSignals } = require("./signals");
const { simulateDay } = require("./twin");

function classifyLoad(device) {
  if (device.chargeable || device.type === "ev") return "chargeable";
  if (device.shiftable) return "shiftable";
  if (device.variable || device.type === "ac") return "flexible";
  return "base";
}

function hourlyCost(hour, ratedKw, signals, weights) {
  const priceCost = signals.price[hour] * ratedKw;
  const carbonCost = (signals.carbon[hour] / 1000) * ratedKw;
  return weights.price * priceCost + weights.carbon * carbonCost;
}

function optimizeShiftable(device, signals, weights = { price: 0.55, carbon: 0.45 }) {
  const duration = Math.max(1, Math.ceil((device.cycleMins || 60) / 60));
  const latestEnd = Math.min(24, Number(device.deadlineHour || 23));
  let best = { startHour: 0, score: Infinity };
  for (let start = 0; start <= latestEnd - duration; start += 1) {
    let score = 0;
    for (let h = start; h < start + duration; h += 1) {
      score += hourlyCost(h, (device.rated || 1000) / 1000, signals, weights);
    }
    if (score < best.score) best = { startHour: start, score };
  }
  return {
    deviceId: device.id,
    deviceName: device.name,
    startHour: best.startHour,
    durationHours: duration,
    score: Number(best.score.toFixed(4))
  };
}

function optimizeFlexibleHvac(config = {}) {
  const signals = normalizeSignals(config.signals);
  const baseline = Array(24).fill(0.62);
  const candidate = signals.price.map((_, hour) => {
    const green = 1 - signals.carbon[hour] / Math.max(...signals.carbon);
    const cheap = 1 - signals.price[hour] / Math.max(...signals.price);
    return Math.max(0.28, Math.min(0.95, 0.35 + cheap * 0.28 + green * 0.24));
  });
  const baselineResult = simulateDay({ ...config, schedule: baseline, signals });
  const candidateResult = simulateDay({ ...config, schedule: candidate, signals });
  return {
    baselineSchedule: baseline,
    optimizedSchedule: candidate.map((v) => Number(v.toFixed(3))),
    baselineComfort: baselineResult.comfortRate,
    optimizedComfort: candidateResult.comfortRate,
    optimizedHvacKwh: candidateResult.hvacKwh
  };
}

function optimizeEV(ev = {}, signalsInput, weights = { price: 0.55, carbon: 0.45 }) {
  const signals = normalizeSignals(signalsInput);
  const capacityKwh = Number(ev.capacityKwh || 75);
  const currentSoc = Number(ev.currentSoc || 0.55);
  const targetSoc = Number(ev.targetSoc || 0.9);
  const chargerKw = Number(ev.chargerKw || 7.4);
  const departHour = Number(ev.departHour || 8);
  const neededKwh = Math.max(0, (targetSoc - currentSoc) * capacityKwh);
  const duration = Math.max(1, Math.ceil(neededKwh / chargerKw));
  const latestStart = Math.max(0, departHour - duration);
  let best = { startHour: 0, score: Infinity };
  for (let start = 0; start <= latestStart; start += 1) {
    let score = 0;
    for (let h = start; h < start + duration; h += 1) {
      score += hourlyCost(h, chargerKw, signals, weights);
    }
    if (score < best.score) best = { startHour: start, score };
  }
  return {
    neededKwh: Number(neededKwh.toFixed(2)),
    durationHours: duration,
    startHour: best.startHour,
    endHour: best.startHour + duration,
    score: Number(best.score.toFixed(4))
  };
}

function evaluateScenario(config = {}) {
  const signals = normalizeSignals(config.signals);
  const weights = config.weights || { price: 0.5, carbon: 0.35, comfort: 0.15 };
  const devices = config.devices || [];
  const shiftable = devices.filter((device) => classifyLoad(device) === "shiftable");
  const schedules = shiftable.map((device) => optimizeShiftable(device, signals, weights));
  const hvac = optimizeFlexibleHvac({ signals, insulation: config.insulation || 0.6 });
  const ev = optimizeEV(config.ev || {}, signals, weights);
  return { schedules, hvac, ev };
}

module.exports = {
  classifyLoad,
  optimizeShiftable,
  optimizeFlexibleHvac,
  optimizeEV,
  evaluateScenario
};
