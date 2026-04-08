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
const COUNTRY_CODES = ["AW", "AF", "AO", "AI", "AX", "AL", "AD", "AE", "AR", "AM", "AS", "AQ", "TF", "AG", "AU", "AT", "AZ", "BI", "BE", "BJ", "BQ", "BF", "BD", "BG", "BH", "BS", "BA", "BL", "BY", "BZ", "BM", "BO", "BR", "BB", "BN", "BT", "BV", "BW", "CF", "CA", "CC", "CH", "CL", "CN", "CI", "CM", "CD", "CG", "CK", "CO", "KM", "CV", "CR", "CU", "CW", "CX", "KY", "CY", "CZ", "DE", "DJ", "DM", "DK", "DO", "DZ", "EC", "EG", "ER", "EH", "ES", "EE", "ET", "FI", "FJ", "FK", "FR", "FO", "FM", "GA", "GB", "GE", "GG", "GH", "GI", "GN", "GP", "GM", "GW", "GQ", "GR", "GD", "GL", "GT", "GF", "GU", "GY", "HK", "HM", "HN", "HR", "HT", "HU", "ID", "IM", "IN", "IO", "IE", "IR", "IQ", "IS", "IL", "IT", "JM", "JE", "JO", "JP", "KZ", "KE", "KG", "KH", "KI", "KN", "KR", "KW", "LA", "LB", "LR", "LY", "LC", "LI", "LK", "LS", "LT", "LU", "LV", "MO", "MF", "MA", "MC", "MD", "MG", "MV", "MX", "MH", "MK", "ML", "MT", "MM", "ME", "MN", "MP", "MZ", "MR", "MS", "MQ", "MU", "MW", "MY", "YT", "NA", "NC", "NE", "NF", "NG", "NI", "NU", "NL", "NO", "NP", "NR", "NZ", "OM", "PK", "PA", "PN", "PE", "PH", "PW", "PG", "PL", "PR", "KP", "PT", "PY", "PS", "PF", "QA", "RE", "RO", "RU", "RW", "SA", "SD", "SN", "SG", "GS", "SH", "SJ", "SB", "SL", "SV", "SM", "SO", "PM", "RS", "SS", "ST", "SR", "SK", "SI", "SE", "SZ", "SX", "SC", "SY", "TC", "TD", "TG", "TH", "TJ", "TK", "TM", "TL", "TO", "TT", "TN", "TR", "TV", "TW", "TZ", "UG", "UA", "UM", "UY", "US", "UZ", "VA", "VC", "VE", "VG", "VI", "VN", "VU", "WF", "WS", "YE", "ZA", "ZM", "ZW"];


const COUNTRY_ALIASES = {
  'eua': 'Estados Unidos',
  'usa': 'Estados Unidos',
  'united states': 'Estados Unidos',
  'united states of america': 'Estados Unidos',
  'uk': 'Reino Unido',
  'united kingdom': 'Reino Unido',
  'england': 'Reino Unido',
  'inglaterra': 'Reino Unido',
  'scotland': 'Reino Unido',
  'escocia': 'Reino Unido',
  'netherlands': 'Países Baixos',
  'holanda': 'Países Baixos',
  'paises baixos': 'Países Baixos',
  'países baixos': 'Países Baixos',
};

function normalizeLocationToken(value = '') {
  return String(value || '')
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .replace(/^\s+|\s+$/g, '')
    .replace(/^[,.;:\-–—\s]+|[,.;:\-–—\s]+$/g, '');
}

function normalizeCountryName(value = '') {
  const normalized = normalizeLocationToken(value);
  const key = normalized.toLowerCase();
  return COUNTRY_ALIASES[key] || normalized;
}

