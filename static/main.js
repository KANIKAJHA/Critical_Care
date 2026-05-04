/* ── State ──────────────────────────────────────────────────────────── */
let patients    = {};
let selectedBed = null;
let activeFilter = 'all';

/* ── Normal Ranges ─────────────────────────────────────────────────── */
const RANGES = {
  heart_rate:        { min: 60,  max: 100, icon: '❤️',  label: 'Heart Rate',    unit: 'bpm'  },
  respiratory_rate:  { min: 12,  max: 20,  icon: '🫁',  label: 'Resp. Rate',    unit: '/min' },
  body_temperature:  { min: 36.1,max: 37.2,icon: '🌡️', label: 'Body Temp',     unit: '°C'   },
  oxygen_saturation: { min: 95,  max: 100, icon: '💧',  label: 'O₂ Saturation', unit: '%'    },
  systolic_bp:       { min: 90,  max: 120, icon: '🔺',  label: 'Systolic BP',   unit: 'mmHg' },
  diastolic_bp:      { min: 60,  max: 80,  icon: '🔻',  label: 'Diastolic BP',  unit: 'mmHg' },
  age:               { min: 0,   max: 120, icon: '👤',  label: 'Age',           unit: 'yrs'  },
  gender:            { min: 0,   max: 1,   icon: '⚧',   label: 'Gender',        unit: ''     },
  weight_kg:         { min: 30,  max: 150, icon: '⚖️',  label: 'Weight',        unit: 'kg'   },
  height_m:          { min: 1.2, max: 2.2, icon: '📏',  label: 'Height',        unit: 'm'    },
};

