/**
 * 天气预报 · 最简版
 * 数据来源：Open-Meteo（免费公开接口，不需要 API 密钥）
 *  - 城市搜索（地理编码）：https://geocoding-api.open-meteo.com/v1/search
 *  - 天气数据（预报）：    https://api.open-meteo.com/v1/forecast
 *
 * 因为是纯前端项目，所有请求都在浏览器里发出。
 * 以后如果换成需要密钥的接口（比如和风天气），密钥千万不要写在这个文件里，
 * 那个位置任何人按 F12 都能看到。
 */

// ============ 1. 天气代码对照表 ============
// Open-Meteo 用 WMO 国际标准代码表示天气，这里翻译成中文 + emoji
const WEATHER_CODES = {
  0:  { text: '晴',           icon: '☀️' },
  1:  { text: '大部晴朗',      icon: '🌤️' },
  2:  { text: '多云',         icon: '⛅' },
  3:  { text: '阴',           icon: '☁️' },
  45: { text: '雾',           icon: '🌫️' },
  48: { text: '雾凇',         icon: '🌫️' },
  51: { text: '小毛毛雨',      icon: '🌦️' },
  53: { text: '毛毛雨',        icon: '🌦️' },
  55: { text: '大毛毛雨',      icon: '🌦️' },
  56: { text: '冻毛毛雨',      icon: '🌧️' },
  57: { text: '强冻毛毛雨',    icon: '🌧️' },
  61: { text: '小雨',         icon: '🌦️' },
  63: { text: '中雨',         icon: '🌧️' },
  65: { text: '大雨',         icon: '🌧️' },
  66: { text: '冻雨',         icon: '🌧️' },
  67: { text: '强冻雨',       icon: '🌧️' },
  71: { text: '小雪',         icon: '🌨️' },
  73: { text: '中雪',         icon: '🌨️' },
  75: { text: '大雪',         icon: '❄️' },
  77: { text: '雪粒',         icon: '🌨️' },
  80: { text: '小阵雨',       icon: '🌦️' },
  81: { text: '阵雨',         icon: '🌧️' },
  82: { text: '强阵雨',       icon: '⛈️' },
  85: { text: '小阵雪',       icon: '🌨️' },
  86: { text: '大阵雪',       icon: '❄️' },
  95: { text: '雷阵雨',       icon: '⛈️' },
  96: { text: '雷阵雨伴冰雹',  icon: '⛈️' },
  99: { text: '雷阵雨伴大冰雹', icon: '⛈️' },
};

function describe(code) {
  return WEATHER_CODES[code] || { text: '未知', icon: '❓' };
}

// ============ 2. 抓取页面元素 ============
const el = {
  form: document.getElementById('search-form'),
  input: document.getElementById('city-input'),
  candidates: document.getElementById('candidates'),
  status: document.getElementById('status'),
  current: document.getElementById('current'),
  currentCity: document.getElementById('current-city'),
  currentIcon: document.getElementById('current-icon'),
  currentTemp: document.getElementById('current-temp'),
  currentDesc: document.getElementById('current-desc'),
  currentFeels: document.getElementById('current-feels'),
  currentHumidity: document.getElementById('current-humidity'),
  currentWind: document.getElementById('current-wind'),
  forecast: document.getElementById('forecast'),
  forecastList: document.getElementById('forecast-list'),
};

// ============ 3. 小工具函数 ============
function showStatus(message, isError = false) {
  el.status.textContent = message;
  el.status.className = isError ? 'status status--error' : 'status';
  el.status.hidden = false;
}

function hideStatus() {
  el.status.hidden = true;
}

/** 把 "2026-09-17" 转成 "今天 / 明天 / 周四" */
function formatDayName(dateStr, index) {
  if (index === 0) return '今天';
  if (index === 1) return '明天';
  const names = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return names[new Date(dateStr + 'T00:00:00').getDay()];
}