async function geocodeManualWithGeoapify({ checkinId, country, state, city }) {
  const { data, error } = await window.sb.functions.invoke('geocode-manual', {
    body: {
      checkinId,
      pais: normalizeCountryName(country),
      estado: normalizeLocationToken(state),
      cidade: normalizeLocationToken(city),
    }
  });

  if (error) {
    throw new Error(error.message || 'Falha ao consultar a função de geocodificação.');
  }

  if (!data || data.error) {
    throw new Error(data?.error || 'A função de geocodificação não retornou coordenadas.');
  }

  return data;
}

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

  const open = () => { sidebar.classList.add('open'); overlay.classList.add('open'); document.body.classList.add('drawer-open'); };
  const close = () => { sidebar.classList.remove('open'); overlay.classList.remove('open'); document.body.classList.remove('drawer-open'); };
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
      <div class="account-card compact-account-card">
        <strong>${escapeHtml(profile?.full_name || profile?.social_name || profile?.username || 'Usuário')}</strong>
        <span>${role === 'admin' ? 'Gestão / Admin' : 'Atleta'}</span>
      </div>
      ${role === 'athlete' ? '<button id="changePasswordOpen" class="footer-link-button" type="button">Alterar senha</button>' : '<button id="changePasswordAdmin" data-admin-password-open class="footer-link-button" type="button">Alterar senha</button>'}
      <button id="logoutButton" class="text-button">Sair</button>
      <div class="sidebar-legal-links">
        <a href="privacy.html">Política de Privacidade</a>
        <a href="terms.html">Termos de Uso</a>
      </div>
    </div>
  `;

  const mobileBrandTitle = $('[data-mobile-title]');
  if (mobileBrandTitle) mobileBrandTitle.textContent = PAGE_TITLES[activePage] || 'SkateTrack';

  const accountName = $('[data-account-name]');
  if (accountName) accountName.textContent = profile?.full_name || profile?.social_name || profile?.username || 'Usuário';

  $('#logoutButton')?.addEventListener('click', handleLogout);

  if (role === 'admin') {
    ensureAdminPasswordModal();

    const adminPasswordButton = $('#changePasswordAdmin');
    if (adminPasswordButton && !adminPasswordButton.dataset.bound) {
      adminPasswordButton.addEventListener('click', () => {
        $('#adminPasswordModal')?.classList.add('open');
      });
      adminPasswordButton.dataset.bound = 'true';
    }
  }
}

function ensureAdminPasswordModal() {
  if ($('#adminPasswordModal')) return;

  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div id="adminPasswordModal" class="modal">
      <div class="modal-card password-card">
        <div class="modal-header">
          <div><h2 class="card-title">Alterar senha</h2></div>
          <button type="button" class="modal-close" data-close-admin-password>×</button>
        </div>
        <div id="adminPasswordNotice" class="notice hidden"></div>
        <form id="adminPasswordForm">
          <div class="field">
            <label for="adminNewPassword">Nova senha</label>
            <input id="adminNewPassword" type="password" minlength="6" required>
          </div>
          <div class="field">
            <label for="adminConfirmPassword">Confirmar nova senha</label>
            <input id="adminConfirmPassword" type="password" minlength="6" required>
          </div>
          <div class="button-row modal-actions-end">
            <button class="secondary-button" type="button" data-close-admin-password>Cancelar</button>
            <button class="primary-button" type="submit">Salvar senha</button>
          </div>
        </form>
      </div>
    </div>
  `;
  document.body.appendChild(wrapper.firstElementChild);

  const modal = $('#adminPasswordModal');
  const form = $('#adminPasswordForm');
  const notice = $('#adminPasswordNotice');

  const closeModal = () => {
    modal?.classList.remove('open');
    form?.reset();
    setNotice(notice, '', 'muted');
  };

  modal?.querySelectorAll('[data-close-admin-password]').forEach(button => {
    button.addEventListener('click', closeModal);
  });
  modal?.addEventListener('click', event => {
    if (event.target === modal) closeModal();
  });

  form?.addEventListener('submit', async event => {
    event.preventDefault();
    const newPassword = $('#adminNewPassword')?.value?.trim() || '';
    const confirmPassword = $('#adminConfirmPassword')?.value?.trim() || '';

    if (newPassword.length < 6) {
      setNotice(notice, 'A senha precisa ter ao menos 6 caracteres.', 'warning');
      return;
    }
    if (newPassword !== confirmPassword) {
      setNotice(notice, 'A confirmação da senha não confere.', 'warning');
      return;
    }

    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Salvando...';
    try {
      const { error } = await window.sb.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNotice(notice, 'Senha alterada com sucesso.', 'success');
      setTimeout(closeModal, 800);
    } catch (error) {
      setNotice(notice, error.message || 'Não foi possível alterar a senha.', 'error');
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Salvar senha';
    }
  });
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
    .select('id, username, full_name, social_name, role, active')
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

