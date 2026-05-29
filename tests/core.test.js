const assert = require("assert");
const { heunStep, simulateDay } = require("../src/core/twin");
const { optimizeShiftable, optimizeEV, classifyLoad } = require("../src/core/optimizer");
const { updateComfortWeights } = require("../src/core/rlhf");
const { command } = require("../src/core/matter");
const signals = require("../src/core/signals");

const next = heunStep(
  { temp: 26, timeMin: 0 },
  {
    minutes: 1,
    outdoorTemp: 32,
    hvacKw: 1.2,
    house: { thermalResistance: 4, thermalCapacitance: 10, solarGainKw: 0.2, internalGainKw: 0.1 },
    mode: "cooling"
  }
);
assert(Number.isFinite(next.temp));
assert.strictEqual(next.timeMin, 1);

const twin = simulateDay({ schedule: Array(24).fill(0.5) });
assert.strictEqual(twin.trace.length, 24);
assert(twin.comfortRate >= 0 && twin.comfortRate <= 1);

const shift = optimizeShiftable(
  { id: "washer", name: "洗衣机", rated: 500, shiftable: true, cycleMins: 60, deadlineHour: 23 },
  signals,
  { price: 0.55, carbon: 0.45 }
);
assert(shift.startHour >= 0 && shift.startHour < 24);
assert.strictEqual(classifyLoad({ type: "ac", variable: true }), "flexible");

const ev = optimizeEV({ capacityKwh: 75, currentSoc: 0.5, targetSoc: 0.8, departHour: 9 }, signals);
assert(ev.neededKwh > 0);
assert(ev.endHour <= 9);

const weights = updateComfortWeights({ price: 0.45, carbon: 0.3, comfort: 0.25 }, "cold");
assert(weights.comfort > 0.25);

const matterCommand = command({ id: "dev_1", matterType: "0x0301" }, "Identify", { identifyTime: 5 });
assert.strictEqual(matterCommand.nodeId, "dev_1");
assert.strictEqual(matterCommand.command, "Identify");

console.log("core tests passed");
