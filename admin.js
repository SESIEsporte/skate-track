let map;
let markersLayer;

function athleteDisplayName(profile = {}) {
  const raw = String(profile.social_name || profile.full_name || profile.username || 'Atleta').trim();
  if (!raw) return 'Atleta';
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1][0]}.`;
}

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
  if (checkin?.latitude != null && checkin?.longitude != null) {
    return [Number(checkin.latitude), Number(checkin.longitude)];
  }
  if (geocode?.geocoded_latitude != null && geocode?.geocoded_longitude != null) {
    return [Number(geocode.geocoded_latitude), Number(geocode.geocoded_longitude)];
  }
  return null;
}

function getPrecisionLabel(checkin, geocode) {
  if (checkin?.location_type === 'gps' && checkin?.latitude != null && checkin?.longitude != null) {
    return 'GPS';
  }
  const level = geocode?.precision_level || 'not_found';
  if (level === 'city') return 'Cidade';
  if (level === 'state') return 'Estado';
  if (level === 'country') return 'País';
  return '—';
}

function renderNameList(containerId, names, emptyText) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!names.length) {
    container.innerHTML = `<div class="empty-state compact-empty">${emptyText}</div>`;
    return;
  }
  container.innerHTML = names.map(name => `
    <article class="record-item" style="padding:12px 14px;">
      <strong>${SkateTrack.escapeHtml(name)}</strong>
    </article>
  `).join('');
}

function buildSkateSvg(color) {
  const safeColor = encodeURIComponent(color || '#d4142a');
  return `data:image/svg+xml;charset=UTF-8,${[
    '<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 34 34">',
    '<defs>',
    '<filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">',
    '<feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="rgba(15,23,42,.28)"/>',
    '</filter>',
    '</defs>',
    '<g filter="url(%23shadow)" transform="translate(2 3)">',
    `<path d="M4 15.5c4.1 1.6 18 1.6 22.2-.1 1-.4 1.7-1.4 1.8-2.5l.4-3.9c.1-.8-.5-1.6-1.3-1.7-.1 0-.2 0-.3 0H3.4c-.8 0-1.5.7-1.5 1.5 0 .1 0 .2 0 .3l.4 3.8c.1 1.2.8 2.2 1.7 2.6z" fill="${safeColor}" stroke="%23111827" stroke-width="1.2"/>`,
    '<circle cx="8" cy="22.5" r="3.1" fill="%23111827"/>',
    '<circle cx="23" cy="22.5" r="3.1" fill="%23111827"/>',
    '<circle cx="8" cy="22.5" r="1.25" fill="white" opacity=".9"/>',
    '<circle cx="23" cy="22.5" r="1.25" fill="white" opacity=".9"/>',
    '<path d="M9 9.8h12.4" stroke="white" stroke-width="1.4" stroke-linecap="round" opacity=".9"/>',
    '</g>',
    '</svg>'
  ].join('')}`;
}

function createSkateIcon(color) {
  return L.icon({
    iconUrl: buildSkateSvg(color),
    iconSize: [30, 30],
    iconAnchor: [15, 24],
    popupAnchor: [0, -20],
    tooltipAnchor: [0, -18],
    className: 'skate-marker-icon'
  });
}

function createClusterIcon(cluster) {
  const count = cluster.getChildCount();
  let sizeClass = 'small';
  if (count >= 10) sizeClass = 'large';
  else if (count >= 4) sizeClass = 'medium';

  return L.divIcon({
    html: `<div class="custom-cluster ${sizeClass}"><span>${count}</span></div>`,
    className: 'custom-cluster-wrapper',
    iconSize: sizeClass === 'large' ? [46, 46] : sizeClass === 'medium' ? [40, 40] : [34, 34]
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
    const refreshButton = document.getElementById('refreshDashboard');
    refreshButton?.addEventListener('click', async () => {
      refreshButton.disabled = true;
      const originalLabel = refreshButton.textContent;
      refreshButton.textContent = 'Atualizando...';
      try {
        await loadAdminDashboard(notice);
      } catch (error) {
        console.error(error);
        SkateTrack.setNotice(notice, error.message || 'Falha ao atualizar painel.', 'error');
      } finally {
        refreshButton.disabled = false;
        refreshButton.textContent = originalLabel || 'Atualizar painel';
      }
    });
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
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    zoomToBoundsOnClick: true,
    removeOutsideVisibleBounds: true,
    maxClusterRadius: 32,
    spiderLegPolylineOptions: {
      weight: 1.5,
      color: '#4b5563',
      opacity: 0.65
    },
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
  document.getElementById('activeAthletesInline').textContent = activeProfilesOrdered.map(athleteDisplayName).join(', ') || '—';
  document.getElementById('pendingAthletesInline').textContent = pendingProfiles.map(athleteDisplayName).join(', ') || '—';

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

    const marker = L.marker(position, {
      icon: createSkateIcon(color),
      title: name,
      riseOnHover: true
    });

    const locationParts = [latest.country, latest.state_region, latest.city].filter(Boolean);
    const locationText = SkateTrack.escapeHtml(locationParts.join(' / ') || 'Sem local detalhado');
    const checkinType = latest.location_type === 'gps' ? 'GPS' : 'Manual';

    marker.bindTooltip(`
      <strong>${SkateTrack.escapeHtml(name)}</strong><br>
      ${SkateTrack.formatTime(latest.checkin_at)} • ${checkinType}<br>
      ${locationText}
    `);

    marker.bindPopup(`
      <strong>${SkateTrack.escapeHtml(name)}</strong><br>
      ${SkateTrack.formatTime(latest.checkin_at)} • ${checkinType}<br>
      ${locationText}
    `);

    markersLayer.addLayer(marker);
    bounds.push(position);
  });

  legend.innerHTML = legendItems.length ? legendItems.join('') : '<span class="legend-item">Sem marcadores no mapa hoje.</span>';
  if (bounds.length) {
    const boundsGroup = L.latLngBounds(bounds);
    map.fitBounds(boundsGroup, { padding: [40, 40], maxZoom: 5 });
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
