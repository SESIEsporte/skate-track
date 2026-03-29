let map;
let markersLayer;

document.addEventListener('DOMContentLoaded', async () => {
  SkateTrack.attachSidebarToggle();
  const notice = document.getElementById('pageNotice');

  try {
    const sessionData = await SkateTrack.getSessionProfile('admin');
    if (!sessionData) return;
    const { profile } = sessionData;
    SkateTrack.renderShell({ role: 'admin', activePage: 'admin.html', profile });
    SkateTrack.injectTopbarTitle('Mapa Geral', 'Leitura operacional do dia com posição atual por atleta e alertas de cobertura.');
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
}

async function loadAdminDashboard(notice) {
  SkateTrack.setNotice(notice, 'Atualizando dados operacionais...', 'muted');
  const dateRange = SkateTrack.todayRange();

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

  const profiles = profilesRes.data;
  const plans = plansRes.data;
  const checkins = checkinsRes.data;
  const geocodingMap = new Map(geocodingRes.data.map(item => [item.checkin_id, item]));
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

  renderMetrics({ profiles, plans, checkins, latestByAthlete });
  renderAlerts({ profiles, latestByAthlete, geocodingMap, plans });
  renderTable({ profiles, latestByAthlete, planByAthlete, geocodingMap });
  renderMap({ profiles, latestByAthlete, geocodingMap });
  SkateTrack.setNotice(notice, '', 'muted');
}

function renderMetrics({ profiles, plans, checkins, latestByAthlete }) {
  const today = SkateTrack.todayDateString();
  const activePlans = plans.filter(plan => SkateTrack.isPlanActive(plan, today));
  document.getElementById('metricAthletes').textContent = profiles.length;
  document.getElementById('metricCheckins').textContent = checkins.length;
  document.getElementById('metricActivePlans').textContent = activePlans.length;
  document.getElementById('metricPending').textContent = Math.max(profiles.length - latestByAthlete.size, 0);
}

function renderAlerts({ profiles, latestByAthlete, geocodingMap, plans }) {
  const container = document.getElementById('alertsContainer');
  const activePlansByAthlete = new Set(plans.filter(plan => SkateTrack.isPlanActive(plan)).map(plan => plan.athlete_id));
  const alerts = [];

  profiles.forEach(profile => {
    const latest = latestByAthlete.get(profile.id);
    if (!latest) {
      alerts.push({ level: 'warning', title: profile.full_name || profile.username, description: 'Sem check-in registrado hoje.' });
      return;
    }
    if (latest.location_type === 'manual') {
      const geocode = geocodingMap.get(latest.id);
      if (!geocode?.geocoded_latitude || !geocode?.geocoded_longitude) {
        alerts.push({ level: 'warning', title: profile.full_name || profile.username, description: 'Check-in manual sem coordenada para o mapa.' });
      }
    }
    if (activePlansByAthlete.has(profile.id) && !latest) {
      alerts.push({ level: 'danger', title: profile.full_name || profile.username, description: 'Possui plano ativo, mas sem registro operacional.' });
    }
  });

  if (!alerts.length) {
    container.innerHTML = '<div class="empty-state">Sem alertas operacionais no momento.</div>';
    return;
  }

  container.innerHTML = alerts.map(alert => `
    <article class="alert-item">
      <div class="timeline-item-head">
        <div>
          <p class="item-title">${SkateTrack.escapeHtml(alert.title)}</p>
          <p class="item-meta">${SkateTrack.escapeHtml(alert.description)}</p>
        </div>
        <span class="status-pill ${alert.level}">${alert.level === 'danger' ? 'Atenção' : 'Monitorar'}</span>
      </div>
    </article>
  `).join('');
}

function renderTable({ profiles, latestByAthlete, planByAthlete, geocodingMap }) {
  const tbody = document.getElementById('operationsTableBody');
  const today = SkateTrack.todayDateString();
  const rows = profiles.map(profile => {
    const latest = latestByAthlete.get(profile.id);
    const activePlan = (planByAthlete.get(profile.id) || []).find(plan => SkateTrack.isPlanActive(plan, today));
    const geocode = latest ? geocodingMap.get(latest.id) : null;
    const hasCoords = latest ? ((latest.latitude && latest.longitude) || (geocode?.geocoded_latitude && geocode?.geocoded_longitude)) : false;
    return `
      <tr>
        <td><strong>${SkateTrack.escapeHtml(profile.full_name || profile.username)}</strong><br><span class="muted small">${SkateTrack.escapeHtml(profile.username)}</span></td>
        <td>${latest ? SkateTrack.formatDateTime(latest.checkin_at) : '—'}</td>
        <td>${latest ? `<span class="status-pill ${latest.location_type === 'gps' ? 'success' : 'warning'}">${latest.location_type === 'gps' ? 'GPS' : 'Manual'}</span>` : '<span class="status-pill muted">Sem registro</span>'}</td>
        <td>${activePlan ? SkateTrack.escapeHtml(SkateTrack.buildPlanSummary(activePlan)) : 'Sem plano ativo'}</td>
        <td>${latest ? SkateTrack.escapeHtml(latest.observation || latest.location_name || '—') : '—'}</td>
        <td>${hasCoords ? 'Plotado' : 'Sem coordenada'}</td>
      </tr>
    `;
  }).join('');

  tbody.innerHTML = rows || '<tr><td colspan="6">Nenhum atleta ativo encontrado.</td></tr>';
}

function renderMap({ profiles, latestByAthlete, geocodingMap }) {
  markersLayer.clearLayers();
  const bounds = [];
  const noCoordList = [];

  profiles.forEach((profile, index) => {
    const latest = latestByAthlete.get(profile.id);
    if (!latest) {
      noCoordList.push(`${profile.full_name || profile.username}: sem check-in`);
      return;
    }

    let lat = latest.latitude;
    let lon = latest.longitude;
    if ((!lat || !lon) && latest.location_type === 'manual') {
      const geocode = geocodingMap.get(latest.id);
      lat = geocode?.geocoded_latitude;
      lon = geocode?.geocoded_longitude;
    }

    if (!lat || !lon) {
      noCoordList.push(`${profile.full_name || profile.username}: sem coordenada`);
      return;
    }

    const color = SkateTrack.getAthleteColor(index);
    const fillOpacity = latest.location_type === 'gps' ? 0.95 : 0.48;
    const marker = L.circleMarker([lat, lon], {
      radius: 10,
      color,
      weight: 2,
      fillColor: color,
      fillOpacity,
    }).bindTooltip(`
      <strong>${SkateTrack.escapeHtml(profile.full_name || profile.username)}</strong><br>
      ${SkateTrack.formatDateTime(latest.checkin_at)}<br>
      ${latest.location_type === 'gps' ? 'GPS' : 'Manual'}<br>
      ${SkateTrack.escapeHtml([latest.country, latest.city, latest.location_name].filter(Boolean).join(' • ') || 'Local não detalhado')}<br>
      ${SkateTrack.escapeHtml(latest.observation || '')}
    `, { sticky: true });

    marker.addTo(markersLayer);
    bounds.push([lat, lon]);
  });

  if (bounds.length) {
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 5 });
  } else {
    map.setView([8, -18], 2);
  }

  document.getElementById('mapUnplotted').innerHTML = noCoordList.length
    ? `<div class="notice warning">Sem plotagem no mapa: ${SkateTrack.escapeHtml(noCoordList.join(' | '))}</div>`
    : '<div class="notice success">Todos os check-ins com coordenadas disponíveis foram plotados.</div>';
}
