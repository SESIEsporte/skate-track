document.addEventListener('DOMContentLoaded', async () => {
  SkateTrack.attachSidebarToggle();
  const notice = document.getElementById('pageNotice');

  try {
    const sessionData = await SkateTrack.getSessionProfile('admin');
    if (!sessionData) return;
    SkateTrack.renderShell({ role: 'admin', activePage: 'reports.html', profile: sessionData.profile });
    SkateTrack.injectTopbarTitle('Relatórios', 'Saída operacional e documental com exportação CSV real a partir das tabelas existentes.');
    await loadReports();
    bindFilters();
    bindExports();
  } catch (error) {
    console.error(error);
    SkateTrack.setNotice(notice, error.message || 'Falha ao carregar relatórios.', 'error');
  }
});

let operationalRows = [];
let coverageRows = [];

async function loadReports() {
  const notice = document.getElementById('pageNotice');
  SkateTrack.setNotice(notice, 'Carregando dados dos relatórios...', 'muted');

  const [{ data: profiles, error: profileError }, { data: checkins, error: checkinError }, { data: plans, error: planError }] = await Promise.all([
    window.sb.from('profiles').select('*').eq('role', 'athlete').order('full_name', { ascending: true }),
    window.sb.from('checkins').select('*').order('checkin_at', { ascending: false }),
    window.sb.from('plans').select('*').order('start_date', { ascending: false })
  ]);

  if (profileError) throw profileError;
  if (checkinError) throw checkinError;
  if (planError) throw planError;

  const profileMap = new Map(profiles.map(item => [item.id, item]));
  operationalRows = checkins.map(item => ({
    athlete: profileMap.get(item.athlete_id)?.full_name || profileMap.get(item.athlete_id)?.username || '—',
    date: item.checkin_at,
    type: item.location_type,
    country: item.country || '',
    city: item.city || '',
    location: item.location_name || '',
    observation: item.observation || ''
  }));

  coverageRows = plans.map(item => {
    const profile = profileMap.get(item.athlete_id) || {};
    return {
      athlete: profile.full_name || profile.username || '—',
      social_name: profile.social_name || '',
      sex: profile.sex || '',
      birth_date: profile.birth_date || '',
      rg: profile.rg || '',
      cpf: profile.cpf || '',
      origin: [item.origin_city, item.origin_state, item.origin_country].filter(Boolean).join(' / '),
      destination: [item.destination_city, item.destination_state, item.destination_country].filter(Boolean).join(' / '),
      period: `${item.start_date || ''} → ${item.end_date || ''}`,
      reason: item.travel_reason || '',
      notes: item.notes || ''
    };
  });

  renderOperationalTable(operationalRows);
  renderCoverageTable(coverageRows);
  document.getElementById('operationalCount').textContent = operationalRows.length;
  document.getElementById('coverageCount').textContent = coverageRows.length;
  SkateTrack.setNotice(notice, '', 'muted');
}

function bindFilters() {
  const athleteFilter = document.getElementById('athleteFilter');
  const dateFilter = document.getElementById('dateFilter');
  const apply = () => {
    const athlete = athleteFilter.value.trim().toLowerCase();
    const date = dateFilter.value;

    const filteredOperational = operationalRows.filter(row => {
      const matchesAthlete = !athlete || row.athlete.toLowerCase().includes(athlete);
      const matchesDate = !date || row.date.startsWith(date);
      return matchesAthlete && matchesDate;
    });
    renderOperationalTable(filteredOperational);

    const filteredCoverage = coverageRows.filter(row => !athlete || row.athlete.toLowerCase().includes(athlete));
    renderCoverageTable(filteredCoverage);
  };

  athleteFilter.addEventListener('input', apply);
  dateFilter.addEventListener('change', apply);
}

function bindExports() {
  document.getElementById('exportOperational').addEventListener('click', () => {
    const rows = [['Atleta', 'Data', 'Hora', 'Tipo', 'País', 'Cidade', 'Local', 'Observação']];
    document.querySelectorAll('#operationalTableBody tr').forEach(tr => {
      const cells = [...tr.children].map(td => td.innerText.trim());
      if (cells.length) rows.push(cells);
    });
    SkateTrack.downloadCsv(`relatorio_operacional_${SkateTrack.todayDateString()}.csv`, rows);
  });

  document.getElementById('exportCoverage').addEventListener('click', () => {
    const rows = [['Nome completo', 'Nome social', 'Sexo', 'Nascimento', 'RG', 'CPF', 'Origem', 'Destino', 'Período', 'Motivo', 'Observação']];
    document.querySelectorAll('#coverageTableBody tr').forEach(tr => {
      const cells = [...tr.children].map(td => td.innerText.trim());
      if (cells.length) rows.push(cells);
    });
    SkateTrack.downloadCsv(`relatorio_cobertura_${SkateTrack.todayDateString()}.csv`, rows);
  });
}

function renderOperationalTable(rows) {
  const tbody = document.getElementById('operationalTableBody');
  tbody.innerHTML = rows.length ? rows.map(row => `
    <tr>
      <td>${SkateTrack.escapeHtml(row.athlete)}</td>
      <td>${SkateTrack.formatDateOnly(row.date)}</td>
      <td>${SkateTrack.formatTime(row.date)}</td>
      <td>${row.type === 'gps' ? 'GPS' : 'Manual'}</td>
      <td>${SkateTrack.escapeHtml(row.country || '—')}</td>
      <td>${SkateTrack.escapeHtml(row.city || '—')}</td>
      <td>${SkateTrack.escapeHtml(row.location || '—')}</td>
      <td>${SkateTrack.escapeHtml(row.observation || '—')}</td>
    </tr>
  `).join('') : '<tr><td colspan="8">Nenhum registro operacional encontrado.</td></tr>';
}

function renderCoverageTable(rows) {
  const tbody = document.getElementById('coverageTableBody');
  tbody.innerHTML = rows.length ? rows.map(row => `
    <tr>
      <td>${SkateTrack.escapeHtml(row.athlete)}</td>
      <td>${SkateTrack.escapeHtml(row.social_name || '—')}</td>
      <td>${SkateTrack.escapeHtml(row.sex || '—')}</td>
      <td>${row.birth_date ? SkateTrack.formatDateOnly(row.birth_date) : '—'}</td>
      <td>${SkateTrack.escapeHtml(row.rg || '—')}</td>
      <td>${SkateTrack.escapeHtml(row.cpf || '—')}</td>
      <td>${SkateTrack.escapeHtml(row.origin || '—')}</td>
      <td>${SkateTrack.escapeHtml(row.destination || '—')}</td>
      <td>${SkateTrack.escapeHtml(row.period || '—')}</td>
      <td>${SkateTrack.escapeHtml(row.reason || '—')}</td>
      <td>${SkateTrack.escapeHtml(row.notes || '—')}</td>
    </tr>
  `).join('') : '<tr><td colspan="11">Nenhum plano encontrado.</td></tr>';
}
