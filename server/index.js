const http = require("http");
const { URL } = require("url");
const { normalizeSignals } = require("../src/core/signals");
const { simulateDay, houseFromInsulation } = require("../src/core/twin");
const { evaluateScenario } = require("../src/core/optimizer");
const { updateComfortWeights } = require("../src/core/rlhf");
const matter = require("../src/core/matter");

const port = Number(process.env.PORT || 3001);

function json(res, status, body) {
  const text = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
  });
  res.end(text);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (error) {
        reject(error);
      }
    });
  });
}

async function handle(req, res) {
  if (req.method === "OPTIONS") return json(res, 204, {});
  const url = new URL(req.url, `http://${req.headers.host}`);

  try {
    if (req.method === "GET" && url.pathname === "/api/health") {
      return json(res, 200, {
        ok: true,
        service: "hems-edge-api",
        modules: ["signals", "digital-twin", "optimizer", "rlhf", "matter"]
      });
    }

    if (req.method === "GET" && url.pathname === "/api/signals") {
      return json(res, 200, normalizeSignals());
    }

    if (req.method === "POST" && url.pathname === "/api/twin/simulate") {
      const body = await readBody(req);
      return json(res, 200, simulateDay({
        ...body,
        house: body.house || houseFromInsulation(body.insulation)
      }));
    }

    if (req.method === "POST" && url.pathname === "/api/optimize/schedule") {
      const body = await readBody(req);
      return json(res, 200, evaluateScenario(body));
    }

    if (req.method === "POST" && url.pathname === "/api/feedback") {
      const body = await readBody(req);
      return json(res, 200, updateComfortWeights(body.weights, body.feedback));
    }

    if (req.method === "POST" && url.pathname === "/api/matter/command") {
      const body = await readBody(req);
      return json(res, 200, matter.command(body.device || {}, body.action || "Identify", body.params || {}));
    }

    return json(res, 404, { error: "Not found", path: url.pathname });
  } catch (error) {
    return json(res, 400, { error: error.message });
  }
}

if (require.main === module) {
  http.createServer(handle).listen(port, () => {
    console.log(`HEMS edge API listening on http://127.0.0.1:${port}`);
  });
}

module.exports = { handle };
