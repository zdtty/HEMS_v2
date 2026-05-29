const price = [
  0.36, 0.34, 0.32, 0.31, 0.34, 0.42, 0.58, 0.78,
  0.96, 1.12, 1.18, 1.05, 0.86, 0.72, 0.68, 0.76,
  0.98, 1.26, 1.42, 1.36, 1.08, 0.78, 0.52, 0.40
];

const carbon = [
  520, 505, 490, 470, 445, 420, 390, 360,
  330, 300, 285, 270, 260, 285, 320, 380,
  455, 540, 620, 650, 610, 575, 550, 535
];

const outdoorTemp = [
  27, 26, 25, 25, 26, 28, 31, 34,
  36, 38, 40, 40, 39, 38, 37, 36,
  35, 34, 32, 31, 30, 29, 28, 27
];

function normalizeSignals(input = {}) {
  return {
    price: input.price && input.price.length ? input.price : price,
    carbon: input.carbon && input.carbon.length ? input.carbon : carbon,
    outdoorTemp: input.outdoorTemp && input.outdoorTemp.length ? input.outdoorTemp : outdoorTemp
  };
}

module.exports = { price, carbon, outdoorTemp, normalizeSignals };
