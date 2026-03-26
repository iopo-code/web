/**
 * 智慧温室监测管理平台 - 配置文件
 * 所有敏感配置信息统一管理
 */

const AppConfig = {
    // OneNET平台配置 - 请替换为实际信息
    oneNET: {
        deviceId: "你的设备ID",
        apiKey: "你的API Key",
        apiUrl: "http://api.heclouds.com"
    },

    // 数据刷新间隔（毫秒）
    refreshInterval: 60000,

    // 环境数据默认值
    defaultEnvData: {
        airTemp: 24.5,
        airHum: 62,
        soilTemp: 18.2,
        soilHum: 28,
        co2: 856,
        light: 42500
    },

    // 设备名称映射
    deviceNames: {
        fan: '循环排风机',
        pump: '智能变频水泵',
        roller: '北侧电动卷帘',
        light: '全光谱补光灯',
        heater: '智能加热系统',
        vent: '侧窗通风机'
    }
};

// 防止配置被修改
Object.freeze(AppConfig);