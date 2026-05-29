const http = require("http");
const { handle } = require("../server");

const server = http.createServer(handle);

server.listen(0, "127.0.0.1", async () => {
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;
  try {
    const health = await request(`${base}/api/health`);
    const multiRoom = await request(`${base}/api/twin/multi-room`, {
      rooms: [
        { id: "living", name: "客厅", initialTemp: 27, targetTemp: 24, hvacRatedKw: 2.2 },
        { id: "bedroom", name: "主卧", initialTemp: 26, targetTemp: 24.5, hvacRatedKw: 1.5 }
      ]
    });
    const optimized = await request(`${base}/api/optimize/schedule`, {
      devices: [
        { id: "washer", name: "洗衣机", rated: 500, shiftable: true, cycleMins: 60, deadlineHour: 22 }
      ],
      ev: { currentSoc: 0.62, targetSoc: 0.9, departHour: 8 }
    });
    console.log(JSON.stringify({
      health,
      multiRoomSummary: {
        rooms: multiRoom.rooms.length,
        totalHvacKwh: multiRoom.totalHvacKwh,
        weightedComfortRate: multiRoom.weightedComfortRate
      },
      optimized
    }, null, 2));
  } finally {
    server.close();
  }
});

function request(url, body) {
  const options = body
    ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }
    : {};
  return fetch(url, options).then((response) => response.json());
}
