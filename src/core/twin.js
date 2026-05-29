const { normalizeSignals } = require("./signals");

function houseFromInsulation(score = 0.6) {
  const s = Math.min(1, Math.max(0.1, Number(score) || 0.6));
  return {
    insulation: s,
    thermalResistance: 2.0 + s * 4.2,
    thermalCapacitance: 7.5 + s * 11.0,
    solarGainKw: 0.22,
    internalGainKw: 0.18
  };
}

function thermalDerivative(temp, outdoor, hvacKw, house, mode = "cooling") {
  const sign = mode === "heating" ? 1 : -1;
  const envelope = (outdoor - temp) / house.thermalResistance;
  const hvac = sign * hvacKw * 3.5;
  const gain = house.solarGainKw + house.internalGainKw;
  return (envelope + hvac + gain) / house.thermalCapacitance;
}

function heunStep(state, options) {
  const minutes = options.minutes || 1;
  const dt = minutes / 60;
  const k1 = thermalDerivative(
    state.temp,
    options.outdoorTemp,
    options.hvacKw,
    options.house,
    options.mode
  );
  const predicted = state.temp + k1 * dt;
  const k2 = thermalDerivative(
    predicted,
    options.outdoorTemp,
    options.hvacKw,
    options.house,
    options.mode
  );
  return {
    temp: state.temp + ((k1 + k2) / 2) * dt,
    timeMin: state.timeMin + minutes
  };
}

function simulateDay(config = {}) {
  const signals = normalizeSignals(config.signals);
  const house = config.house || houseFromInsulation(config.insulation);
  const target = Number(config.targetTemp || 24);
  const tolerance = Number(config.tolerance || 2);
  const hvacRatedKw = Number(config.hvacRatedKw || 2.2);
  const schedule = config.schedule || Array(24).fill(0.45);
  let state = { temp: Number(config.initialTemp || 27), timeMin: 0 };
  const trace = [];
  let comfortMinutes = 0;
  let hvacKwh = 0;

  for (let hour = 0; hour < 24; hour += 1) {
    const ratio = Math.max(0, Math.min(1, Number(schedule[hour] || 0)));
    const hvacKw = hvacRatedKw * ratio;
    for (let m = 0; m < 60; m += 1) {
      state = heunStep(state, {
        minutes: 1,
        outdoorTemp: signals.outdoorTemp[hour],
        hvacKw,
        house,
        mode: "cooling"
      });
      hvacKwh += hvacKw / 60;
      if (Math.abs(state.temp - target) <= tolerance) comfortMinutes += 1;
    }
    trace.push({
      hour,
      indoorTemp: Number(state.temp.toFixed(2)),
      outdoorTemp: signals.outdoorTemp[hour],
      hvacKw: Number(hvacKw.toFixed(2))
    });
  }

  return {
    trace,
    hvacKwh: Number(hvacKwh.toFixed(3)),
    comfortRate: Number((comfortMinutes / 1440).toFixed(4)),
    finalTemp: Number(state.temp.toFixed(2))
  };
}

module.exports = { houseFromInsulation, heunStep, simulateDay };