const LOCAL_LOCATION_DB = {
  "Brasil": {
    "states": {
      "Acre": [
        "Rio Branco",
        "Cruzeiro do Sul",
        "Sena Madureira"
      ],
      "Alagoas": [
        "Maceió",
        "Arapiraca",
        "Palmeira dos Índios"
      ],
      "Amapá": [
        "Macapá",
        "Santana",
        "Laranjal do Jari"
      ],
      "Amazonas": [
        "Manaus",
        "Parintins",
        "Itacoatiara"
      ],
      "Bahia": [
        "Salvador",
        "Feira de Santana",
        "Vitória da Conquista",
        "Ilhéus",
        "Juazeiro"
      ],
      "Ceará": [
        "Fortaleza",
        "Caucaia",
        "Juazeiro do Norte",
        "Sobral"
      ],
      "Distrito Federal": [
        "Brasília",
        "Ceilândia",
        "Taguatinga"
      ],
      "Espírito Santo": [
        "Vitória",
        "Vila Velha",
        "Serra",
        "Cariacica"
      ],
      "Goiás": [
        "Goiânia",
        "Aparecida de Goiânia",
        "Anápolis",
        "Rio Verde"
      ],
      "Maranhão": [
        "São Luís",
        "Imperatriz",
        "Caxias"
      ],
      "Mato Grosso": [
        "Cuiabá",
        "Várzea Grande",
        "Rondonópolis",
        "Sinop"
      ],
      "Mato Grosso do Sul": [
        "Campo Grande",
        "Dourados",
        "Três Lagoas"
      ],
      "Minas Gerais": [
        "Belo Horizonte",
        "Uberlândia",
        "Contagem",
        "Juiz de Fora",
        "Montes Claros",
        "Betim"
      ],
      "Pará": [
        "Belém",
        "Ananindeua",
        "Santarém",
        "Marabá"
      ],
      "Paraíba": [
        "João Pessoa",
        "Campina Grande",
        "Patos"
      ],
      "Paraná": [
        "Curitiba",
        "Londrina",
        "Maringá",
        "Ponta Grossa",
        "Cascavel"
      ],
      "Pernambuco": [
        "Recife",
        "Jaboatão dos Guararapes",
        "Olinda",
        "Caruaru",
        "Petrolina"
      ],
      "Piauí": [
        "Teresina",
        "Parnaíba",
        "Picos"
      ],
      "Rio de Janeiro": [
        "Rio de Janeiro",
        "Niterói",
        "Nova Iguaçu",
        "Duque de Caxias",
        "Campos dos Goytacazes"
      ],
      "Rio Grande do Norte": [
        "Natal",
        "Mossoró",
        "Parnamirim"
      ],
      "Rio Grande do Sul": [
        "Porto Alegre",
        "Caxias do Sul",
        "Pelotas",
        "Santa Maria",
        "Passo Fundo"
      ],
      "Rondônia": [
        "Porto Velho",
        "Ji-Paraná",
        "Ariquemes"
      ],
      "Roraima": [
        "Boa Vista",
        "Rorainópolis",
        "Caracaraí"
      ],
      "Santa Catarina": [
        "Florianópolis",
        "Joinville",
        "Blumenau",
        "Chapecó",
        "Criciúma"
      ],
      "São Paulo": [
        "São Paulo",
        "Guarulhos",
        "Campinas",
        "São Bernardo do Campo",
        "Santo André",
        "Suzano",
        "São José dos Campos",
        "Ribeirão Preto",
        "Santos",
        "Sorocaba",
        "Bauru",
        "Franca",
        "Araraquara",
        "Presidente Prudente"
      ],
      "Sergipe": [
        "Aracaju",
        "Nossa Senhora do Socorro",
        "Lagarto"
      ],
      "Tocantins": [
        "Palmas",
        "Araguaína",
        "Gurupi"
      ]
    }
  },
  "Argentina": {
    "states": {
      "Buenos Aires": [
        "La Plata",
        "Mar del Plata",
        "Bahía Blanca",
        "Tigre"
      ],
      "Cidade Autônoma de Buenos Aires": [
        "Buenos Aires"
      ],
      "Córdoba": [
        "Córdoba",
        "Villa Carlos Paz",
        "Río Cuarto"
      ],
      "Mendoza": [
        "Mendoza",
        "San Rafael"
      ],
      "Santa Fe": [
        "Rosário",
        "Santa Fe"
      ],
      "Entre Ríos": [
        "Paraná"
      ],
      "San Juan": [
        "San Juan"
      ]
    }
  },
  "Chile": {
    "states": {
      "Região Metropolitana de Santiago": [
        "Santiago",
        "Puente Alto",
        "Maipú"
      ],
      "Valparaíso": [
        "Valparaíso",
        "Viña del Mar"
      ],
      "Biobío": [
        "Concepción"
      ],
      "Antofagasta": [
        "Antofagasta"
      ],
      "Araucanía": [
        "Temuco"
      ]
    }
  },
  "Uruguai": {
    "cities": [
      "Montevidéu",
      "Punta del Este",
      "Maldonado",
      "Salto",
      "Paysandú"
    ]
  },
  "Paraguai": {
    "cities": [
      "Assunção",
      "Ciudad del Este",
      "Encarnación"
    ]
  },
  "Peru": {
    "states": {
      "Lima": [
        "Lima",
        "Callao"
      ],
      "Cusco": [
        "Cusco"
      ],
      "Arequipa": [
        "Arequipa"
      ]
    }
  },
  "Colômbia": {
    "states": {
      "Cundinamarca": [
        "Bogotá"
      ],
      "Antioquia": [
        "Medellín"
      ],
      "Valle del Cauca": [
        "Cali"
      ]
    }
  },
  "Portugal": {
    "states": {
      "Lisboa": [
        "Lisboa",
        "Cascais",
        "Sintra"
      ],
      "Porto": [
        "Porto",
        "Vila Nova de Gaia"
      ],
      "Faro": [
        "Faro",
        "Albufeira"
      ],
      "Braga": [
        "Braga"
      ]
    }
  },
  "Espanha": {
    "states": {
      "Comunidade de Madrid": [
        "Madrid"
      ],
      "Catalunha": [
        "Barcelona"
      ],
      "Andaluzia": [
        "Sevilha",
        "Málaga"
      ],
      "Comunidade Valenciana": [
        "Valência"
      ]
    }
  },
  "Estados Unidos": {
    "states": {
      "California": [
        "Los Angeles",
        "San Francisco",
        "San Diego"
      ],
      "Florida": [
        "Miami",
        "Orlando"
      ],
      "New York": [
        "New York",
        "Buffalo"
      ],
      "Texas": [
        "Houston",
        "Dallas",
        "Austin"
      ]
    }
  },
  "Canadá": {
    "states": {
      "Ontário": [
        "Toronto",
        "Ottawa"
      ],
      "Quebec": [
        "Montreal",
        "Quebec"
      ],
      "Colúmbia Britânica": [
        "Vancouver",
        "Victoria"
      ]
    }
  },
  "França": {
    "states": {
      "Île-de-France": [
        "Paris"
      ],
      "Provence-Alpes-Côte d’Azur": [
        "Marselha",
        "Nice"
      ],
      "Auvergne-Rhône-Alpes": [
        "Lyon"
      ]
    }
  },
  "Itália": {
    "states": {
      "Lazio": [
        "Roma"
      ],
      "Lombardia": [
        "Milão"
      ],
      "Veneto": [
        "Veneza"
      ],
      "Toscana": [
        "Florença"
      ]
    }
  },
  "Alemanha": {
    "states": {
      "Berlim": [
        "Berlim"
      ],
      "Baviera": [
        "Munique"
      ],
      "Hamburgo": [
        "Hamburgo"
      ],
      "Hesse": [
        "Frankfurt"
      ]
    }
  },
  "Reino Unido": {
    "states": {
      "Inglaterra": [
        "Londres",
        "Manchester",
        "Liverpool"
      ],
      "Escócia": [
        "Edimburgo",
        "Glasgow"
      ],
      "País de Gales": [
        "Cardiff"
      ]
    }
  },
  "Japão": {
    "states": {
      "Tóquio": [
        "Tóquio"
      ],
      "Osaka": [
        "Osaka"
      ],
      "Aichi": [
        "Nagoya"
      ]
    }
  },
  "Austrália": {
    "states": {
      "Nova Gales do Sul": [
        "Sydney"
      ],
      "Victoria": [
        "Melbourne"
      ],
      "Queensland": [
        "Brisbane"
      ]
    }
  }
};

