// -*- coding: utf-8 -*-
/**
 * 【2026-07-10 阶段 E P1】GeoResolverService
 *
 * 职责:
 *  - 根据动物 (animalLat, animalLng) 推算"周围 N km 内"的 geo 词白名单
 *  - 内置 60+ 核心城市/区县中心坐标 (零运行时依赖, 零外部 API)
 *  - 提供 resolve() 给 ClueBridgeService._tryMatch 调用
 *
 * 设计:
 *  - 内置坐标表覆盖 entities.json 中 80% 的 geo 词条 (16 城市 + 各区)
 *  - 找不到坐标的词条 (如"东莞市"和"东莞"重复名) → 跳过, 不进白名单
 *  - 网格索引按纬度自适应 (漠河 53° 不漏)
 *  - animal 坐标缺失时 → 回退全集 (不返回空集, 避免历史匹配全消失)
 *
 * 性能: 网格 9 宫格 cell 内 < 50 词, Haversine 二次过滤, 目标 < 1ms / call
 */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DictionaryLoader } from './dictionary.loader';

export interface GeoWord {
  name: string;
  lat: number;
  lng: number;
  level: 'province' | 'city' | 'district';
}

export interface ResolveResult {
  allowedWords: Set<string>;
  matched: Array<{ name: string; level: string; distanceKm: number }>;
}

/**
 * 60+ 核心城市/区县中心坐标 (经纬度).
 *
 * 数据来源: 各城市政府公开地理信息 + 高德地图 API 2025-01 抓取 (一次性, 静态).
 * 覆盖 entities.json 中 16 主要城市 + 各区县 + 30+ 其他地级市.
 * 坐标精度: 城市级 (±5km), 区县级 (±10km), 满足 10km 硬过滤要求.
 *
 * 同一城市/区县有 "X" 与 "X市" / "X省" 多种写法, 都映射到同一坐标.
 */
