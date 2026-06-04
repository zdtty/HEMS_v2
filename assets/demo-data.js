(function () {
  const deviceKey = "hems.devices.v1";
  const markerKey = "hems.demo.seeded.v1";

  const demoDevices = [
    {
      id: "demo_living_inverter_ac",
      name: "客厅变频空调",
      room: "客厅",
      type: "inverterac",
      icon: "🌬️",
      matterType: "0x0302",
      matterCluster: "0x0201",
      rated: 1800,
      variable: true,
      shiftable: false,
      chargeable: false,
      strategy: "B/G/H",
      cycleMins: 0,
      on: true,
      power: 1260,
      shifted: false,
      shiftTo: null,
      brightness: 0
    },
    {
      id: "demo_living_tv",
      name: "客厅电视",
      room: "客厅",
      type: "tv",
      icon: "📺",
      matterType: "0x0028",
      matterCluster: "0x0008",
      rated: 120,
      variable: true,
      shiftable: false,
      chargeable: false,
      strategy: "H",
      cycleMins: 0,
      on: true,
      power: 72,
      shifted: false,
      shiftTo: null,
      brightness: 68
    },
    {
      id: "demo_bedroom_ac",
      name: "主卧空调",
      room: "主卧",
      type: "ac",
      icon: "❄️",
      matterType: "0x0301",
      matterCluster: "0x0201",
      rated: 2200,
      variable: true,
      shiftable: false,
      chargeable: false,
      strategy: "B/G",
      cycleMins: 0,
      on: true,
      power: 820,
      shifted: false,
      shiftTo: null,
      brightness: 0
    },
    {
      id: "demo_kitchen_fridge",
      name: "厨房冰箱",
      room: "厨房",
      type: "fridge",
      icon: "🧊",
      matterType: "0x0070",
      matterCluster: "0x0055",
      rated: 150,
      variable: false,
      shiftable: false,
      chargeable: false,
      strategy: "—",
      cycleMins: 0,
      on: true,
      power: 96,
      shifted: false,
      shiftTo: null,
      brightness: 0
    },
    {
      id: "demo_kitchen_dishwasher",
      name: "厨房洗碗机",
      room: "厨房",
      type: "dishwasher",
      icon: "🍽️",
      matterType: "0x0075",
      matterCluster: "0x0055",
      rated: 1800,
      variable: false,
      shiftable: true,
      chargeable: false,
      strategy: "A",
      cycleMins: 45,
      on: false,
      power: 0,
      shifted: true,
      shiftTo: 3,
      brightness: 0
    },
    {
      id: "demo_balcony_washer",
      name: "阳台洗衣机",
      room: "阳台",
      type: "washer",
      icon: "🌀",
      matterType: "0x007C",
      matterCluster: "0x0055",
      rated: 500,
      variable: false,
      shiftable: true,
      chargeable: false,
      strategy: "A",
      cycleMins: 60,
      on: false,
      power: 0,
      shifted: true,
      shiftTo: 3,
      brightness: 0
    },
    {
      id: "demo_bath_heater",
      name: "卫生间热水器",
      room: "卫生间",
      type: "heater",
      icon: "🔥",
      matterType: "0x050F",
      matterCluster: "0x0201",
      rated: 3000,
      variable: false,
      shiftable: true,
      chargeable: false,
      strategy: "A",
      cycleMins: 90,
      on: false,
      power: 0,
      shifted: true,
      shiftTo: 5,
      brightness: 0
    },
    {
      id: "demo_study_purifier",
      name: "书房空气净化器",
      room: "书房",
      type: "airpurifier",
      icon: "💨",
      matterType: "0x002B",
      matterCluster: "0x0055",
      rated: 45,
      variable: true,
      shiftable: true,
      chargeable: true,
      strategy: "F/H",
      cycleMins: 90,
      on: true,
      power: 32,
      shifted: false,
      shiftTo: null,
      brightness: 0
    }
  ];

  function readDevices() {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(deviceKey) || "null");
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  const current = readDevices();
  if (!current || current.length === 0) {
    window.localStorage.setItem(deviceKey, JSON.stringify(demoDevices));
    window.localStorage.setItem(markerKey, new Date().toISOString());
  }

  window.HEMS_DEMO_LOGS = [
    {
      ts: "08:00:12",
      msg: "演示家庭设备池已同步：8 台 Matter 风格设备在线",
      matterCmd: "[matter 08:00:12] >> nodeId=gateway cluster=0x001D cmd=CommissioningComplete"
    },
    {
      ts: "08:03:26",
      msg: "客厅变频空调进入舒适节能模式，目标温度 25.8°C",
      matterCmd: "[matter 08:03:26] >> nodeId=living_inverter_ac cluster=0x0201 type=0x0302 cmd=SetpointRaiseLower mode=0 amount=80"
    },
    {
      ts: "08:05:41",
      msg: "阳台洗衣机延迟至 03:00 谷价窗口运行",
      matterCmd: "[matter 08:05:41] >> nodeId=balcony_washer cluster=0x0055 type=0x007C cmd=OnWithTimedOff onTime=60 offWaitTime=0"
    },
    {
      ts: "08:06:18",
      msg: "EV 充电建议窗口生成：03:00 开始，预计节省 ¥18.9",
      matterCmd: "[matter 08:06:18] >> nodeId=ev_charger cluster=0x0099 type=0x050C cmd=EnableCharging maxChargingCurrent=32"
    }
  ];

  window.HEMS_DEMO_DEVICES = demoDevices;
})();
