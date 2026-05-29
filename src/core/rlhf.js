function updateComfortWeights(current = {}, feedback = "good") {
  const weights = {
    price: Number(current.price ?? 0.45),
    carbon: Number(current.carbon ?? 0.30),
    comfort: Number(current.comfort ?? 0.25),
    learningRate: Number(current.learningRate ?? 0.06),
    streak: Number(current.streak ?? 0),
    lastDirection: Number(current.lastDirection ?? 0)
  };
  const direction = feedback === "good" ? -1 : 1;
  const sameDirection = direction === weights.lastDirection;
  const nextRate = sameDirection
    ? Math.min(0.18, weights.learningRate * 1.35)
    : Math.max(0.025, weights.learningRate * 0.5);

  const comfortDelta = direction * nextRate;
  let comfort = clamp(weights.comfort + comfortDelta, 0.1, 0.7);
  const remainder = 1 - comfort;
  const pc = weights.price + weights.carbon || 1;
  const price = remainder * (weights.price / pc);
  const carbon = remainder * (weights.carbon / pc);

  return {
    price: Number(price.toFixed(4)),
    carbon: Number(carbon.toFixed(4)),
    comfort: Number(comfort.toFixed(4)),
    learningRate: Number(nextRate.toFixed(4)),
    streak: sameDirection ? weights.streak + 1 : 1,
    lastDirection: direction
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

module.exports = { updateComfortWeights };
