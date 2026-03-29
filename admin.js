let map;
let markersLayer;
let spiderfyLayer;
let spiderfyLinesLayer;
let activeSpiderfy = null;

const firstName = (value = '') => String(value || '').trim().split(/\s+/)[0] || 'Atleta';
const athleteDisplayName = (profile = {}) => {
  const base = profile.social_name || profile.full_name || profile.username || 'Atleta';
  const first = firstName(base);
  return first.toUpperCase() === 'ATLETA' && profile.username ? firstName(profile.username) : first;
};

function getWeekRange() {
  const today = new Date();
  const day = today.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + diffToMonday);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10)
  };
}

function planIntersectsWeek(plan, weekStart, weekEnd) {
  return Boolean(plan?.start_date && plan?.end_date && plan.start_date <= weekEnd && plan.end_date >= weekStart);
}

function chooseWeeklyPlan(plans, weekStart, weekEnd, today) {
  const candidates = (plans || []).filter(plan => planIntersectsWeek(plan, weekStart, weekEnd));
  if (!candidates.length) return null;
  const active = candidates.find(plan => SkateTrack.isPlanActive(plan, today));
  if (active) return active;
  return candidates.sort((a, b) => String(a.start_date).localeCompare(String(b.start_date)))[0];
}

function getMarkerPosition(checkin, geocode) {
  if (checkin?.latitude && checkin?.longitude) {
    return [Number(checkin.latitude), Number(checkin.longitude)];
  }
  if (geocode?.geocoded_latitude && geocode?.geocoded_longitude) {
    return [Number(geocode.geocoded_latitude), Number(geocode.geocoded_longitude)];
  }
  return null;
}

function coordsKey(position) {
  return `${position[0].toFixed(6)}|${position[1].toFixed(6)}`;
}

function groupByCoordinate(items) {
  const grouped = new Map();
  items.forEach(item => {
    const key = coordsKey(item.position);
    const bucket = grouped.get(key) || [];
    bucket.push(item);
    grouped.set(key, bucket);
  });
  return [...grouped.values()];
}

function buildTooltip(item) {
  return `
    <strong>${SkateTrack.escapeHtml(item.name)}</strong><br>
    ${SkateTrack.formatTime(item.latest.checkin_at)} • ${item.latest.location_type === 'gps' ? 'GPS' : 'Manual'}<br>
    ${SkateTrack.escapeHtml([item.latest.city, item.latest.country].filter(Boolean).join(' / ') || 'Sem local detalhado')}
  `;
}

document.addEventListener('DOMContentLoaded', async () => {
  SkateTrack.attachSidebarToggle();
  const notice = document.getElementById('pageNotice');

  try {
    const sessionData = await SkateTrack.getSessionProfile('admin');
    if (!sessionData) return;
    const { profile } = sessionData;
    SkateTrack.renderShell({ role: 'admin', activePage: 'admin.html', profile });
    SkateTrack.injectTopbarTitle('Mapa Geral', 'Leitura operacional do dia com visão atual por atleta.');
    initMap();
    await loadAdminDashboard(notice);
    document.getElementById('refreshDashboard').addEventListener('click', () => loadAdminDashboard(notice));
  } catch (error) {
    console.error(error);
    SkateTrack.setNotice(notice, error.message || 'Falha ao carregar painel da gestão.', 'error');
  }
});

function initMap() {
  map = L.map('map', { zoomControl: true, worldCopyJump: true }).setView([8, -18], 2);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);
  markersLayer = L.layerGroup().addTo(map);
  spiderfyLayer = L.layerGroup().addTo(map);
  spiderfyLinesLayer = L.layerGroup().addTo(map);

  map.on('click', clearSpiderfy);
  map.on('zoomstart', clearSpiderfy);
}

