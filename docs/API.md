# HEMS Edge API

本地边缘 API 默认运行在 `http://127.0.0.1:3001`。

```bash
npm start
```

## GET /api/health

检查边缘服务是否在线。

```bash
curl http://127.0.0.1:3001/api/health
```

## GET /api/signals

返回 24 小时电价、碳强度和室外温度信号。

## POST /api/twin/simulate

运行单区 ETP 数字孪生仿真。

```json
{
  "insulation": 0.6,
  "initialTemp": 27,
  "targetTemp": 24,
  "schedule": [0.45, 0.45, 0.45]
}
```

## POST /api/twin/multi-room

运行多房间耦合热模型，用于支撑家庭平面孪生的分区控制概念。

```json
{
  "rooms": [
    { "id": "living", "name": "客厅", "initialTemp": 27, "targetTemp": 24, "hvacRatedKw": 2.2 },
    { "id": "bedroom", "name": "主卧", "initialTemp": 26, "targetTemp": 24.5, "hvacRatedKw": 1.5 }
  ],
  "coupling": 0.035
}
```

## POST /api/optimize/schedule

运行多目标调度，返回可平移负荷、HVAC 和 EV 充电建议。

```json
{
  "devices": [
    { "id": "washer", "name": "洗衣机", "rated": 500, "shiftable": true, "cycleMins": 60, "deadlineHour": 22 }
  ],
  "ev": { "currentSoc": 0.62, "targetSoc": 0.9, "departHour": 8 },
  "weights": { "price": 0.5, "carbon": 0.35, "comfort": 0.15 }
}
```

## POST /api/feedback

根据用户体感反馈更新 RLHF 权重。

```json
{
  "feedback": "cold",
  "weights": { "price": 0.45, "carbon": 0.3, "comfort": 0.25 }
}
```

## POST /api/matter/command

生成 Matter 风格控制指令。

```json
{
  "device": { "id": "dev_1", "matterType": "0x0301" },
  "action": "SetpointRaiseLower",
  "params": { "targetTemp": 24 }
}
```
