let map;
let markersLayer;

const firstName = (value = '') => String(value || '').trim().split(/\s+/)[0] || 'Atleta';
const athleteDisplayName = (profile = {}) => firstName(profile.social_name || profile.full_name || profile.username || 'Atleta');

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

function markerKey(position) {
  return `${Number(position[0]).toFixed(6)},${Number(position[1]).toFixed(6)}`;
}

function createAthleteIcon(color) {
  return L.divIcon({
    className: '',
    html: `<div class="athlete-marker" style="background:${color};"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -12]
  });
}

function getPrecisionLabel(checkin, geocode) {
  if (checkin?.location_type === 'gps' && checkin?.latitude && checkin?.longitude) return 'GPS';
  const level = geocode?.precision_level || 'not_found';
  if (level === 'city') return 'Cidade';
  if (level === 'state') return 'Estado';
  if (level === 'country') return 'País';
  return 'Sem coordenada';
}

function createClusterIcon(cluster) {
  const count = cluster.getChildCount();
  const sizeClass = count < 10 ? 'small' : count < 100 ? 'medium' : 'large';
  return L.divIcon({
    html: `<div class="custom-cluster ${sizeClass}">${count}</div>`,
    className: '',
    iconSize: count < 10 ? [34, 34] : count < 100 ? [40, 40] : [46, 46],
    iconAnchor: count < 10 ? [17, 17] : count < 100 ? [20, 20] : [23, 23]
  });
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

  markersLayer = L.markerClusterGroup({
    showCoverageOnHover: false,
    spiderfyOnMaxZoom: true,
    zoomToBoundsOnClick: true,
    spiderLegPolylineOptions: {
      weight: 1.5,
      color: '#6b7280',
      opacity: 0.75
    },
    maxClusterRadius: 36,
    iconCreateFunction: createClusterIcon
  });

  map.addLayer(markersLayer);
}

async function loadAdminDashboard(notice) {
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
  document.getElementById('activeAthletesInline').textContent =
    activeProfilesOrdered.map(athleteDisplayName).join(', ') || '—';
  document.getElementById('pendingAthletesInline').textContent =
    pendingProfiles.map(athleteDisplayName).join(', ') || '—';

  const nonPlottedProfiles = activeProfilesOrdered.filter(profile => {
    const latest = latestByAthlete.get(profile.id);
    const geocode = geocodingMap.get(latest?.id);
    return !getMarkerPosition(latest, geocode);
  });
  const nonPlottedEl = document.getElementById('nonPlottedInline');
  if (nonPlottedEl) {
    nonPlottedEl.textContent = nonPlottedProfiles.map(athleteDisplayName).join(', ') || '—';
  }

  renderMap({ profiles: activeProfilesOrdered, latestByAthlete, geocodingMap, colorByAthlete });
  renderCheckinsTable({ profiles: activeProfilesOrdered, latestByAthlete, geocodingMap });
  renderPlansTable({ profiles, planByAthlete, weekStart, weekEnd, today });
  SkateTrack.setNotice(notice, '', 'muted');
}

function renderMap({ profiles, latestByAthlete, geocodingMap, colorByAthlete }) {
  markersLayer.clearLayers();
  const bounds = [];
  const legend = document.getElementById('athleteLegend');
  const legendItems = [];
  const seenLegend = new Set();

  profiles.forEach(profile => {
    const latest = latestByAthlete.get(profile.id);
    if (!latest) return;
    const geocode = geocodingMap.get(latest.id);
    const position = getMarkerPosition(latest, geocode);
    if (!position) return;

    const color = colorByAthlete.get(profile.id) || '#d4142a';
    const name = athleteDisplayName(profile);

    if (!seenLegend.has(profile.id)) {
      legendItems.push(
        `<span class="legend-item"><span class="legend-dot" style="background:${color}"></span>${SkateTrack.escapeHtml(name)}</span>`
      );
      seenLegend.add(profile.id);
    }

    const marker = L.marker(position, { icon: createAthleteIcon(color), title: name });

    marker.bindPopup(`
      <strong>${SkateTrack.escapeHtml(name)}</strong><br>
      ${SkateTrack.formatTime(latest.checkin_at)} • ${latest.location_type === 'gps' ? 'GPS' : 'Manual'}<br>
      Precisão: ${SkateTrack.escapeHtml(getPrecisionLabel(latest, geocode))}<br>
      ${SkateTrack.escapeHtml([latest.city, latest.country].filter(Boolean).join(' / ') || 'Sem local detalhado')}
    `);

    marker.bindTooltip(`
      <strong>${SkateTrack.escapeHtml(name)}</strong><br>
      ${SkateTrack.formatTime(latest.checkin_at)} • ${latest.location_type === 'gps' ? 'GPS' : 'Manual'}
    `);

    markersLayer.addLayer(marker);
    bounds.push(position);
  });

  legend.innerHTML = legendItems.length ? legendItems.join('') : '<span class="legend-item">Sem marcadores no mapa hoje.</span>';

  if (bounds.length) {
    const uniqueKeys = new Set(bounds.map(markerKey));
    if (uniqueKeys.size === 1 && bounds.length > 1) {
      const single = bounds[0];
      map.setView(single, 18);
      setTimeout(() => {
        markersLayer.eachLayer(layer => {
          if (typeof layer.spiderfy === 'function') {
            layer.spiderfy();
          }
        });
      }, 250);
    } else {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 17 });
    }
  } else {
    map.setView([8, -18], 2);
  }
}

function renderCheckinsTable({ profiles, latestByAthlete, geocodingMap }) {
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
      <td>${SkateTrack.escapeHtml(latest.observation || getPrecisionLabel(latest, geocodingMap.get(latest.id)) || '—')}</td>
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