async function loadAdminDashboard(notice) {
  clearSpiderfy();
  SkateTrack.setNotice(notice, 'Atualizando dados operacionais...', 'muted');
  const dateRange = SkateTrack.todayRange();
  const today = SkateTrack.todayDateString();
  const { startDate: weekStart, endDate: weekEnd } = getWeekRange();

  const [profilesRes, plansRes, checkinsRes, geocodingRes] = await Promise.all([
    window.sb.from('profiles').select('*').eq('role', 'athlete').eq('active', true).order('full_name', { ascending: true }),
    window.sb.from('plans').select('*').order('start_date', { ascending: true }),
    window.sb.from('checkins').select('*').gte('checkin_at', dateRange.start).lt('checkin_at', dateRange.end).order('checkin_at', { ascending: false }),
    window.sb.from('checkin_geocoding').select('*').order('created_at', { ascending: false })
  ]);

  if (profilesRes.error) throw profilesRes.error;
  if (plansRes.error) throw plansRes.error;
  if (checkinsRes.error) throw checkinsRes.error;
  if (geocodingRes.error) throw geocodingRes.error;

  const profiles = profilesRes.data || [];
  const plans = plansRes.data || [];
  const checkins = checkinsRes.data || [];
  const geocodingMap = new Map((geocodingRes.data || []).map(item => [item.checkin_id, item]));
  const planByAthlete = new Map();

  plans.forEach(plan => {
    const bucket = planByAthlete.get(plan.athlete_id) || [];
    bucket.push(plan);
    planByAthlete.set(plan.athlete_id, bucket);
  });

  const latestByAthlete = new Map();
  checkins.forEach(checkin => {
    if (!latestByAthlete.has(checkin.athlete_id)) latestByAthlete.set(checkin.athlete_id, checkin);
  });

  const colorByAthlete = new Map(profiles.map((profile, index) => [profile.id, SkateTrack.getAthleteColor(index)]));
  const activeProfilesOrdered = profiles
    .filter(profile => latestByAthlete.has(profile.id))
    .sort((a, b) => new Date(latestByAthlete.get(b.id).checkin_at) - new Date(latestByAthlete.get(a.id).checkin_at));
  const pendingProfiles = profiles.filter(profile => !latestByAthlete.has(profile.id));

  document.getElementById('metricAthletes').textContent = activeProfilesOrdered.length;
  document.getElementById('metricPending').textContent = pendingProfiles.length;
  document.getElementById('activeAthletesInline').textContent = activeProfilesOrdered.map(athleteDisplayName).join(', ') || '—';
  document.getElementById('pendingAthletesInline').textContent = pendingProfiles.map(athleteDisplayName).join(', ') || '—';

  renderMap({ profiles: activeProfilesOrdered, latestByAthlete, geocodingMap, colorByAthlete });
  renderCheckinsTable({ profiles: activeProfilesOrdered, latestByAthlete });
  renderPlansTable({ profiles, planByAthlete, weekStart, weekEnd, today });
  SkateTrack.setNotice(notice, '', 'muted');
}

function renderMap({ profiles, latestByAthlete, geocodingMap, colorByAthlete }) {
  clearSpiderfy();
  markersLayer.clearLayers();
  const legend = document.getElementById('athleteLegend');
  const legendItems = [];
  const positionedItems = [];
  const bounds = [];

  profiles.forEach(profile => {
    const latest = latestByAthlete.get(profile.id);
    if (!latest) return;
    const geocode = geocodingMap.get(latest.id);
    const position = getMarkerPosition(latest, geocode);
    if (!position) return;

    const color = colorByAthlete.get(profile.id) || '#d4142a';
    const name = athleteDisplayName(profile);

    legendItems.push(`
      <span class="legend-item"><span class="legend-dot" style="background:${color}"></span>${SkateTrack.escapeHtml(name)}</span>
    `);

    positionedItems.push({
      profile,
      latest,
      geocode,
      position,
      color,
      name
    });

    bounds.push(position);
  });

  const grouped = groupByCoordinate(positionedItems);

  grouped.forEach(group => {
    if (group.length === 1) {
      const item = group[0];
      const marker = L.circleMarker(item.position, {
        radius: 9,
        color: item.color,
        fillColor: item.color,
        fillOpacity: 0.92,
        weight: 2,
        className: 'admin-spider-pin'
      });
      marker.bindTooltip(buildTooltip(item));
      marker.addTo(markersLayer);
      return;
    }

    const center = group[0].position;
    const names = group.map(item => item.name).join(', ');
    const clusterMarker = L.marker(center, {
      icon: L.divIcon({
        className: 'admin-spider-cluster',
        html: String(group.length),
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      })
    });

    clusterMarker.bindTooltip(`${group.length} atletas no mesmo ponto: ${SkateTrack.escapeHtml(names)}`);
    clusterMarker.on('click', event => {
      L.DomEvent.stopPropagation(event);
      toggleSpiderfy(center, group, clusterMarker);
    });
    clusterMarker.addTo(markersLayer);
  });

  legend.innerHTML = legendItems.length ? legendItems.join('') : '<span class="legend-item">Sem marcadores no mapa hoje.</span>';
  if (bounds.length) {
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 5 });
  } else {
    map.setView([8, -18], 2);
  }
}

