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

function simulateMultiRoom(config = {}) {
  const rooms = config.rooms && config.rooms.length ? config.rooms : [
    { id: "living", name: "客厅", initialTemp: 27, targetTemp: 24, hvacRatedKw: 2.2, areaWeight: 1.4 },
    { id: "bedroom", name: "主卧", initialTemp: 26, targetTemp: 24.5, hvacRatedKw: 1.5, areaWeight: 1.0 },
    { id: "study", name: "书房", initialTemp: 26.5, targetTemp: 24.5, hvacRatedKw: 1.2, areaWeight: 0.8 }
  ];
  const coupling = Number(config.coupling || 0.035);
  const signals = normalizeSignals(config.signals);
  const states = rooms.map((room) => ({
    ...room,
    state: { temp: Number(room.initialTemp || config.initialTemp || 27), timeMin: 0 },
    trace: [],
    comfortMinutes: 0,
    hvacKwh: 0
  }));

  for (let hour = 0; hour < 24; hour += 1) {
    for (let minute = 0; minute < 60; minute += 1) {
      const averageTemp = states.reduce((sum, room) => sum + room.state.temp, 0) / states.length;
      states.forEach((room) => {
        const schedule = room.schedule || config.schedule || Array(24).fill(0.45);
        const ratio = Math.max(0, Math.min(1, Number(schedule[hour] || 0)));
        const hvacKw = Number(room.hvacRatedKw || 1.5) * ratio;
        const coupledOutdoor = signals.outdoorTemp[hour] + (averageTemp - room.state.temp) * coupling;
        room.state = heunStep(room.state, {
          minutes: 1,
          outdoorTemp: coupledOutdoor,
          hvacKw,
          house: room.house || houseFromInsulation(room.insulation || config.insulation),
          mode: "cooling"
        });
        room.hvacKwh += hvacKw / 60;
        const target = Number(room.targetTemp || config.targetTemp || 24);
        const tolerance = Number(room.tolerance || config.tolerance || 2);
        if (Math.abs(room.state.temp - target) <= tolerance) room.comfortMinutes += 1;
      });
    }

    states.forEach((room) => {
      room.trace.push({
        hour,
        indoorTemp: Number(room.state.temp.toFixed(2)),
        outdoorTemp: signals.outdoorTemp[hour]
      });
    });
  }

  const roomResults = states.map((room) => ({
    id: room.id,
    name: room.name,
    trace: room.trace,
    hvacKwh: Number(room.hvacKwh.toFixed(3)),
    comfortRate: Number((room.comfortMinutes / 1440).toFixed(4)),
    finalTemp: Number(room.state.temp.toFixed(2))
  }));
  const totalWeightedArea = states.reduce((sum, room) => sum + Number(room.areaWeight || 1), 0);
  const weightedComfort = roomResults.reduce((sum, room, index) => {
    return sum + room.comfortRate * Number(states[index].areaWeight || 1);
  }, 0) / totalWeightedArea;

  return {
    rooms: roomResults,
    totalHvacKwh: Number(roomResults.reduce((sum, room) => sum + room.hvacKwh, 0).toFixed(3)),
    weightedComfortRate: Number(weightedComfort.toFixed(4))
  };
}

module.exports = { houseFromInsulation, heunStep, simulateDay, simulateMultiRoom };