function getCountryOptions(locale = 'pt-BR') {
  const display = typeof Intl !== 'undefined' && Intl.DisplayNames ? new Intl.DisplayNames([locale, 'en'], { type: 'region' }) : null;
  return COUNTRY_CODES
    .map(code => display?.of(code) || code)
    .filter(Boolean)
    .filter(name => !/^Unknown Region/i.test(name))
    .sort((a, b) => a.localeCompare(b, locale));
}

function populateCountryList(datalistId) {
  const datalist = document.getElementById(datalistId);
  if (!datalist) return;
  datalist.innerHTML = getCountryOptions().map(name => `<option value="${escapeHtml(name)}"></option>`).join('');
}

async function fetchLocationSuggestions(query) {
  if (!query || query.trim().length < 2) return [];
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=8&q=${encodeURIComponent(query)}`;
  const response = await fetch(url, { headers: { 'Accept-Language': 'pt-BR,en' } });
  if (!response.ok) return [];
  return response.json();
}

function dedupeSuggestions(values) {
  return [...new Set(values.filter(Boolean).map(v => String(v).trim()).filter(Boolean))];
}

function getCurrentWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const start = new Date(now);
  start.setDate(now.getDate() + diffToMonday);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function isPlanInCurrentWeek(plan) {
  if (!plan?.start_date || !plan?.end_date) return false;
  const { start, end } = getCurrentWeekRange();
  const planStart = new Date(`${plan.start_date}T00:00:00`);
  const planEnd = new Date(`${plan.end_date}T23:59:59`);
  return planStart <= end && planEnd >= start;
}

function injectTopbarTitle(title, subtitle) {
  const titleEl = $('[data-page-title]');
  const subtitleEl = $('[data-page-subtitle]');
  if (titleEl) titleEl.textContent = title;
  if (subtitleEl) subtitleEl.textContent = subtitle;
}


function normalizeLocationValue(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function resolveCountryKey(value = '') {
  const normalized = normalizeLocationValue(value);
  if (!normalized) return '';
  return Object.keys(LOCAL_LOCATION_DB).find(key => normalizeLocationValue(key) === normalized) || '';
}

function resolveStateKey(country, value = '') {
  const countryKey = resolveCountryKey(country) || country;
  const states = LOCAL_LOCATION_DB[countryKey]?.states || {};
  const normalized = normalizeLocationValue(value);
  if (!normalized) return '';
  return Object.keys(states).find(key => normalizeLocationValue(key) === normalized) || '';
}

function getStatesForCountry(country) {
  const countryKey = resolveCountryKey(country);
  const states = LOCAL_LOCATION_DB[countryKey]?.states || {};
  return Object.keys(states);
}

function getCitiesForCountryState(country, state = '') {
  const countryKey = resolveCountryKey(country);
  if (!countryKey) return [];
  const countryData = LOCAL_LOCATION_DB[countryKey];
  if (countryData?.states && Object.keys(countryData.states).length) {
    const stateKey = resolveStateKey(countryKey, state);
    return stateKey ? (countryData.states[stateKey] || []) : [];
  }
  return countryData?.cities || [];
}

function hasStructuredStates(country) {
  const countryKey = resolveCountryKey(country);
  const states = LOCAL_LOCATION_DB[countryKey]?.states || {};
  return Object.keys(states).length > 0;
}

function hasCountryLevelCities(country) {
  const countryKey = resolveCountryKey(country);
  return !!LOCAL_LOCATION_DB[countryKey]?.cities?.length;
}

function getSupportedStructuredCountries() {
  return Object.keys(LOCAL_LOCATION_DB);
}

function createLocationController({ countryInput, stateInput, cityInput, stateListId, cityListId }) {
  const stateList = document.getElementById(stateListId);
  const cityList = document.getElementById(cityListId);

  const stateUsesSelect = stateInput?.tagName === 'SELECT';
  const cityUsesSelect = cityInput?.tagName === 'SELECT';

  const stateTarget = stateUsesSelect ? stateInput : stateList;
  const cityTarget = cityUsesSelect ? cityInput : cityList;

  const fillTarget = (target, options, placeholder = 'Selecione') => {
    if (!target) return;
    if (target.tagName === 'SELECT') {
      const optionHtml = [`<option value="">${escapeHtml(placeholder)}</option>`]
        .concat(options.map(option => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`))
        .join('');
      target.innerHTML = optionHtml;
      return;
    }
    target.innerHTML = options.map(option => `<option value="${escapeHtml(option)}"></option>`).join('');
  };

  const setStateEnabled = (enabled) => {
    if (stateUsesSelect) {
      stateInput.disabled = !enabled;
      stateInput.style.opacity = enabled ? '1' : '0.6';
      return;
    }
    stateInput.disabled = false;
    stateInput.style.opacity = '1';
  };

  const setCityEnabled = (enabled) => {
    if (cityUsesSelect) {
      cityInput.disabled = !enabled;
      cityInput.style.opacity = enabled ? '1' : '0.6';
      return;
    }
    cityInput.disabled = false;
    cityInput.style.opacity = '1';
  };

  const clearState = (placeholder = 'Selecione o país primeiro') => {
    stateInput.value = '';
    fillTarget(stateTarget, [], placeholder);
  };

  const clearCity = (placeholder = 'Selecione o estado primeiro') => {
    cityInput.value = '';
    fillTarget(cityTarget, [], placeholder);
  };

  const updateByCountry = () => {
    const country = countryInput.value.trim();
    const countryKey = resolveCountryKey(country);

    clearCity('Selecione o estado primeiro');

    if (!country) {
      clearState(stateUsesSelect ? 'Selecione o país primeiro' : 'Informe o estado / província');
      clearCity(cityUsesSelect ? 'Selecione o estado primeiro' : 'Informe a cidade');
      setStateEnabled(!stateUsesSelect);
      setCityEnabled(!cityUsesSelect);
      if (!stateUsesSelect) stateInput.placeholder = 'Informe o estado / província';
      if (!cityUsesSelect) cityInput.placeholder = 'Informe a cidade';
      return;
    }

    if (countryKey && hasStructuredStates(countryKey)) {
      clearState('Selecione o estado');
      fillTarget(stateTarget, getStatesForCountry(countryKey), 'Selecione o estado');
      setStateEnabled(true);
      setCityEnabled(false);
      if (!stateUsesSelect) stateInput.placeholder = 'Selecione ou informe o estado';
      if (!cityUsesSelect) cityInput.placeholder = 'Informe a cidade';
      return;
    }

    clearState('Informe o estado / província');
    setStateEnabled(true);
    setCityEnabled(true);
    if (!stateUsesSelect) stateInput.placeholder = 'Informe o estado / província';
    if (countryKey && hasCountryLevelCities(countryKey)) {
      fillTarget(cityTarget, getCitiesForCountryState(countryKey, ''), cityUsesSelect ? 'Selecione a cidade' : 'Selecione ou informe a cidade');
      if (!cityUsesSelect) cityInput.placeholder = 'Selecione ou digite a cidade';
    } else {
      clearCity('Informe a cidade');
      if (!cityUsesSelect) cityInput.placeholder = 'Informe a cidade';
    }
  };

  const updateByState = () => {
    const country = countryInput.value.trim();
    const state = stateInput.value.trim();
    const countryKey = resolveCountryKey(country);

    if (!country) {
      clearCity(cityUsesSelect ? 'Selecione o estado primeiro' : 'Informe a cidade');
      setCityEnabled(!cityUsesSelect);
      if (!cityUsesSelect) cityInput.placeholder = 'Informe a cidade';
      return;
    }

    if (countryKey && hasStructuredStates(countryKey)) {
      const cities = getCitiesForCountryState(countryKey, state);
      fillTarget(cityTarget, cities, cities.length ? 'Selecione a cidade' : 'Informe a cidade');
      setCityEnabled(true);
      if (!cityUsesSelect) cityInput.placeholder = cities.length ? 'Selecione ou informe a cidade' : 'Informe a cidade';
      return;
    }

    if (countryKey && hasCountryLevelCities(countryKey)) {
      fillTarget(cityTarget, getCitiesForCountryState(countryKey, ''), cityUsesSelect ? 'Selecione a cidade' : 'Selecione ou informe a cidade');
    } else {
      clearCity('Informe a cidade');
    }
    setCityEnabled(true);
    if (!cityUsesSelect) cityInput.placeholder = 'Informe a cidade';
  };

  countryInput.addEventListener('input', updateByCountry);
  countryInput.addEventListener('change', updateByCountry);
  stateInput.addEventListener('input', updateByState);
  stateInput.addEventListener('change', updateByState);
  stateInput.addEventListener('focus', () => {
    if (countryInput.value.trim()) updateByCountry();
  });
  cityInput.addEventListener('focus', () => {
    if (countryInput.value.trim()) updateByState();
  });

  return {
    reset() {
      countryInput.value = '';
      clearState('Selecione o país primeiro');
      clearCity('Selecione o estado primeiro');
      setStateEnabled(!stateUsesSelect);
      setCityEnabled(!cityUsesSelect);
      if (!stateUsesSelect) stateInput.placeholder = 'Informe o estado / província';
      if (!cityUsesSelect) cityInput.placeholder = 'Informe a cidade';
    },
    hydrate({ country = '', state = '', city = '' } = {}) {
      countryInput.value = country || '';
      updateByCountry();
      if (country) {
        stateInput.value = state || '';
        updateByState();
      }
      cityInput.value = city || '';
    }
  };
}