function toggleSpiderfy(center, items, clusterMarker) {
  if (activeSpiderfy && activeSpiderfy.clusterMarker === clusterMarker) {
    clearSpiderfy();
    return;
  }

  clearSpiderfy();
  activeSpiderfy = { clusterMarker, center, items };
  clusterMarker.setOpacity(0.2);

  const centerPoint = map.latLngToLayerPoint(center);
  const positions = generateSpiderfyPoints(items.length, centerPoint);

  items.forEach((item, index) => {
    const targetLatLng = map.layerPointToLatLng(positions[index]);

    const leg = L.polyline([center, targetLatLng], {
      color: item.color,
      weight: 1.5,
      opacity: 0.75
    });
    leg.addTo(spiderfyLinesLayer);

    const marker = L.circleMarker(targetLatLng, {
      radius: 9,
      color: item.color,
      fillColor: item.color,
      fillOpacity: 0.96,
      weight: 2,
      className: 'admin-spider-pin'
    });
    marker.bindTooltip(buildTooltip(item));
    marker.addTo(spiderfyLayer);

    marker.on('click', event => {
      L.DomEvent.stopPropagation(event);
      marker.openTooltip();
    });
  });
}

function clearSpiderfy() {
  if (activeSpiderfy?.clusterMarker) {
    activeSpiderfy.clusterMarker.setOpacity(1);
  }
  spiderfyLayer?.clearLayers();
  spiderfyLinesLayer?.clearLayers();
  activeSpiderfy = null;
}

function generateSpiderfyPoints(count, centerPoint) {
  const points = [];
  const circleCountThreshold = 8;

  if (count < circleCountThreshold) {
    const circumference = 28 * (2 + count);
    const legLength = circumference / (Math.PI * 2);
    const angleStep = (Math.PI * 2) / count;
    const startAngle = Math.PI / 6;

    for (let i = 0; i < count; i += 1) {
      const angle = startAngle + (i * angleStep);
      points.push(L.point(
        centerPoint.x + legLength * Math.cos(angle),
        centerPoint.y + legLength * Math.sin(angle)
      ));
    }
    return points;
  }

  let legLength = 11;
  let angle = 0;
  for (let i = 0; i < count; i += 1) {
    angle += 28 / legLength + i * 0.0005;
    points.push(L.point(
      centerPoint.x + legLength * Math.cos(angle),
      centerPoint.y + legLength * Math.sin(angle)
    ));
    legLength += (Math.PI * 2) * 5 / angle;
  }
  return points;
}

function renderCheckinsTable({ profiles, latestByAthlete }) {
  const tbody = document.getElementById('checkinsTableBody');
  const rows = profiles
    .map(profile => ({ profile, latest: latestByAthlete.get(profile.id) }))
    .filter(item => item.latest)
    .sort((a, b) => new Date(b.latest.checkin_at) - new Date(a.latest.checkin_at));

  tbody.innerHTML = rows.length ? rows.map(({ profile, latest }) => `
    <tr>
      <td>${SkateTrack.escapeHtml(athleteDisplayName(profile))}</td>
      <td>${SkateTrack.formatTime(latest.checkin_at)}</td>
      <td>${latest.location_type === 'gps' ? 'GPS' : 'Manual'}</td>
      <td>${SkateTrack.escapeHtml(latest.country || '—')}</td>
      <td>${SkateTrack.escapeHtml(latest.city || '—')}</td>
      <td>${SkateTrack.escapeHtml(latest.location_name || '—')}</td>
      <td>${SkateTrack.escapeHtml(latest.observation || '—')}</td>
    </tr>
  `).join('') : '<tr><td colspan="7">Nenhum check-in registrado hoje.</td></tr>';
}

function renderPlansTable({ profiles, planByAthlete, weekStart, weekEnd, today }) {
  const tbody = document.getElementById('plansTableBody');
  const rows = profiles
    .map(profile => ({ profile, plan: chooseWeeklyPlan(planByAthlete.get(profile.id), weekStart, weekEnd, today) }))
    .filter(item => item.plan)
    .sort((a, b) => String(a.plan.start_date).localeCompare(String(b.plan.start_date)));

  tbody.innerHTML = rows.length ? rows.map(({ profile, plan }) => `
    <tr>
      <td>${SkateTrack.escapeHtml(athleteDisplayName(profile))}</td>
      <td>${SkateTrack.formatDateOnly(plan.start_date)} até ${SkateTrack.formatDateOnly(plan.end_date)}</td>
      <td>${SkateTrack.escapeHtml([plan.origin_city, plan.origin_state, plan.origin_country].filter(Boolean).join(' / ') || '—')}</td>
      <td>${SkateTrack.escapeHtml([plan.destination_city, plan.destination_state, plan.destination_country].filter(Boolean).join(' / ') || '—')}</td>
      <td>${SkateTrack.escapeHtml(plan.travel_reason || '—')}</td>
      <td>${SkateTrack.escapeHtml(plan.notes || '—')}</td>
    </tr>
  `).join('') : '<tr><td colspan="6">Nenhum plano vigente na semana.</td></tr>';
}