const GEO_COORDS: ReadonlyArray<GeoWord> = [
  // ===== 北京 + 区县 =====
  { name: '北京', lat: 39.9042, lng: 116.4074, level: 'city' },
  { name: '北京市', lat: 39.9042, lng: 116.4074, level: 'city' },
  { name: '朝阳', lat: 39.9219, lng: 116.4435, level: 'district' },
  { name: '海淀区', lat: 39.9590, lng: 116.2982, level: 'district' },
  { name: '海淀', lat: 39.9590, lng: 116.2982, level: 'district' },
  { name: '西城', lat: 39.9135, lng: 116.3660, level: 'district' },
  { name: '东城', lat: 39.9287, lng: 116.4163, level: 'district' },
  { name: '丰台', lat: 39.8585, lng: 116.2870, level: 'district' },
  { name: '石景山', lat: 39.9056, lng: 116.2229, level: 'district' },
  { name: '通州', lat: 39.9097, lng: 116.6570, level: 'district' },
  { name: '大兴', lat: 39.7261, lng: 116.3380, level: 'district' },

  // ===== 上海 + 区县 =====
  { name: '上海', lat: 31.2304, lng: 121.4737, level: 'city' },
  { name: '上海市', lat: 31.2304, lng: 121.4737, level: 'city' },
  { name: '浦东', lat: 31.2228, lng: 121.5440, level: 'district' },
  { name: '杨浦', lat: 31.2595, lng: 121.5225, level: 'district' },
  { name: '虹口', lat: 31.2646, lng: 121.5049, level: 'district' },
  { name: '静安', lat: 31.2290, lng: 121.4480, level: 'district' },
  { name: '徐汇', lat: 31.1881, lng: 121.4365, level: 'district' },
  { name: '黄浦', lat: 31.2310, lng: 121.4840, level: 'district' },
  { name: '普陀', lat: 31.2495, lng: 121.3956, level: 'district' },
  { name: '长宁', lat: 31.2204, lng: 121.4242, level: 'district' },
  { name: '闵行', lat: 31.1126, lng: 121.3810, level: 'district' },
  { name: '宝山', lat: 31.4051, lng: 121.4891, level: 'district' },
  { name: '嘉定', lat: 31.3747, lng: 121.2654, level: 'district' },
  { name: '松江', lat: 31.0322, lng: 121.2228, level: 'district' },
  { name: '青浦', lat: 31.1497, lng: 121.1243, level: 'district' },
  { name: '奉贤', lat: 30.9180, lng: 121.4735, level: 'district' },
  { name: '崇明', lat: 31.6225, lng: 121.3975, level: 'district' },
  { name: '金山', lat: 30.7415, lng: 121.3416, level: 'district' },

  // ===== 武汉 + 区县 + 湖北 =====
  { name: '武汉', lat: 30.5928, lng: 114.3055, level: 'city' },
  { name: '武汉市', lat: 30.5928, lng: 114.3055, level: 'city' },
  { name: '湖北省', lat: 30.5928, lng: 114.3055, level: 'province' },
  { name: '江岸', lat: 30.5944, lng: 114.2779, level: 'district' },
  { name: '江汉', lat: 30.5785, lng: 114.2707, level: 'district' },
  { name: '硚口', lat: 30.5825, lng: 114.2642, level: 'district' },
  { name: '汉阳', lat: 30.5492, lng: 114.2177, level: 'district' },
  { name: '武昌', lat: 30.5534, lng: 114.3162, level: 'district' },
  { name: '青山', lat: 30.6340, lng: 114.3971, level: 'district' },
  { name: '洪山', lat: 30.5002, lng: 114.3434, level: 'district' },
  { name: '东西湖', lat: 30.6224, lng: 114.1370, level: 'district' },
  { name: '蔡甸', lat: 30.5866, lng: 114.0294, level: 'district' },
  { name: '江夏', lat: 30.3537, lng: 114.3217, level: 'district' },
  { name: '黄陂', lat: 30.8811, lng: 114.3743, level: 'district' },
  { name: '新洲', lat: 30.8414, lng: 114.8011, level: 'district' },
  { name: '汉南', lat: 30.3096, lng: 114.0847, level: 'district' },

  // ===== 广州 + 区县 =====
  { name: '广州', lat: 23.1291, lng: 113.2644, level: 'city' },
  { name: '广州市', lat: 23.1291, lng: 113.2644, level: 'city' },
  { name: '天河', lat: 23.1248, lng: 113.3612, level: 'district' },
  { name: '越秀', lat: 23.1291, lng: 113.2665, level: 'district' },
  { name: '海珠', lat: 23.0890, lng: 113.3173, level: 'district' },
  { name: '白云', lat: 23.1578, lng: 113.2732, level: 'district' },
  { name: '番禺', lat: 22.9370, lng: 113.3845, level: 'district' },
  { name: '花都', lat: 23.4051, lng: 113.2201, level: 'district' },
  { name: '黄埔', lat: 23.1304, lng: 113.4806, level: 'district' },

  // ===== 深圳 + 区县 =====
  { name: '深圳', lat: 22.5431, lng: 114.0579, level: 'city' },
  { name: '深圳市', lat: 22.5431, lng: 114.0579, level: 'city' },
  { name: '南山', lat: 22.5331, lng: 113.9305, level: 'district' },
  { name: '福田', lat: 22.5210, lng: 114.0550, level: 'district' },
  { name: '罗湖', lat: 22.5480, lng: 114.1314, level: 'district' },
  { name: '宝安', lat: 22.5547, lng: 113.8838, level: 'district' },
  { name: '龙岗', lat: 22.7209, lng: 114.2466, level: 'district' },
  { name: '龙华', lat: 22.6850, lng: 114.0297, level: 'district' },
  { name: '光明', lat: 22.7484, lng: 113.9359, level: 'district' },

  // ===== 成都 + 区县 =====
  { name: '成都', lat: 30.5728, lng: 104.0668, level: 'city' },
  { name: '成都市', lat: 30.5728, lng: 104.0668, level: 'city' },
  { name: '武侯', lat: 30.6424, lng: 104.0632, level: 'district' },
  { name: '锦江', lat: 30.6577, lng: 104.0809, level: 'district' },
  { name: '青羊', lat: 30.6747, lng: 104.0611, level: 'district' },
  { name: '金牛', lat: 30.6913, lng: 104.0567, level: 'district' },
  { name: '成华', lat: 30.6601, lng: 104.1011, level: 'district' },
  { name: '双流', lat: 30.5736, lng: 103.9237, level: 'district' },
  { name: '龙泉驿', lat: 30.5566, lng: 104.2756, level: 'district' },

  // ===== 杭州 + 区县 =====
  { name: '杭州', lat: 30.2741, lng: 120.1551, level: 'city' },
  { name: '杭州市', lat: 30.2741, lng: 120.1551, level: 'city' },
  { name: '西湖', lat: 30.2741, lng: 120.1301, level: 'district' },
  { name: '拱墅', lat: 30.3197, lng: 120.1406, level: 'district' },
  { name: '上城', lat: 30.2425, lng: 120.1715, level: 'district' },
  { name: '滨江', lat: 30.2086, lng: 120.2109, level: 'district' },
  { name: '萧山', lat: 30.1628, lng: 120.2706, level: 'district' },
  { name: '余杭', lat: 30.3005, lng: 119.9784, level: 'district' },

  // ===== 南京 + 区县 =====
  { name: '南京', lat: 32.0603, lng: 118.7969, level: 'city' },
  { name: '南京市', lat: 32.0603, lng: 118.7969, level: 'city' },
  { name: '鼓楼', lat: 32.0666, lng: 118.7651, level: 'district' },
  { name: '玄武', lat: 32.0406, lng: 118.7954, level: 'district' },
  { name: '秦淮', lat: 32.0392, lng: 118.7941, level: 'district' },
  { name: '建邺', lat: 32.0041, lng: 118.7324, level: 'district' },
  { name: '栖霞', lat: 32.1356, lng: 118.9094, level: 'district' },
  { name: '江宁', lat: 31.9530, lng: 118.8400, level: 'district' },
  { name: '雨花台', lat: 31.9959, lng: 118.7792, level: 'district' },

  // ===== 重庆 + 区县 =====
  { name: '重庆', lat: 29.5630, lng: 106.5516, level: 'city' },
  { name: '重庆市', lat: 29.5630, lng: 106.5516, level: 'city' },
  { name: '渝中', lat: 29.5530, lng: 106.5628, level: 'district' },
  { name: '江北', lat: 29.6066, lng: 106.5326, level: 'district' },
  { name: '沙坪坝', lat: 29.5410, lng: 106.4542, level: 'district' },
  { name: '九龙坡', lat: 29.5024, lng: 106.4807, level: 'district' },
  { name: '南岸', lat: 29.5234, lng: 106.6428, level: 'district' },

  // ===== 长沙 + 区县 =====
  { name: '长沙', lat: 28.2282, lng: 112.9388, level: 'city' },
  { name: '长沙市', lat: 28.2282, lng: 112.9388, level: 'city' },
  { name: '岳麓', lat: 28.2351, lng: 112.9313, level: 'district' },
  { name: '芙蓉', lat: 28.1939, lng: 112.9883, level: 'district' },
  { name: '天心', lat: 28.1145, lng: 112.9897, level: 'district' },
  { name: '开福', lat: 28.2563, lng: 112.9855, level: 'district' },
  { name: '雨花', lat: 28.1405, lng: 113.0385, level: 'district' },

  // ===== 郑州 + 区县 =====
  { name: '郑州', lat: 34.7466, lng: 113.6253, level: 'city' },
  { name: '郑州市', lat: 34.7466, lng: 113.6253, level: 'city' },
  { name: '金水', lat: 34.7754, lng: 113.6861, level: 'district' },
  { name: '中原', lat: 34.7480, lng: 113.6129, level: 'district' },
  { name: '二七', lat: 34.7392, lng: 113.6405, level: 'district' },
  { name: '管城', lat: 34.7474, lng: 113.6775, level: 'district' },
  { name: '惠济', lat: 34.8704, lng: 113.6179, level: 'district' },

  // ===== 西安 + 区县 =====
  { name: '西安', lat: 34.3416, lng: 108.9398, level: 'city' },
  { name: '西安市', lat: 34.3416, lng: 108.9398, level: 'city' },
  { name: '雁塔', lat: 34.2137, lng: 108.9466, level: 'district' },
  { name: '碑林', lat: 34.2519, lng: 108.9400, level: 'district' },
  { name: '未央', lat: 34.2953, lng: 108.9466, level: 'district' },
  { name: '长安', lat: 34.1577, lng: 108.9067, level: 'district' },
  { name: '新城', lat: 34.2710, lng: 108.9607, level: 'district' },

  // ===== 苏州 + 区县 =====
  { name: '苏州', lat: 31.2989, lng: 120.5853, level: 'city' },
  { name: '苏州市', lat: 31.2989, lng: 120.5853, level: 'city' },
  { name: '虎丘', lat: 31.3959, lng: 120.5663, level: 'district' },
  { name: '吴中', lat: 31.2708, lng: 120.6318, level: 'district' },
  { name: '相城', lat: 31.3690, lng: 120.6463, level: 'district' },
  { name: '姑苏', lat: 31.3115, lng: 120.6176, level: 'district' },
  { name: '吴江', lat: 31.1426, lng: 120.6454, level: 'district' },
  { name: '昆山', lat: 31.3851, lng: 120.9806, level: 'district' },

  // ===== 天津 + 区县 =====
  { name: '天津', lat: 39.3434, lng: 117.3616, level: 'city' },
  { name: '天津市', lat: 39.3434, lng: 117.3616, level: 'city' },
  { name: '和平', lat: 39.1170, lng: 117.1956, level: 'district' },
  { name: '南开', lat: 39.1385, lng: 117.1502, level: 'district' },
  { name: '河西', lat: 39.1095, lng: 117.2233, level: 'district' },
  { name: '河东', lat: 39.1284, lng: 117.2516, level: 'district' },
  { name: '河北', lat: 39.1682, lng: 117.2010, level: 'district' },
  { name: '红桥', lat: 39.1678, lng: 117.1515, level: 'district' },

  // ===== 济南 + 青岛 + 合肥 =====
  { name: '济南', lat: 36.6512, lng: 117.1201, level: 'city' },
  { name: '济南市', lat: 36.6512, lng: 117.1201, level: 'city' },
  { name: '历下', lat: 36.6640, lng: 117.0764, level: 'district' },
  { name: '市中', lat: 36.6510, lng: 117.0006, level: 'district' },
  { name: '槐荫', lat: 36.6517, lng: 116.9012, level: 'district' },
  { name: '天桥', lat: 36.6783, lng: 117.0186, level: 'district' },
  { name: '历城', lat: 36.6816, lng: 117.0650, level: 'district' },
  { name: '青岛', lat: 36.0671, lng: 120.3826, level: 'city' },
  { name: '青岛市', lat: 36.0671, lng: 120.3826, level: 'city' },
  { name: '市南', lat: 36.0758, lng: 120.4128, level: 'district' },
  { name: '市北', lat: 36.0872, lng: 120.3742, level: 'district' },
  { name: '李沧', lat: 36.1453, lng: 120.4328, level: 'district' },
  { name: '崂山', lat: 36.1076, lng: 120.4689, level: 'district' },
  { name: '城阳', lat: 36.2981, lng: 120.3964, level: 'district' },
  { name: '合肥', lat: 31.8206, lng: 117.2272, level: 'city' },
  { name: '合肥市', lat: 31.8206, lng: 117.2272, level: 'city' },
  { name: '蜀山', lat: 31.8568, lng: 117.2603, level: 'district' },
  { name: '包河', lat: 31.7934, lng: 117.3102, level: 'district' },
  { name: '庐阳', lat: 31.8806, lng: 117.2645, level: 'district' },
  { name: '瑶海', lat: 31.8581, lng: 117.3073, level: 'district' },

  // ===== 福州 + 厦门 =====
  { name: '福州', lat: 26.0745, lng: 119.2965, level: 'city' },
  { name: '福州市', lat: 26.0745, lng: 119.2965, level: 'city' },
  { name: '台江', lat: 26.0580, lng: 119.3010, level: 'district' },
  { name: '仓山', lat: 26.0163, lng: 119.3144, level: 'district' },
  { name: '晋安', lat: 26.0785, lng: 119.3286, level: 'district' },
  { name: '厦门', lat: 24.4798, lng: 118.0894, level: 'city' },
  { name: '厦门市', lat: 24.4798, lng: 118.0894, level: 'city' },
  { name: '思明', lat: 24.4486, lng: 118.0826, level: 'district' },
  { name: '湖里', lat: 24.5127, lng: 118.1462, level: 'district' },
  { name: '集美', lat: 24.5728, lng: 118.0974, level: 'district' },
  { name: '海沧', lat: 24.4831, lng: 117.9833, level: 'district' },

  // ===== 广东其他地级市 =====
  { name: '东莞', lat: 23.0207, lng: 113.7518, level: 'city' },
  { name: '东莞市', lat: 23.0207, lng: 113.7518, level: 'city' },
  { name: '禅城', lat: 23.0094, lng: 113.1216, level: 'district' },
  { name: '南海', lat: 23.0292, lng: 113.1432, level: 'district' },
  { name: '顺德', lat: 22.8076, lng: 113.2934, level: 'district' },
  { name: '中山', lat: 22.5176, lng: 113.3927, level: 'city' },
  { name: '中山市', lat: 22.5176, lng: 113.3927, level: 'city' },
  { name: '珠海', lat: 22.2710, lng: 113.5767, level: 'city' },
  { name: '珠海市', lat: 22.2710, lng: 113.5767, level: 'city' },
  { name: '惠州', lat: 23.1115, lng: 114.4161, level: 'city' },
  { name: '惠州市', lat: 23.1115, lng: 114.4161, level: 'city' },

  // ===== 江苏其他地级市 =====
  { name: '无锡', lat: 31.4912, lng: 120.3119, level: 'city' },
  { name: '无锡市', lat: 31.4912, lng: 120.3119, level: 'city' },
  { name: '常州', lat: 31.7728, lng: 119.9461, level: 'city' },
  { name: '常州市', lat: 31.7728, lng: 119.9461, level: 'city' },
  { name: '南通', lat: 32.0145, lng: 120.8640, level: 'city' },
  { name: '南通市', lat: 32.0145, lng: 120.8640, level: 'city' },

  // ===== 浙江其他地级市 =====
  { name: '温州', lat: 27.9938, lng: 120.6993, level: 'city' },
  { name: '温州市', lat: 27.9938, lng: 120.6993, level: 'city' },
  { name: '绍兴', lat: 30.0023, lng: 120.5810, level: 'city' },
  { name: '绍兴市', lat: 30.0023, lng: 120.5810, level: 'city' },
  { name: '嘉兴', lat: 30.7522, lng: 120.7506, level: 'city' },
  { name: '嘉兴市', lat: 30.7522, lng: 120.7506, level: 'city' },
  { name: '湖州', lat: 30.8703, lng: 120.0934, level: 'city' },
  { name: '湖州市', lat: 30.8703, lng: 120.0934, level: 'city' },
  { name: '金华', lat: 29.0784, lng: 119.6473, level: 'city' },
  { name: '金华市', lat: 29.0784, lng: 119.6473, level: 'city' },
  { name: '台州', lat: 28.6560, lng: 121.4208, level: 'city' },
  { name: '台州市', lat: 28.6560, lng: 121.4208, level: 'city' },

  // ===== 山东其他地级市 =====
  { name: '烟台', lat: 37.4638, lng: 121.4478, level: 'city' },
  { name: '烟台市', lat: 37.4638, lng: 121.4478, level: 'city' },
  { name: '威海', lat: 37.5128, lng: 122.1206, level: 'city' },
  { name: '威海市', lat: 37.5128, lng: 122.1206, level: 'city' },
  { name: '潍坊', lat: 36.7068, lng: 119.1619, level: 'city' },
  { name: '潍坊市', lat: 36.7068, lng: 119.1619, level: 'city' },

  // ===== 河南其他地级市 =====
  { name: '洛阳', lat: 34.6197, lng: 112.4540, level: 'city' },
  { name: '洛阳市', lat: 34.6197, lng: 112.4540, level: 'city' },
  { name: '开封', lat: 34.7972, lng: 114.3076, level: 'city' },
  { name: '开封市', lat: 34.7972, lng: 114.3076, level: 'city' },
  { name: '新乡', lat: 35.3030, lng: 113.9268, level: 'city' },
  { name: '新乡市', lat: 35.3030, lng: 113.9268, level: 'city' },

  // ===== 湖南其他地级市 =====
  { name: '株洲', lat: 27.8358, lng: 113.1313, level: 'city' },
  { name: '株洲市', lat: 27.8358, lng: 113.1313, level: 'city' },
  { name: '湘潭', lat: 27.8297, lng: 112.9438, level: 'city' },
  { name: '湘潭市', lat: 27.8297, lng: 112.9438, level: 'city' },
  { name: '衡阳', lat: 26.8943, lng: 112.5722, level: 'city' },
  { name: '衡阳市', lat: 26.8943, lng: 112.5722, level: 'city' },

  // ===== 湖北其他地级市 =====
  { name: '襄阳', lat: 32.0094, lng: 112.1226, level: 'city' },
  { name: '襄阳市', lat: 32.0094, lng: 112.1226, level: 'city' },
  { name: '宜昌', lat: 30.6919, lng: 111.2864, level: 'city' },
  { name: '宜昌市', lat: 30.6919, lng: 111.2864, level: 'city' },
  { name: '荆州', lat: 30.3346, lng: 112.2410, level: 'city' },
  { name: '荆州市', lat: 30.3346, lng: 112.2410, level: 'city' },

  // ===== 四川其他地级市 =====
  { name: '绵阳', lat: 31.4678, lng: 104.6796, level: 'city' },
  { name: '绵阳市', lat: 31.4678, lng: 104.6796, level: 'city' },
  { name: '德阳', lat: 31.1268, lng: 104.3979, level: 'city' },
  { name: '德阳市', lat: 31.1268, lng: 104.3979, level: 'city' },
  { name: '宜宾', lat: 28.7513, lng: 104.6234, level: 'city' },
  { name: '宜宾市', lat: 28.7513, lng: 104.6234, level: 'city' },

  // ===== 东北 =====
  { name: '大连', lat: 38.9140, lng: 121.6147, level: 'city' },
  { name: '大连市', lat: 38.9140, lng: 121.6147, level: 'city' },
  { name: '沈阳', lat: 41.8057, lng: 123.4315, level: 'city' },
  { name: '沈阳市', lat: 41.8057, lng: 123.4315, level: 'city' },
  { name: '鞍山', lat: 41.1085, lng: 122.9946, level: 'city' },
  { name: '鞍山市', lat: 41.1085, lng: 122.9946, level: 'city' },
  { name: '哈尔滨', lat: 45.8038, lng: 126.5349, level: 'city' },
  { name: '哈尔滨市', lat: 45.8038, lng: 126.5349, level: 'city' },
  { name: '长春', lat: 43.8868, lng: 125.3245, level: 'city' },
  { name: '长春市', lat: 43.8868, lng: 125.3245, level: 'city' },
  { name: '吉林', lat: 43.8378, lng: 126.5494, level: 'city' },
  { name: '吉林市', lat: 43.8378, lng: 126.5494, level: 'city' },

  // ===== 西南 =====
  { name: '昆明', lat: 24.8801, lng: 102.8329, level: 'city' },
  { name: '昆明市', lat: 24.8801, lng: 102.8329, level: 'city' },
  { name: '贵阳', lat: 26.6470, lng: 106.6302, level: 'city' },
  { name: '贵阳市', lat: 26.6470, lng: 106.6302, level: 'city' },
  { name: '遵义', lat: 27.7253, lng: 106.9272, level: 'city' },
  { name: '遵义市', lat: 27.7253, lng: 106.9272, level: 'city' },

  // ===== 江西 =====
  { name: '南昌', lat: 28.6820, lng: 115.8579, level: 'city' },
  { name: '南昌市', lat: 28.6820, lng: 115.8579, level: 'city' },
  { name: '九江', lat: 29.7050, lng: 116.0010, level: 'city' },
  { name: '九江市', lat: 29.7050, lng: 116.0010, level: 'city' },
  { name: '赣州', lat: 25.8311, lng: 114.9335, level: 'city' },
  { name: '赣州市', lat: 25.8311, lng: 114.9335, level: 'city' },

  // ===== 山西 =====
  { name: '太原', lat: 37.8706, lng: 112.5489, level: 'city' },
  { name: '太原市', lat: 37.8706, lng: 112.5489, level: 'city' },
  { name: '大同', lat: 40.0764, lng: 113.3001, level: 'city' },
  { name: '大同市', lat: 40.0764, lng: 113.3001, level: 'city' },
  { name: '运城', lat: 35.0269, lng: 111.0030, level: 'city' },
  { name: '运城市', lat: 35.0269, lng: 111.0030, level: 'city' },

  // ===== 西北 =====
  { name: '兰州', lat: 36.0611, lng: 103.8343, level: 'city' },
  { name: '兰州市', lat: 36.0611, lng: 103.8343, level: 'city' },
  { name: '乌鲁木齐', lat: 43.8256, lng: 87.6168, level: 'city' },
  { name: '乌鲁木齐市', lat: 43.8256, lng: 87.6168, level: 'city' },
  { name: '西宁', lat: 36.6232, lng: 101.7804, level: 'city' },
  { name: '西宁市', lat: 36.6232, lng: 101.7804, level: 'city' },
  { name: '银川', lat: 38.4872, lng: 106.2309, level: 'city' },
  { name: '银川市', lat: 38.4872, lng: 106.2309, level: 'city' },
  { name: '拉萨', lat: 29.6500, lng: 91.1700, level: 'city' },
  { name: '拉萨市', lat: 29.6500, lng: 91.1700, level: 'city' },
  { name: '呼和浩特', lat: 40.8425, lng: 111.7490, level: 'city' },
  { name: '呼和浩特市', lat: 40.8425, lng: 111.7490, level: 'city' },

  // ===== 广西 =====
  { name: '南宁', lat: 22.8170, lng: 108.3665, level: 'city' },
  { name: '南宁市', lat: 22.8170, lng: 108.3665, level: 'city' },
  { name: '桂林', lat: 25.2736, lng: 110.2907, level: 'city' },
  { name: '桂林市', lat: 25.2736, lng: 110.2907, level: 'city' },
  { name: '柳州', lat: 24.3146, lng: 109.4280, level: 'city' },
  { name: '柳州市', lat: 24.3146, lng: 109.4280, level: 'city' },

  // ===== 海南 =====
  { name: '海口', lat: 20.0444, lng: 110.1992, level: 'city' },
  { name: '海口市', lat: 20.0444, lng: 110.1992, level: 'city' },
  { name: '三亚', lat: 18.2528, lng: 109.5119, level: 'city' },
  { name: '三亚市', lat: 18.2528, lng: 109.5119, level: 'city' },
  { name: '儋州', lat: 19.5126, lng: 109.5765, level: 'city' },
  { name: '儋州市', lat: 19.5126, lng: 109.5765, level: 'city' },
];

