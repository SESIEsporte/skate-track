const ROLE_ROUTES = {
  admin: 'admin.html',
  athlete: 'athlete.html'
};

const PAGE_TITLES = {
  'athlete.html': 'Meu dia',
  'plans.html': 'Meus planos',
  'admin.html': 'Mapa Geral',
  'athletes.html': 'Atletas',
  'reports.html': 'Relatórios',
};

const COLOR_POOL = ['#d4142a', '#111827', '#7c2d12', '#2563eb', '#7c3aed', '#0f766e', '#be185d', '#b45309', '#3f3f46', '#065f46'];

function $(selector, root = document) {
  return root.querySelector(selector);
}
function $all(selector, root = document) {
  return [...root.querySelectorAll(selector)];
}

function setNotice(el, message = '', type = 'muted') {
  if (!el) return;
  if (!message) {
    el.className = 'notice hidden';
    el.textContent = '';
    return;
  }
  el.className = `notice ${type}`;
  el.textContent = message;
}

function formatDate(dateValue, locale = 'pt-BR', options = {}) {
  if (!dateValue) return '—';
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(locale, options).format(date);
}

function formatDateTime(dateValue) {
  return formatDate(dateValue, 'pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function formatTime(dateValue) {
  return formatDate(dateValue, 'pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatDateOnly(dateValue) {
  return formatDate(dateValue, 'pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function todayRange() {
  const start = new Date();
  start.setHours(0,0,0,0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getInitials(name = '') {
  return name.trim().split(/\s+/).slice(0,2).map(part => part[0]?.toUpperCase() || '').join('') || 'ST';
}

function withAlpha(hex, alpha = '99') {
  return `${hex}${alpha}`;
}

function usernameToEmail(username) {
  return `${String(username || '').trim().toLowerCase()}@skatetrack.local`;
}

function getLocationLabel(record) {
  const parts = [record.location_name, record.city, record.state_region, record.country].filter(Boolean);
  return parts.length ? parts.join(' • ') : 'Sem local detalhado';
}

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const stringValue = String(value).replace(/"/g, '""');
  return `"${stringValue}"`;
}

function downloadCsv(filename, rows) {
  const csv = rows.map(row => row.map(csvEscape).join(';')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function attachSidebarToggle() {
  const sidebar = $('.sidebar');
  const openBtn = $('[data-menu-open]');
  const closeBtn = $('[data-menu-close]');
  const overlay = $('.drawer-overlay');
  if (!sidebar || !openBtn || !overlay) return;

  const open = () => { sidebar.classList.add('open'); overlay.classList.add('open'); };
  const close = () => { sidebar.classList.remove('open'); overlay.classList.remove('open'); };
  openBtn.addEventListener('click', open);
  closeBtn?.addEventListener('click', close);
  overlay.addEventListener('click', close);
  $all('.nav-link').forEach(link => link.addEventListener('click', close));
}

function renderShell({ role, activePage, profile }) {
  const menu = role === 'admin'
    ? [
        { href: 'admin.html', label: 'Mapa Geral' },
        { href: 'athletes.html', label: 'Atletas' },
        { href: 'reports.html', label: 'Relatórios' },
      ]
    : [
        { href: 'athlete.html', label: 'Meu dia' },
        { href: 'plans.html', label: 'Meus planos' },
      ];

  const sidebar = $('.sidebar');
  if (!sidebar) return;
  const navHtml = menu.map(item => `
    <a href="${item.href}" class="nav-link ${activePage === item.href ? 'active' : ''}">
      <span>${item.label}</span>
      ${activePage === item.href ? '<span class="nav-badge">Atual</span>' : ''}
    </a>
  `).join('');

  sidebar.innerHTML = `
    <div class="brand">
      <img class="logo-mark" src="logo.svg" alt="SkateTrack">
      <div class="brand-meta">
        <strong>SkateTrack</strong>
        <span>Gestão operacional e cobertura</span>
      </div>
    </div>

    <nav class="nav-group">${navHtml}</nav>

    <div class="sidebar-footer">
      <div class="account-card">
        <strong>${escapeHtml(profile?.full_name || profile?.social_name || profile?.username || 'Usuário')}</strong>
        <span>${role === 'admin' ? 'Gestão / Admin' : 'Atleta'}</span>
      </div>
      <button id="logoutButton" class="text-button">Sair</button>
    </div>
  `;

  const mobileBrandTitle = $('[data-mobile-title]');
  if (mobileBrandTitle) mobileBrandTitle.textContent = PAGE_TITLES[activePage] || 'SkateTrack';

  const accountName = $('[data-account-name]');
  if (accountName) accountName.textContent = profile?.full_name || profile?.social_name || profile?.username || 'Usuário';

  $('#logoutButton')?.addEventListener('click', handleLogout);
}

async function handleLogout() {
  await window.sb.auth.signOut();
  window.location.href = 'index.html';
}

async function getSessionProfile(requiredRole = null) {
  const { data: { session } } = await window.sb.auth.getSession();
  if (!session) {
    window.location.href = 'index.html';
    return null;
  }

  const { data: profile, error } = await window.sb
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();

  if (error || !profile) {
    throw new Error(error?.message || 'Perfil não encontrado.');
  }

  if (!profile.active) {
    await window.sb.auth.signOut();
    throw new Error('Usuário inativo. Entre em contato com o administrador.');
  }

  if (requiredRole && profile.role !== requiredRole) {
    const redirect = ROLE_ROUTES[profile.role] || 'index.html';
    window.location.href = redirect;
    return null;
  }

  return { session, profile };
}

async function routeByRole() {
  const { data: { session } } = await window.sb.auth.getSession();
  if (!session) return;
  const { data: profile } = await window.sb.from('profiles').select('role').eq('id', session.user.id).single();
  const target = ROLE_ROUTES[profile?.role] || 'index.html';
  if (!window.location.pathname.endsWith(target)) {
    window.location.href = target;
  }
}

async function geocodeQuery({ country, state, city, locationName }) {
  const parts = [locationName, city, state, country].filter(Boolean).join(', ');
  if (!parts) return null;
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(parts)}`;
  const response = await fetch(url, { headers: { 'Accept-Language': 'pt-BR,en' } });
  if (!response.ok) throw new Error('Falha ao geocodificar local.');
  const data = await response.json();
  if (!Array.isArray(data) || !data.length) return null;
  return {
    latitude: Number(data[0].lat),
    longitude: Number(data[0].lon),
    source: 'nominatim'
  };
}

async function reverseGeocode(lat, lon) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`;
  const response = await fetch(url, { headers: { 'Accept-Language': 'pt-BR,en' } });
  if (!response.ok) throw new Error('Falha ao buscar endereço.');
  const data = await response.json();
  const address = data.address || {};
  return {
    country: address.country || '',
    state_region: address.state || address.region || '',
    city: address.city || address.town || address.village || address.county || '',
    location_name: data.name || data.display_name || ''
  };
}

function isPlanActive(plan, currentDate = todayDateString()) {
  if (!plan?.start_date || !plan?.end_date) return false;
  return plan.start_date <= currentDate && plan.end_date >= currentDate;
}

function buildPlanSummary(plan) {
  const origin = [plan.origin_city, plan.origin_state, plan.origin_country].filter(Boolean).join(' / ');
  const destination = [plan.destination_city, plan.destination_state, plan.destination_country].filter(Boolean).join(' / ');
  return `${origin || 'Origem não informada'} → ${destination || 'Destino não informado'}`;
}

function getAthleteColor(index) {
  return COLOR_POOL[index % COLOR_POOL.length];
}

function injectTopbarTitle(title, subtitle) {
  const titleEl = $('[data-page-title]');
  const subtitleEl = $('[data-page-subtitle]');
  if (titleEl) titleEl.textContent = title;
  if (subtitleEl) subtitleEl.textContent = subtitle;
}

window.SkateTrack = {
  $, $all, setNotice, formatDateTime, formatDateOnly, formatTime, todayRange, todayDateString,
  usernameToEmail, renderShell, getSessionProfile, routeByRole, geocodeQuery, reverseGeocode,
  isPlanActive, buildPlanSummary, getAthleteColor, injectTopbarTitle, attachSidebarToggle,
  getLocationLabel, escapeHtml, downloadCsv, withAlpha, getInitials
};
