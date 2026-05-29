function command(device, action, params = {}) {
  const base = {
    nodeId: device.id || device.nodeId,
    endpoint: 1,
    matterType: device.matterType || "0x0055",
    cluster: device.matterCluster || clusterForAction(action),
    command: action,
    params
  };
  return base;
}

function clusterForAction(action) {
  if (action === "MoveToLevel") return "0x0008";
  if (action === "SetpointRaiseLower") return "0x0201";
  if (action === "EnableCharging" || action === "DisableCharging") return "0x0099";
  return "0x0006";
}

function off(device) {
  return command(device, "Off");
}

function on(device) {
  return command(device, "On");
}

function timedOn(device, seconds) {
  return command(device, "OnWithTimedOff", { onTimeSeconds: seconds });
}

function setTemp(device, targetTemp) {
  return command(device, "SetpointRaiseLower", { targetTemp });
}

function enableCharging(device, startHour) {
  return command(device, "EnableCharging", { startHour });
}

module.exports = { command, off, on, timedOn, setTemp, enableCharging };