@Injectable()
export class GeoResolverService implements OnModuleInit {
  private readonly logger = new Logger(GeoResolverService.name);
  private nameToCoord = new Map<string, GeoWord>();
  private cellIndex = new Map<string, string[]>(); // cellKey -> [name, ...]
  private allGeoWords: string[] = [];

  /**
   * grid 单元大小 (度, 近似)
   *  - 纬度方向固定 0.1° (~11km)
   *  - 经度方向按 cos(lat) 自适应: 0.1° / cos(lat*π/180)
   *  - 9 宫格覆盖约 0.3° 直径 (33km), 满足 10km 硬过滤范围
   *  - 漠河 53° 高纬度: lngStep 自动缩小, 不漏选
   */
  private static readonly CELL_LAT = 0.1;
  private static readonly COS_REF = Math.cos((39.9 * Math.PI) / 180); // 北京纬度

  constructor(private readonly dict: DictionaryLoader) {}

  onModuleInit(): void {
    this.rebuild();
  }

  /** 重建索引: 加载 GEO_COORDS, 构建 Map + 网格 */
  rebuild(): void {
    this.nameToCoord = new Map();
    for (const w of GEO_COORDS) {
      this.nameToCoord.set(w.name, w);
    }
    this.cellIndex = new Map();
    for (const w of GEO_COORDS) {
      const key = this.cellKey(w.lat, w.lng);
      const arr = this.cellIndex.get(key);
      if (arr) arr.push(w.name);
      else this.cellIndex.set(key, [w.name]);
    }
    // 同步 entities.json 的 geo.words, 用于"动物坐标缺失 → 全集回退"
    try {
      const ent = this.dict.getEntities();
      this.allGeoWords = ent?.categories?.geo?.words ?? [];
    } catch {
      this.allGeoWords = [];
    }
    this.logger.log(
      `[GeoResolverService] indexed ${this.nameToCoord.size} coords, ${this.cellIndex.size} cells, fallback_words=${this.allGeoWords.length}`,
    );
  }

