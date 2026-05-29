const fs = require("fs");
const path = require("path");
const { price, carbon, outdoorTemp } = require("../src/core/signals");
const { simulateDay } = require("../src/core/twin");
const { evaluateScenario } = require("../src/core/optimizer");
const { updateComfortWeights } = require("../src/core/rlhf");

const signals = { price, carbon, outdoorTemp };
const devices = [
  { id: "washer", name: "洗衣机", type: "washer", rated: 500, shiftable: true, cycleMins: 60, deadlineHour: 22 },
  { id: "dishwasher", name: "洗碗机", type: "dishwasher", rated: 1800, shiftable: true, cycleMins: 45, deadlineHour: 23 },
  { id: "heater", name: "电热水器", type: "heater", rated: 3000, shiftable: true, cycleMins: 90, deadlineHour: 7 }
];

function costForSchedule(schedule, ratedKw = 2.2) {
  return schedule.reduce((sum, ratio, hour) => sum + ratio * ratedKw * price[hour], 0);
}

function carbonForSchedule(schedule, ratedKw = 2.2) {
  return schedule.reduce((sum, ratio, hour) => sum + ratio * ratedKw * carbon[hour] / 1000, 0);
}

const baselineSchedule = Array(24).fill(0.62);
const priceOnlySchedule = price.map((p) => p <= 0.58 ? 0.85 : 0.35);
const proposed = evaluateScenario({
  signals,
  devices,
  ev: { capacityKwh: 75, currentSoc: 0.62, targetSoc: 0.9, departHour: 8 },
  weights: { price: 0.5, carbon: 0.35, comfort: 0.15 }
});

const baselineTwin = simulateDay({ signals, schedule: baselineSchedule });
const priceOnlyTwin = simulateDay({ signals, schedule: priceOnlySchedule });
const proposedTwin = simulateDay({ signals, schedule: proposed.hvac.optimizedSchedule });

const results = [
  summarize("Baseline", baselineSchedule, baselineTwin),
  summarize("Price-only", priceOnlySchedule, priceOnlyTwin),
  summarize("Proposed", proposed.hvac.optimizedSchedule, proposedTwin)
];

const feedbackAfterCold = updateComfortWeights({ price: 0.45, carbon: 0.3, comfort: 0.25 }, "cold");
const output = {
  generatedAt: new Date().toISOString(),
  signals,
  results,
  optimizedShiftableSchedules: proposed.schedules,
  optimizedEV: proposed.ev,
  rlhfExample: feedbackAfterCold
};

const outPath = path.join(__dirname, "results.json");
fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");

console.table(results);
console.log(`Saved ${outPath}`);

function summarize(name, schedule, twin) {
  const cost = costForSchedule(schedule);
  const co2 = carbonForSchedule(schedule);
  return {
    scenario: name,
    hvacKwh: Number(twin.hvacKwh.toFixed(2)),
    costCny: Number(cost.toFixed(2)),
    carbonKg: Number(co2.toFixed(2)),
    comfortRatePct: Number((twin.comfortRate * 100).toFixed(1))
  };
}
