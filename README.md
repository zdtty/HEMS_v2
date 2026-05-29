# HEMS_v2

家庭能源管理系统原型，包含 GitHub Pages 前端演示、家庭平面孪生、边缘 API、数字孪生仿真核心、优化调度算法和可复现实验脚本。

## 快速运行

静态前端可以直接通过 GitHub Pages 访问：

https://zdtty.github.io/HEMS_v2/

本地运行边缘 API：

```bash
npm start
```

运行核心模块测试：

```bash
npm test
```

运行 API 烟囱演示：

```bash
npm run demo:api
```

运行仿真实验：

```bash
npm run experiment
```

## 项目结构

```text
assets/                 GitHub Pages 前端构建产物和首页增强脚本
server/                 本地边缘 REST API
src/core/               数字孪生、优化、RLHF、Matter 指令核心模块
experiments/            Baseline / Price-only / Proposed 对比实验
tests/                  核心模块测试
docs/                   架构与实现说明
```

## 与中期报告标准的对应关系

- React 响应式前端：已具备。
- 设备管理、排程、舒适度、EV、日志：已具备。
- 家庭平面孪生：已具备，且与总设备池同步。
- Node.js RESTful API：已补充 `server/index.js`。
- 数字孪生 ETP / Heun 求解：已补充 `src/core/twin.js`。
- 多目标调度：已补充 `src/core/optimizer.js`。
- RLHF 权重更新：已补充 `src/core/rlhf.js`。
- Matter 指令模拟：已补充 `src/core/matter.js`。
- 可复现实验：已补充 `experiments/run-baseline.js`。
- 多区数字孪生：已补充 `simulateMultiRoom` 与 `/api/twin/multi-room`。
- 前端 API 桥接：首页会显示边缘 API 连接状态，本地启动后可验证前后端联通。

## 注意

当前版本仍是研究原型。真实 Matter 设备接入、真实碳强度数据源、长期住宅部署数据采集，仍属于后续扩展工作。