window.SkateTrack = {
  $, $all, setNotice, formatDateTime, formatDateOnly, formatTime, todayRange, todayDateString,
  usernameToEmail, renderShell, getSessionProfile, routeByRole, geocodeQuery, reverseGeocode,
  isPlanActive, buildPlanSummary, getAthleteColor, injectTopbarTitle, attachSidebarToggle,
  getLocationLabel, escapeHtml, downloadCsv, withAlpha, getInitials, populateCountryList,
  fetchLocationSuggestions, dedupeSuggestions, isPlanInCurrentWeek, getCurrentWeekRange,
  resolveCountryKey, getStatesForCountry, getCitiesForCountryState, hasStructuredStates, hasCountryLevelCities,
  createLocationController, getSupportedStructuredCountries,
  normalizeLocationToken, normalizeCountryName, geocodeManualWithGeoapify
};


function ensureCookieConsentBanner() {
  if (localStorage.getItem('skatetrack_cookie_consent') === 'accepted') return;
  if (document.querySelector('.cookie-banner')) return;

  const banner = document.createElement('div');
  banner.className = 'cookie-banner';
  banner.innerHTML = `
    <p>Utilizamos cookies essenciais para o funcionamento do SkateTrack. Ao continuar, você concorda com nossa <a href="privacy.html">Política de Privacidade</a>.</p>
    <button type="button" class="primary-button" data-cookie-accept>Entendi</button>
  `;

  document.body.appendChild(banner);
  banner.querySelector('[data-cookie-accept]')?.addEventListener('click', () => {
    localStorage.setItem('skatetrack_cookie_consent', 'accepted');
    banner.remove();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  ensureCookieConsentBanner();
});