// ============ 4. 第一步：把城市名换成经纬度 ============
async function searchCity(name) {
  const url =
    'https://geocoding-api.open-meteo.com/v1/search' +
    `?name=${encodeURIComponent(name)}&count=5&language=zh&format=json`;

  const res = await fetch(url);
  if (!res.ok) throw new Error('城市搜索接口返回异常（' + res.status + '）');
  const data = await res.json();
  return data.results || [];
}

/** 把候选城市渲染成一排小按钮 */
function renderCandidates(list) {
  el.candidates.innerHTML = '';

  list.forEach((place) => {
    const li = document.createElement('li');
    li.className = 'candidates__item';
    li.textContent = [place.name, place.admin1, place.country].filter(Boolean).join(' · ');
    li.addEventListener('click', () => {
      el.candidates.hidden = true;
      // 点选后加载这家城市的天气，出错照样给提示
      loadWeather(place).catch((err) => showStatus('出错了：' + err.message, true));
    });
    el.candidates.appendChild(li);
  });

  el.candidates.hidden = false;
}

// ============ 5. 第二步：拿天气数据并渲染 ============
async function loadWeather(place) {
  showStatus('正在获取天气数据…');

  const url =
    'https://api.open-meteo.com/v1/forecast' +
    `?latitude=${place.latitude}&longitude=${place.longitude}` +
    '&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m' +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min' +
    '&timezone=auto&forecast_days=7';

  const res = await fetch(url);
  if (!res.ok) throw new Error('天气接口返回异常（' + res.status + '）');
  const data = await res.json();

  renderCurrent(place, data.current);
  renderForecast(data.daily);

  hideStatus();
}

function renderCurrent(place, current) {
  const info = describe(current.weather_code);

  el.currentCity.textContent = [place.name, place.admin1, place.country]
    .filter(Boolean)
    .join(' · ');
  el.currentIcon.textContent = info.icon;
  el.currentTemp.textContent = Math.round(current.temperature_2m) + '°';
  el.currentDesc.textContent = info.text;
  el.currentFeels.textContent = Math.round(current.apparent_temperature) + '°';
  el.currentHumidity.textContent = current.relative_humidity_2m + '%';
  el.currentWind.textContent = Math.round(current.wind_speed_10m) + ' km/h';

  el.current.hidden = false;
}

function renderForecast(daily) {
  el.forecastList.innerHTML = '';

  daily.time.forEach((date, i) => {
    const info = describe(daily.weather_code[i]);
    const li = document.createElement('li');
    li.className = 'day';
    li.innerHTML = `
      <span class="day__name">${formatDayName(date, i)}</span>
      <span class="day__icon">${info.icon}</span>
      <span class="day__desc">${info.text}</span>
      <span class="day__temp">${Math.round(daily.temperature_2m_max[i])}°
        <span>/ ${Math.round(daily.temperature_2m_min[i])}°</span>
      </span>
    `;
    el.forecastList.appendChild(li);
  });

  el.forecast.hidden = false;
}

// ============ 6. 串起来：搜索动作 ============
async function doSearch(cityName) {
  const name = cityName.trim();
  if (!name) {
    showStatus('请先输入城市名', true);
    return;
  }

  el.candidates.hidden = true;
  el.current.hidden = true;
  el.forecast.hidden = true;
  showStatus('正在搜索城市…');

  try {
    const list = await searchCity(name);

    if (list.length === 0) {
      showStatus(`没找到「${name}」，换个写法试试（比如用"杭州"而不是"浙江杭州"）`, true);
      return;
    }

    // 只有一个结果就直接加载，多个结果让用户点选
    if (list.length === 1) {
      el.candidates.hidden = true;
      await loadWeather(list[0]);
    } else {
      renderCandidates(list);
      showStatus(`找到 ${list.length} 个结果，请点选一个`);
    }
  } catch (err) {
    showStatus('出错了：' + err.message + '（检查一下网络，或者过一会儿再试）', true);
  }
}

// ============ 7. 绑定事件 + 打开页面自动查一次 ============
el.form.addEventListener('submit', (event) => {
  event.preventDefault(); // 阻止表单默认的"刷新页面"行为
  doSearch(el.input.value);
});

doSearch('北京');