/* ── Boot ───────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  tickClock();
  setInterval(tickClock, 1000);
  loadAll();
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeDetail(); closeModal(); }
  });
});

/* ── Clock ──────────────────────────────────────────────────────────── */
function tickClock() {
  const now  = new Date();
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const mons = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  document.getElementById('date-full').textContent =
    `${days[now.getDay()]}, ${now.getDate()} ${mons[now.getMonth()]} ${now.getFullYear()}`;
  document.getElementById('date-time').textContent =
    `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
}

/* ── API helper ────────────────────────────────────────────────────── */
async function api(url, method = 'GET', body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(url, opts);
  return r.json();
}

/* ── Load all patients ─────────────────────────────────────────────── */
async function loadAll() {
  const data = await api('/api/patients');
  patients = {};
  data.forEach(p => patients[p.bed] = p);
  renderGrid();
  updateCounts();
  loadStats();
  if (selectedBed && patients[selectedBed]) renderDetail(patients[selectedBed]);
}

/* ── Count-up animation ────────────────────────────────────────────── */
function animateCount(el, target) {
  const duration = 600;
  const start = parseInt(el.textContent) || 0;
  const diff = target - start;
  if (diff === 0) return;
  const startTime = performance.now();
  function step(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(start + diff * eased);
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

/* ── Update summary counts ─────────────────────────────────────────── */
function updateCounts() {
  const vals = Object.values(patients);
  animateCount(document.getElementById('s-total'), vals.length);
  animateCount(document.getElementById('s-stable'), vals.filter(p => p.label === 'Stable').length);
  animateCount(document.getElementById('s-moderate'), vals.filter(p => p.label === 'Moderate').length);
  animateCount(document.getElementById('s-critical'), vals.filter(p => p.label === 'Critical').length);
}

/* ── Mini gauge SVG ────────────────────────────────────────────────── */
function miniGaugeSVG(score, color) {
  const r = 14, circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const c = color === 'green' ? '#22c55e' : color === 'yellow' ? '#f59e0b' : '#ef4444';
  return `<svg width="36" height="36" viewBox="0 0 36 36">
    <circle cx="18" cy="18" r="${r}" fill="none" stroke="rgba(255,255,255,.06)" stroke-width="3"/>
    <circle cx="18" cy="18" r="${r}" fill="none" stroke="${c}" stroke-width="3"
      stroke-dasharray="${circ}" stroke-dashoffset="${offset}" stroke-linecap="round"
      style="transform:rotate(-90deg);transform-origin:center;transition:stroke-dashoffset .6s ease"/>
  </svg>`;
}

/* ── Render bed grid ───────────────────────────────────────────────── */
function renderGrid() {
  const grid = document.getElementById('bed-grid');
  grid.innerHTML = '';
  Object.values(patients).sort((a, b) => a.bed - b.bed).forEach((p, i) => {
    const initials = p.name.split(' ').map(n => n[0]).join('');
    const v = p.vitals;
    const card = document.createElement('div');
    card.className = `bed-card ${p.color}${selectedBed === p.bed ? ' selected' : ''}`;
    card.dataset.bed = p.bed;
    card.dataset.name = p.name.toLowerCase();
    card.dataset.color = p.color;
    card.style.animationDelay = `${i * 0.03}s`;
    card.innerHTML = `
      <div class="bed-card-top">
        <div class="bed-avatar">${initials}</div>
        <div class="mini-gauge">${miniGaugeSVG(p.score, p.color)}<div class="mini-gauge-text">${p.score}</div></div>
      </div>
      <div class="bed-num">Bed ${p.bed}</div>
      <div class="bed-name">${p.name}</div>
      <div class="bed-status"><span class="pulse-dot"></span>${p.label}</div>
      <div class="bed-vitals-peek">
        <div class="peek-item">HR <span>${v.heart_rate}</span></div>
        <div class="peek-item">SpO₂ <span>${v.oxygen_saturation}%</span></div>
        <div class="peek-item">BP <span>${v.systolic_bp}/${v.diastolic_bp}</span></div>
      </div>`;
    card.addEventListener('click', () => selectBed(p.bed));
    grid.appendChild(card);
  });
  applyFilters();
}

/* ── Filters ───────────────────────────────────────────────────────── */
function setFilter(filter, btn) {
  activeFilter = filter;
  document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  applyFilters();
}

function applyFilters() {
  const q = (document.getElementById('search-input').value || '').toLowerCase();
  document.querySelectorAll('.bed-card').forEach(card => {
    const matchColor = activeFilter === 'all' || card.dataset.color === activeFilter;
    const matchSearch = !q || card.dataset.name.includes(q) || `bed ${card.dataset.bed}`.includes(q);
    card.classList.toggle('hidden', !(matchColor && matchSearch));
  });
}

/* ── Select bed ────────────────────────────────────────────────────── */
function selectBed(bed) {
  selectedBed = bed;
  document.querySelectorAll('.bed-card').forEach(c =>
    c.classList.toggle('selected', +c.dataset.bed === bed));
  renderDetail(patients[bed]);
}

/* ── Render detail panel ───────────────────────────────────────────── */
function renderDetail(p) {
  document.getElementById('detail-overlay').classList.add('open');
  document.getElementById('d-name').textContent = p.name;
  document.getElementById('d-bed-tag').textContent = `Bed ${p.bed}`;

  const pill = document.getElementById('d-pill');
  pill.textContent = p.label;
  pill.className = `status-pill ${p.color}`;

  document.getElementById('d-score').textContent = p.score;

  // Arc gauge
  const circ = 2 * Math.PI * 50;
  const offset = circ - (p.score / 100) * circ;
  const arc = document.getElementById('gauge-arc');
  arc.style.strokeDashoffset = offset;
  arc.style.stroke = scoreColor(p.score);

  // Bar
  const bar = document.getElementById('d-bar');
  bar.style.width = `${p.score}%`;
  bar.style.background = `linear-gradient(90deg, #ef4444, #f59e0b, #22c55e)`;

  renderPatientVisuals(p);

  // Vitals
  const v = p.vitals;
  const vitalKeys = ['heart_rate','respiratory_rate','body_temperature','oxygen_saturation',
                     'systolic_bp','diastolic_bp','age','gender','weight_kg','height_m'];
  document.getElementById('d-vitals').innerHTML = vitalKeys.map(key => {
    const r = RANGES[key];
    let val = v[key];
    let displayVal = key === 'gender' ? (val === 1 ? 'Female' : 'Male') : val;
    let status = '';
    if (key !== 'gender' && key !== 'age' && key !== 'weight_kg' && key !== 'height_m') {
      if (val < r.min || val > r.max) status = val < r.min * 0.85 || val > r.max * 1.15 ? 'danger' : 'warn';
    }
    return vitalCard(r.icon, r.label, displayVal, r.unit, status, val, r.min, r.max, key);
  }).join('');

  // Derived
  const hrv = (1 / v.heart_rate).toFixed(4);
  const pp = v.systolic_bp - v.diastolic_bp;
  const bmi = (v.weight_kg / (v.height_m ** 2)).toFixed(1);
  const map_ = ((v.systolic_bp + 2 * v.diastolic_bp) / 3).toFixed(1);
  document.getElementById('d-derived').innerHTML = [
    vitalCard('📊','HRV', hrv, '', '', 0, 0, 1, 'derived'),
    vitalCard('💓','Pulse Pressure', pp, 'mmHg', '', 0, 0, 1, 'derived'),
    vitalCard('📐','BMI', bmi, 'kg/m²', '', 0, 0, 1, 'derived'),
    vitalCard('🩺','MAP', map_, 'mmHg', '', 0, 0, 1, 'derived'),
  ].join('');
}

function renderVitalGauge(svgId, value, color, min, max, normalMin, normalMax, unit) {
  const svg = document.getElementById(svgId);
  const width = 360;
  const height = 150;
  const gradientId = `${svgId}-gradient`;
  const glowId = `${svgId}-glow`;
  const x1 = 34;
  const x2 = 326;
  const y = 82;
  const clamp = Math.max(min, Math.min(max, value));
  const pct = (clamp - min) / (max - min);
  const markerX = x1 + pct * (x2 - x1);
  const normalStart = x1 + ((normalMin - min) / (max - min)) * (x2 - x1);
  const normalEnd = x1 + ((normalMax - min) / (max - min)) * (x2 - x1);
  const display = Number.isInteger(value) ? value : value.toFixed(1);

  svg.innerHTML = `
    <defs>
      <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#ef4444"/>
        <stop offset="50%" stop-color="#f59e0b"/>
        <stop offset="100%" stop-color="#22c55e"/>
      </linearGradient>
      <filter id="${glowId}" x="-40%" y="-80%" width="180%" height="260%">
        <feGaussianBlur stdDeviation="4" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
    <rect x="16" y="18" width="328" height="112" rx="14" fill="rgba(255,255,255,.025)" stroke="rgba(255,255,255,.05)"></rect>
    <line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" class="chart-track"></line>
    <line x1="${x1}" y1="${y}" x2="${markerX}" y2="${y}" stroke="url(#${gradientId})" stroke-width="12" stroke-linecap="round" filter="url(#${glowId})"></line>
    <line x1="${normalStart}" y1="${y + 19}" x2="${normalEnd}" y2="${y + 19}" class="chart-normal"></line>
    <circle cx="${markerX}" cy="${y}" r="13" fill="rgba(255,255,255,.14)"></circle>
    <circle cx="${markerX}" cy="${y}" r="8" fill="${color}" filter="url(#${glowId})"></circle>
    <text x="${markerX}" y="48" text-anchor="middle" class="chart-value">${display}${unit}</text>
    <text x="${(normalStart + normalEnd) / 2}" y="${y + 42}" text-anchor="middle" class="chart-zone-label">normal range</text>
    <text x="${x1}" y="122" text-anchor="middle" class="chart-label">${min}</text>
    <text x="${x2}" y="122" text-anchor="middle" class="chart-label">${max}</text>
  `;
}

function renderHeartRateGauge(p) {
  const svg = document.getElementById('ecg-chart');
  svg.setAttribute('viewBox', '0 0 360 150');
  renderVitalGauge('ecg-chart', Number(p.vitals.heart_rate), scoreColor(p.score), 40, 160, 60, 100, '');
}

function renderPatientVisuals(p) {
  const v = p.vitals;

  document.getElementById('resp-current').textContent = `${v.respiratory_rate}/min`;
  document.getElementById('score-current').textContent = `${p.score}/100`;
  document.getElementById('ecg-current').textContent = `${v.heart_rate} bpm`;
  document.getElementById('spo2-current').textContent = `${v.oxygen_saturation}%`;
  document.getElementById('bp-current').textContent = `${v.systolic_bp}/${v.diastolic_bp}`;
  document.getElementById('temp-current').textContent = `${v.body_temperature} C`;

  renderVitalGauge('resp-chart', Number(v.respiratory_rate), '#24c6dc', 6, 36, 12, 20, '');
  renderVitalGauge('score-chart', Number(p.score), scoreColor(p.score), 0, 100, 80, 100, '');
  renderHeartRateGauge(p);
  renderVitalGauge('spo2-chart', Number(v.oxygen_saturation), '#22c55e', 70, 100, 95, 100, '%');
  renderVitalGauge('bp-chart', Number(v.systolic_bp), '#f59e0b', 70, 190, 90, 120, '');
  renderVitalGauge('temp-chart', Number(v.body_temperature), '#ef4444', 34, 42, 36.1, 37.2, 'C');
}

function vitalCard(icon, label, value, unit, status, rawVal, min, max, key) {
  let rangeHTML = '';
  if (key !== 'gender' && key !== 'age' && key !== 'weight_kg' && key !== 'height_m' && key !== 'derived') {
    const range = max - min;
    const extended_min = min - range * 0.5;
    const extended_max = max + range * 0.5;
    const pos = Math.max(0, Math.min(100, ((rawVal - extended_min) / (extended_max - extended_min)) * 100));
    const normalStart = ((min - extended_min) / (extended_max - extended_min)) * 100;
    const normalEnd = ((max - extended_min) / (extended_max - extended_min)) * 100;
    const dotColor = status === 'danger' ? '#ef4444' : status === 'warn' ? '#f59e0b' : '#22c55e';
    rangeHTML = `<div class="vital-range-bar">
      <div class="vital-range-fill" style="left:${normalStart}%;width:${normalEnd-normalStart}%;background:rgba(34,197,94,.2);border-radius:2px"></div>
      <div class="vital-range-dot" style="left:calc(${pos}% - 3.5px);background:${dotColor}"></div>
    </div>`;
  }
  return `<div class="vital-card ${status}">
    <div class="vital-card-header"><span class="vital-label">${label}</span><span class="vital-icon">${icon}</span></div>
    <div class="vital-value">${value}</div>
    <div class="vital-unit">${unit}</div>
    ${rangeHTML}
  </div>`;
}

function scoreColor(s) { return s >= 80 ? '#22c55e' : s >= 50 ? '#f59e0b' : '#ef4444'; }

/* ── Close detail ──────────────────────────────────────────────────── */
function closeDetail() {
  document.getElementById('detail-overlay').classList.remove('open');
  selectedBed = null;
  document.querySelectorAll('.bed-card').forEach(c => c.classList.remove('selected'));
}

/* ── Modal ──────────────────────────────────────────────────────────── */
function openModal() { document.getElementById('modal-overlay').classList.add('open'); }
function closeModal() { document.getElementById('modal-overlay').classList.remove('open'); }

function openEditFromDetail() {
  if (!selectedBed) return;
  closeDetail();
  openModal();
  document.getElementById('f-bed').value = selectedBed;
  loadVitals();
}

/* ── Load vitals into form ─────────────────────────────────────────── */
function loadVitals() {
  const bed = parseInt(document.getElementById('f-bed').value);
  if (!bed || !patients[bed]) { showToast('err', `Bed ${bed} not found.`); return; }
  const v = patients[bed].vitals;
  document.getElementById('f-hr').value     = v.heart_rate;
  document.getElementById('f-rr').value     = v.respiratory_rate;
  document.getElementById('f-temp').value   = v.body_temperature;
  document.getElementById('f-spo2').value   = v.oxygen_saturation;
  document.getElementById('f-sbp').value    = v.systolic_bp;
  document.getElementById('f-dbp').value    = v.diastolic_bp;
  document.getElementById('f-age').value    = v.age;
  document.getElementById('f-gender').value = v.gender;
  document.getElementById('f-weight').value = v.weight_kg;
  document.getElementById('f-height').value = v.height_m;
}

/* ── Submit vitals ─────────────────────────────────────────────────── */
async function submitVitals() {
  const bed = parseInt(document.getElementById('f-bed').value);
  if (!bed) { showToast('err', 'Enter a bed number first.'); return; }

  const fields = {
    heart_rate:'f-hr', respiratory_rate:'f-rr', body_temperature:'f-temp',
    oxygen_saturation:'f-spo2', systolic_bp:'f-sbp', diastolic_bp:'f-dbp',
    age:'f-age', gender:'f-gender', weight_kg:'f-weight', height_m:'f-height'
  };
  const payload = { bed };
  for (const [key, id] of Object.entries(fields)) {
    const val = parseFloat(document.getElementById(id).value);
    if (isNaN(val)) { showToast('err', `Missing: ${key.replace(/_/g,' ')}`); return; }
    payload[key] = val;
  }

  const btn = document.getElementById('btn-predict');
  btn.disabled = true; btn.textContent = 'Running model…';

  const result = await api('/api/predict', 'POST', payload);

  btn.disabled = false;
  btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z"/></svg> Run Model & Update`;

  if (result.error) { showToast('err', result.error); return; }

  patients[bed] = result;
  renderGrid(); updateCounts();
  closeModal();

  const icon = result.label === 'Stable' ? '🟢' : result.label === 'Moderate' ? '🟡' : '🔴';
  showToast('ok', `${icon} Bed ${bed} · ${result.name} → ${result.label} (Score: ${result.score})`);
}



/* ── Toast system ──────────────────────────────────────────────────── */
function showToast(type, msg) {
  const container = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  container.appendChild(t);
  setTimeout(() => { t.remove(); }, 4000);
}

/* ── Analytics ──────────────────────────────────────────────────────── */
async function loadStats() {
  const s = await api('/api/stats');
  renderDonut(s.stable, s.moderate, s.critical, s.total);
  renderAverages(s);
  renderBarChart(s.score_distribution);
}

function renderDonut(stable, moderate, critical, total) {
  document.getElementById('donut-total').textContent = total;
  const svg = document.getElementById('donut-chart');
  const cx = 85, cy = 85, r = 60, circ = 2 * Math.PI * r;
  const segments = [
    { count: stable,   color: '#22c55e', label: 'Stable' },
    { count: moderate, color: '#f59e0b', label: 'Moderate' },
    { count: critical, color: '#ef4444', label: 'Critical' },
  ];
  let offset = 0;
  svg.innerHTML = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(255,255,255,.04)" stroke-width="18"/>`;
  segments.forEach(seg => {
    const pct = total ? seg.count / total : 0;
    const dash = pct * circ;
    svg.innerHTML += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${seg.color}"
      stroke-width="18" stroke-dasharray="${dash} ${circ - dash}"
      stroke-dashoffset="${-offset}" style="transform:rotate(-90deg);transform-origin:center;
      transition:stroke-dasharray .6s ease,stroke-dashoffset .6s ease;filter:drop-shadow(0 0 4px ${seg.color}40)"/>`;
    offset += dash;
  });
  const legend = document.getElementById('donut-legend');
  legend.innerHTML = segments.map(seg =>
    `<div class="legend-item"><span class="legend-dot" style="background:${seg.color};box-shadow:0 0 6px ${seg.color}40"></span>${seg.label}<span class="legend-count">${seg.count}</span></div>`
  ).join('');
}

function renderAverages(s) {
  document.getElementById('avg-grid').innerHTML = [
    { icon: '💯', value: s.avg_score, label: 'Avg Score' },
    { icon: '❤️', value: s.avg_hr, label: 'Avg Heart Rate' },
    { icon: '💧', value: s.avg_spo2 + '%', label: 'Avg SpO₂' },
    { icon: '🌡️', value: s.avg_temp + '°', label: 'Avg Temp' },
    { icon: '🔺', value: s.avg_sbp, label: 'Avg Systolic BP' },
    { icon: '🏥', value: s.total, label: 'Total Beds' },
  ].map(a => `<div class="avg-item">
    <div class="avg-icon">${a.icon}</div>
    <div class="avg-value">${a.value}</div>
    <div class="avg-label">${a.label}</div>
  </div>`).join('');
}

function renderBarChart(scores) {
  const maxScore = 100;
  document.getElementById('bar-chart').innerHTML = scores.map((score, i) => {
    const h = Math.max(4, (score / maxScore) * 110);
    const color = score >= 80 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444';
    return `<div class="bar-col">
      <div class="bar-fill" style="height:${h}px;background:${color}" data-tooltip="Bed ${i+1}: ${score}"></div>
      <div class="bar-label">${i+1}</div>
    </div>`;
  }).join('');
}