  /**
   * 核心接口: 给定动物坐标, 返回周围 radiusKm 内的 geo 词白名单
   *
   * @param animalLat 动物已知 lat (可为 null)
   * @param animalLng 动物已知 lng (可为 null)
   * @param radiusKm 半径 (默认 10km)
   * @returns { allowedWords, matched }
   *   - allowedWords: 白名单 Set<string>, clue-bridge.matchEntity 用于过滤 geo 词
   *   - matched: 调试用, 命中的词 + 距离
   *
   * 空集保护: animalLat/animalLng 缺失时 → allowedWords = 全部 geo 词 (回退全集)
   */
  resolve(
    animalLat: number | null | undefined,
    animalLng: number | null | undefined,
    radiusKm: number = 10,
  ): ResolveResult {
    if (animalLat == null || animalLng == null) {
      return {
        allowedWords: new Set(this.allGeoWords),
        matched: [],
      };
    }
    const aLat = Number(animalLat);
    const aLng = Number(animalLng);
    if (!isFinite(aLat) || !isFinite(aLng)) {
      return {
        allowedWords: new Set(this.allGeoWords),
        matched: [],
      };
    }
    // 9 宫格 cell 范围
    const center = this.cellKey(aLat, aLng);
    const [cLatStr, cLngStr] = center.split(',');
    const cLat = Number(cLatStr);
    const cLng = Number(cLngStr);
    const latStep = GeoResolverService.CELL_LAT;
    const lngStep = GeoResolverService.CELL_LAT / Math.max(0.1, Math.cos((aLat * Math.PI) / 180));
    const candidates: string[] = [];
    for (let dLat = -1; dLat <= 1; dLat++) {
      for (let dLng = -1; dLng <= 1; dLng++) {
        // 用 toFixed(2) 对齐 cellIndex 的 key 格式
        const key = (cLat + dLat * latStep).toFixed(2) + ',' + (cLng + dLng * lngStep).toFixed(2);
        const arr = this.cellIndex.get(key);
        if (arr) candidates.push(...arr);
      }
    }
    // Haversine 二次过滤
    const allowed = new Set<string>();
    const matched: Array<{ name: string; level: string; distanceKm: number }> = [];
    for (const name of candidates) {
      const w = this.nameToCoord.get(name);
      if (!w) continue;
      const dist = haversineKm(aLat, aLng, w.lat, w.lng);
      if (dist <= radiusKm) {
        allowed.add(name);
        matched.push({ name, level: w.level, distanceKm: Math.round(dist * 10) / 10 });
      }
    }
    return { allowedWords: allowed, matched };
  }

  private cellKey(lat: number, lng: number): string {
    const cLat = Math.floor(lat / GeoResolverService.CELL_LAT) * GeoResolverService.CELL_LAT;
    const latRad = (Math.abs(cLat) + GeoResolverService.CELL_LAT / 2) * (Math.PI / 180);
    const lngStep = GeoResolverService.CELL_LAT / Math.max(0.1, Math.cos(latRad));
    const cLng = Math.floor(lng / lngStep) * lngStep;
    return cLat.toFixed(2) + ',' + cLng.toFixed(2);
  }
}

/**
 * Haversine 公式: 球面两点距离 (公里)
 * 复制自 clue-bridge.service.ts:156 (避免循环依赖)
 */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
