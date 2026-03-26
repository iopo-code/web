/**
 * 智慧温室监测管理平台 - 主应用逻辑
 */

const { createApp, ref, onMounted, computed } = Vue;
const { ElMessage } = ElementPlus;

const GreenhouseApp = {
    setup() {
        // ============== 响应式数据 ==============
        const date = ref(new Date().toLocaleDateString().replace(/\//g, '年') + '月');
        const env = ref({ ...AppConfig.defaultEnvData });

        // 设备开关状态
        const d1 = ref(true);  // 循环排风机
        const d2 = ref(false); // 智能变频水泵
        const d3 = ref(true);  // 北侧电动卷帘
        const d4 = ref(false); // 全光谱补光灯
        const d5 = ref(false); // 智能加热系统
        const d6 = ref(false); // 侧窗通风机

        // 设备状态数组
        const deviceStatus = [d1, d2, d3, d4, d5, d6];

        // ============== 导航切换 ==============
        const currentPage = ref('monitor'); // 当前页面：monitor-实时监测，control-设备控制

        // 导航菜单
        const navItems = [
            { id: 'monitor', name: '实时监测', icon: '📊' },
            { id: 'control', name: '设备控制', icon: '🎛️' },
            { id: 'history', name: '历史数据', icon: '📈' },
            { id: 'alarm', name: '告警管理', icon: '⚠️' },
            { id: 'settings', name: '系统设置', icon: '⚙️' }
        ];

        // 切换页面
        const switchPage = (pageId) => {
            currentPage.value = pageId;
            ElMessage.info(`已切换到${navItems.find(item => item.id === pageId)?.name || pageId}`);
        };

        // ============== 工具函数 ==============
        // 数值格式化：保留指定小数位，默认1位
        const formatNumber = (num, decimals = 1) => {
            const n = parseFloat(num);
            if (isNaN(n)) return num;
            return n.toFixed(decimals);
        };

        // 设备配置信息
        const deviceConfig = [
            { id: 'fan', name: '循环排风机', power: 0.8, icon: '🌀' },
            { id: 'pump', name: '智能变频水泵', power: 1.2, icon: '💧' },
            { id: 'roller', name: '北侧电动卷帘', power: 0.5, icon: '🌤️' },
            { id: 'light', name: '全光谱补光灯', power: 2.0, icon: '💡' },
            { id: 'heater', name: '智能加热系统', power: 3.0, icon: '🔥' },
            { id: 'vent', name: '侧窗通风机', power: 0.6, icon: '🌬️' }
        ];

        // ============== 核心功能 ==============
        // 根据数据流名称获取值
        const getDataValue = (dataArray, nameKeywords) => {
            if (!dataArray) return null;
            // 尝试根据名称关键词匹配数据流
            for (const item of dataArray) {
                const name = (item.id || item.name || '').toLowerCase();
                for (const keyword of nameKeywords) {
                    if (name.includes(keyword.toLowerCase())) {
                        return item.current_value;
                    }
                }
            }
            // 如果名称匹配失败，按索引 fallback
            const index = nameKeywords[1] ? parseInt(nameKeywords[1]) : -1;
            if (index >= 0 && dataArray[index]) {
                return dataArray[index].current_value;
            }
            return null;
        };

        // 获取实时环境数据
        const getRealTimeData = async () => {
            try {
                const res = await fetch(`${AppConfig.oneNET.apiUrl}/devices/${AppConfig.oneNET.deviceId}/datastreams`, {
                    headers: { "api-key": AppConfig.oneNET.apiKey }
                });
                const data = await res.json();
                if (data.data) {
                    console.log("OneNET原始数据:", data.data);
                    // 根据数据流名称匹配，支持名称和索引双保险
                    const newData = {
                        airTemp: getDataValue(data.data, ['temp', 'airtemp', 'temperature', '0']) || AppConfig.defaultEnvData.airTemp,
                        airHum: getDataValue(data.data, ['hum', 'airhum', 'humidity', '1']) || AppConfig.defaultEnvData.airHum,
                        soilTemp: getDataValue(data.data, ['soiltemp', 'soil_temp', 'stemp', '2']) || AppConfig.defaultEnvData.soilTemp,
                        soilHum: getDataValue(data.data, ['soilhum', 'soil_hum', 'shum', '3']) || AppConfig.defaultEnvData.soilHum,
                        co2: getDataValue(data.data, ['co2', 'carbon', '4']) || AppConfig.defaultEnvData.co2,
                        light: getDataValue(data.data, ['light', 'lux', 'illum', '5']) || AppConfig.defaultEnvData.light
                    };
                    // 确保值为数字类型
                    Object.keys(newData).forEach(key => {
                        newData[key] = parseFloat(newData[key]) || AppConfig.defaultEnvData[key];
                    });
                    // 响应式对象整体赋值触发更新
                    Object.assign(env.value, newData);
                    console.log("数据已更新:", env.value);
                }
            } catch (err) {
                console.log("使用模拟数据，离线可用 - 触发动态计算", err.message);
            }
        };

        // 单设备控制
        const controlDevice = async (device, status) => {
            try {
                await fetch(`${AppConfig.oneNET.apiUrl}/cmds?device_id=${AppConfig.oneNET.deviceId}`, {
                    method: "POST",
                    headers: {
                        "api-key": AppConfig.oneNET.apiKey,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ cmd: `${device}_${status ? 'on' : 'off'}` })
                });
                ElMessage.success(`${AppConfig.deviceNames[device]}${status ? '开启' : '关闭'}成功`);
            } catch (err) {
                ElMessage.success("本地模拟控制成功（离线模式）");
            }
        };

        // 全部设备控制
        const allControl = (status) => {
            deviceStatus.forEach(d => d.value = status);
            controlDevice('all', status);
        };

        // 初始化图表
        const initChart = () => {
            const chartDom = document.getElementById('trendChart');
            if (!chartDom) return;

            const myChart = echarts.init(chartDom);
            const option = {
                tooltip: { trigger: 'axis' },
                legend: { bottom: 0, icon: 'circle', itemSize: 8 },
                grid: { left: '3%', right: '4%', bottom: '10%', containLabel: true },
                xAxis: {
                    type: 'category',
                    boundaryGap: false,
                    data: ['00:00', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00'],
                    axisLine: { lineStyle: { color: '#eee' } },
                    axisLabel: { color: '#999' }
                },
                yAxis: {
                    type: 'value',
                    splitLine: { lineStyle: { type: 'dashed' } }
                },
                series: [
                    {
                        name: '温度 (℃)',
                        type: 'line',
                        smooth: true,
                        lineStyle: { width: 3, color: '#f56c6c' },
                        showSymbol: false,
                        areaStyle: {
                            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                                { offset: 0, color: 'rgba(245, 108, 108, 0.2)' },
                                { offset: 1, color: 'rgba(245, 108, 108, 0)' }
                            ])
                        },
                        data: [18, 16, 15, 22, 28, 26, 22, 20]
                    },
                    {
                        name: '湿度 (%)',
                        type: 'line',
                        smooth: true,
                        lineStyle: { width: 3, color: '#409eff' },
                        showSymbol: false,
                        areaStyle: {
                            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                                { offset: 0, color: 'rgba(64, 158, 255, 0.2)' },
                                { offset: 1, color: 'rgba(64, 158, 255, 0)' }
                            ])
                        },
                        data: [65, 70, 75, 55, 45, 48, 60, 68]
                    }
                ]
            };
            myChart.setOption(option);
            window.addEventListener('resize', () => myChart.resize());
        };

        // 组件挂载后执行
        onMounted(() => {
            getRealTimeData();
            // 定时刷新数据
            setInterval(getRealTimeData, AppConfig.refreshInterval);
            // 初始化图表
            initChart();
        });

        // ============== 根据 env 生成的动态提示 ==============
        const airSub = computed(() => {
            const t = Number(env.value.airTemp);
            const h = Number(env.value.airHum);
            if (!isFinite(t) || !isFinite(h)) return '—';
            if (t >= 30) return '⚠️ 空气温度偏高，建议加强通风降温';
            if (t <= 10) return '⚠️ 空气温度偏低，建议开启加温设备';
            if (h < 40) return '干燥：相对湿度偏低，建议加湿';
            if (h > 80) return '潮湿：相对湿度偏高，注意防病害';
            return '舒适：空气温湿度适宜植物生长';
        });

        const soilSub = computed(() => {
            const sh = Number(env.value.soilHum);
            if (!isFinite(sh)) return '—';
            if (sh < 30) return '⚠️ 土壤偏干，建议启动灌溉';
            if (sh < 45) return '土壤湿度偏低，注意保持水分';
            if (sh > 70) return '土壤过湿，注意排水以防根系缺氧';
            return '土壤湿度在正常范围';
        });

        const co2Sub = computed(() => {
            const c = Number(env.value.co2);
            if (!isFinite(c)) return '—';
            if (c < 300) return 'CO2 偏低，可能限制光合作用';
            if (c <= 1000) return 'CO2 水平良好，有利于光合作用';
            if (c <= 1500) return 'CO2 较高，光合作用提升但注意通风';
            return 'CO2 偏高，建议短时通风换气';
        });

        const lightSub = computed(() => {
            const l = Number(env.value.light);
            if (!isFinite(l)) return '—';
            if (l < 1000) return '光照弱，考虑补光以促进生长';
            if (l < 20000) return '光照适中，生长条件良好';
            return '光照强，注意遮光或避免灼伤';
        });

        // ============== 设备统计 ==============
        // 运行中设备数量
        const runningCount = computed(() => {
            return deviceStatus.filter(d => d.value).length;
        });

        // 总设备数量
        const totalDevices = computed(() => deviceStatus.length);

        // 当前总功率 (kW)
        const totalPower = computed(() => {
            return deviceStatus.reduce((sum, d, index) => {
                return sum + (d.value ? deviceConfig[index].power : 0);
            }, 0);
        });

        // 运行状态文字
        const runningStatus = computed(() => {
            if (runningCount.value === 0) return '全部待机';
            if (runningCount.value === totalDevices.value) return '全部运行';
            return `${runningCount.value} 台运行中`;
        });

        // 当前页面信息
        const currentPageInfo = computed(() => {
            const item = navItems.find(item => item.id === currentPage.value);
            return item || { name: '未知页面', icon: '📄' };
        });

        // 设备在线率（%）
        const onlineRate = computed(() => {
            return Math.round(runningCount.value / totalDevices.value * 100);
        });

        // ============== 环境评估系统 ==============
        // 环境健康评分 (0-100)
        const envScore = computed(() => {
            let score = 100;
            const t = Number(env.value.airTemp);
            const h = Number(env.value.airHum);
            const sh = Number(env.value.soilHum);
            const c = Number(env.value.co2);
            const l = Number(env.value.light);

            // 温度评分
            if (t < 10 || t > 40) score -= 30;
            else if (t < 15 || t > 35) score -= 15;
            else if (t < 20 || t > 30) score -= 5;

            // 湿度评分
            if (h < 30 || h > 90) score -= 20;
            else if (h < 40 || h > 80) score -= 10;

            // 土壤湿度评分
            if (sh < 20 || sh > 80) score -= 20;
            else if (sh < 30 || sh > 70) score -= 10;

            // CO2评分
            if (c < 200 || c > 2000) score -= 15;
            else if (c < 300 || c > 1500) score -= 5;

            return Math.max(0, score);
        });

        // 评分颜色
        const scoreColor = computed(() => {
            if (envScore.value >= 80) return '#67c23a';
            if (envScore.value >= 60) return '#e6a23c';
            return '#f56c6c';
        });

        // 各指标状态详情
        const envIndicators = computed(() => {
            const t = Number(env.value.airTemp);
            const h = Number(env.value.airHum);
            const sh = Number(env.value.soilHum);
            const c = Number(env.value.co2);
            const l = Number(env.value.light);

            const getStatus = (value, goodMin, goodMax, warnMin, warnMax) => {
                if (value >= goodMin && value <= goodMax) return { status: 'success', text: '正常' };
                if (value >= warnMin && value <= warnMax) return { status: 'warning', text: '注意' };
                return { status: 'danger', text: '异常' };
            };

            return [
                { name: '空气温度', icon: '🌡️', ...getStatus(t, 20, 30, 15, 35) },
                { name: '空气湿度', icon: '💧', ...getStatus(h, 40, 80, 30, 90) },
                { name: '土壤湿度', icon: '🌱', ...getStatus(sh, 30, 70, 20, 80) },
                { name: 'CO2浓度', icon: '🌿', ...getStatus(c, 300, 1000, 200, 1500) },
                { name: '光照强度', icon: '☀️', ...getStatus(l, 10000, 50000, 1000, 80000) },
                { name: '整体状态', icon: '📊', status: envScore.value >= 80 ? 'success' : envScore.value >= 60 ? 'warning' : 'danger', text: envScore.value >= 80 ? '优秀' : envScore.value >= 60 ? '一般' : '较差' }
            ];
        });

        // 优化建议
        const suggestions = computed(() => {
            const result = [];
            const t = Number(env.value.airTemp);
            const h = Number(env.value.airHum);
            const sh = Number(env.value.soilHum);
            const c = Number(env.value.co2);
            const l = Number(env.value.light);

            if (t > 30) result.push('温度偏高，建议开启通风设备降温');
            if (t < 15) result.push('温度偏低，考虑启用加温系统');
            if (h < 40) result.push('空气干燥，建议增加空气湿度');
            if (h > 80) result.push('湿度过高，加强通风降低湿度');
            if (sh < 30) result.push('土壤偏干，建议启动灌溉系统');
            if (sh > 70) result.push('土壤过湿，注意排水防涝');
            if (c < 300) result.push('CO2偏低，可适当补充气肥');
            if (c > 1500) result.push('CO2过高，建议短时通风换气');
            if (l < 1000) result.push('光照不足，建议开启补光灯');
            if (l > 80000) result.push('光照过强，建议适当遮阴');

            return result;
        });

        // 调试用：模拟数据变化（浏览器控制台可调用 app.debugSimulate()）
        const debugSimulate = () => {
            const randomChange = () => (Math.random() - 0.5) * 20;
            env.value = {
                airTemp: 24.5 + randomChange(),
                airHum: 62 + randomChange(),
                soilTemp: 18.2 + randomChange() * 0.5,
                soilHum: 28 + randomChange(),
                co2: 856 + randomChange() * 10,
                light: 42500 + randomChange() * 1000
            };
            // 确保值在合理范围
            env.value.airTemp = Math.max(5, Math.min(45, env.value.airTemp));
            env.value.airHum = Math.max(10, Math.min(95, env.value.airHum));
            env.value.soilHum = Math.max(5, Math.min(90, env.value.soilHum));
            env.value.co2 = Math.max(200, Math.min(2000, env.value.co2));
            env.value.light = Math.max(100, Math.min(100000, env.value.light));
            console.log("模拟数据变化:", env.value);
            ElMessage.success("已刷新模拟数据");
        };

        // 获取设备状态
        const getDeviceStatus = (index) => {
            return deviceStatus[index]?.value;
        };

        // 设置设备状态
        const setDeviceStatus = (index, value) => {
            if (deviceStatus[index]) {
                deviceStatus[index].value = value;
            }
        };

        return {
            date, env,
            d1, d2, d3, d4, d5, d6,
            deviceConfig,
            runningCount, totalDevices, totalPower, runningStatus, onlineRate,
            currentPage, navItems, switchPage, currentPageInfo,
            controlDevice, allControl,
            airSub, soilSub, co2Sub, lightSub,
            debugSimulate,
            formatNumber,
            getDeviceStatus,
            setDeviceStatus,
            envScore, scoreColor, envIndicators, suggestions
        };
    }
};

// 创建并挂载应用
const app = createApp(GreenhouseApp);
app.use(ElementPlus);
app.mount('#app');