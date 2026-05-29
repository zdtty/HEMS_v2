# HEMS_v2 系统架构说明

本项目由三个层次组成，用于支撑“集成数字孪生仿真引擎与人机协同优化算法的家庭能源管理系统”的中期展示与后续开发。

## 1. 前端交互层

- `index.html` 与 `assets/` 中的静态资源承载 GitHub Pages 演示页面。
- 页面包含首页仪表盘、设备管理、排程、舒适度调节、电动汽车充电、运行日志等功能。
- `assets/home-twin.js` 在首页注入“家庭平面孪生”模块，按房间展示设备，并与总设备池 `hems.devices.v1` 保持一致。

## 2. 边缘 API 层

`server/index.js` 提供无外部依赖的 Node.js REST API，模拟本地边缘网关。

| 接口 | 方法 | 作用 |
| --- | --- | --- |
| `/api/health` | GET | 返回服务状态和已启用模块 |
| `/api/signals` | GET | 返回 24 小时电价、碳强度、室外温度信号 |
| `/api/twin/simulate` | POST | 运行住宅热力学数字孪生仿真 |
| `/api/optimize/schedule` | POST | 对可平移负荷、柔性 HVAC 和 EV 充电进行调度 |
| `/api/feedback` | POST | 根据用户反馈更新 RLHF 权重 |
| `/api/matter/command` | POST | 生成 Matter 风格控制指令 |

启动方式：

```bash
npm start
```

## 3. 数字孪生与优化核心

核心算法位于 `src/core/`。

- `twin.js`：等效热参数模型与 Heun 改进欧拉法求解。
- `optimizer.js`：负荷分类、可平移负荷优化、柔性 HVAC 策略和 EV 充电窗口优化。
- `rlhf.js`：舒适度反馈驱动的权重更新和自适应学习率。
- `matter.js`：Matter 指令结构化模拟。
- `signals.js`：24 小时电价、碳强度、室外温度测试信号。

## 4. 实验复现

`experiments/run-baseline.js` 生成 Baseline、Price-only、Proposed 三种场景的对比结果，并写出 `experiments/results.json`。

```bash
npm run experiment
```

## 5. 当前边界

本项目目前仍是“原型 + 可复现实验”阶段：

- Matter 是指令模拟，不是真实设备接入。
- 前端 GitHub Pages 默认仍可静态运行；后端 API 需要本地单独启动。
- 实验数据为典型日模拟信号，后续可替换为真实电价、天气和碳强度数据源。
