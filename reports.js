document.addEventListener('DOMContentLoaded', async () => {
  SkateTrack.attachSidebarToggle();
  const notice = document.getElementById('pageNotice');

  try {
    const sessionData = await SkateTrack.getSessionProfile('admin');
    if (!sessionData) return;
    SkateTrack.renderShell({ role: 'admin', activePage: 'reports.html', profile: sessionData.profile });
    SkateTrack.injectTopbarTitle('Relatórios', 'Saída administrativa e operacional em planilha.');
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
let filteredOperationalRows = [];
let filteredCoverageRows = [];

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

  const profileMap = new Map((profiles || []).map(item => [item.id, item]));
  operationalRows = (checkins || []).map(item => ({
    athlete: profileMap.get(item.athlete_id)?.full_name || profileMap.get(item.athlete_id)?.username || '—',
    date: item.checkin_at,
    type: item.location_type,
    country: item.country || '',
    city: item.city || '',
    location: item.location_name || '',
    observation: item.observation || ''
  }));

  coverageRows = (plans || []).map(item => {
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

  filteredOperationalRows = [...operationalRows];
  filteredCoverageRows = [...coverageRows];
  renderOperationalTable(filteredOperationalRows);
  renderCoverageTable(filteredCoverageRows);
  SkateTrack.setNotice(notice, '', 'muted');
}

function bindFilters() {
  const athleteFilter = document.getElementById('athleteFilter');
  const dateFilter = document.getElementById('dateFilter');
  const apply = () => {
    const athlete = athleteFilter.value.trim().toLowerCase();
    const date = dateFilter.value;

    filteredOperationalRows = operationalRows.filter(row => {
      const matchesAthlete = !athlete || row.athlete.toLowerCase().includes(athlete);
      const matchesDate = !date || row.date.startsWith(date);
      return matchesAthlete && matchesDate;
    });

    filteredCoverageRows = coverageRows.filter(row => !athlete || row.athlete.toLowerCase().includes(athlete));
    renderOperationalTable(filteredOperationalRows);
    renderCoverageTable(filteredCoverageRows);
  };

  athleteFilter.addEventListener('input', apply);
  dateFilter.addEventListener('change', apply);
}

function buildStyledWorksheet(title, rows, generatedAt) {
  const headers = Object.keys(rows[0] || {}).length ? Object.keys(rows[0]) : ['Sem dados'];
  const dataRows = rows.length ? rows.map(row => headers.map(header => row[header])) : [['Nenhum registro encontrado']];
  const aoa = [
    [title],
    [`Gerado em ${generatedAt}`],
    [],
    headers,
    ...dataRows
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  worksheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(headers.length - 1, 0) } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: Math.max(headers.length - 1, 0) } }
  ];

  const widths = headers.map((header, index) => ({
    wch: Math.max(
      String(header || '').length,
      ...dataRows.map(row => String(row[index] || '').length),
      14
    ) + 2
  }));
  worksheet['!cols'] = widths;

  const range = XLSX.utils.decode_range(worksheet['!ref']);
  worksheet['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 3, c: 0 }, e: { r: range.e.r, c: range.e.c } }) };
  worksheet['!freeze'] = { xSplit: 0, ySplit: 4 };

  if (worksheet['A1']) worksheet['A1'].s = {
    font: { bold: true, sz: 15, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: 'B5121B' } },
    alignment: { horizontal: 'center', vertical: 'center' }
  };
  if (worksheet['A2']) worksheet['A2'].s = {
    font: { italic: true, sz: 11, color: { rgb: '475467' } },
    alignment: { horizontal: 'left', vertical: 'center' }
  };

  headers.forEach((_, index) => {
    const cell = worksheet[XLSX.utils.encode_cell({ r: 3, c: index })];
    if (cell) {
      cell.s = {
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '1F2937' } },
        alignment: { horizontal: 'center', vertical: 'center' }
      };
    }
  });

  return worksheet;
}

function exportToXlsx(filename, rows, sheetName, reportTitle) {
  const generatedAt = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  }).format(new Date());

  const worksheet = buildStyledWorksheet(reportTitle, rows, generatedAt);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, filename);
}

function bindExports() {
  document.getElementById('exportOperational').addEventListener('click', () => {
    const rows = filteredOperationalRows.map(row => ({
      Atleta: row.athlete,
      Data: SkateTrack.formatDateOnly(row.date),
      Hora: SkateTrack.formatTime(row.date),
      Tipo: row.type === 'gps' ? 'GPS' : 'Manual',
      País: row.country || '—',
      Cidade: row.city || '—',
      Local: row.location || '—',
      Observação: row.observation || '—'
    }));
    exportToXlsx(`relatorio_checkins_${SkateTrack.todayDateString()}.xlsx`, rows, 'Checkins', 'Relatório de Check-ins');
  });

  document.getElementById('exportCoverage').addEventListener('click', () => {
    const rows = filteredCoverageRows.map(row => ({
      'Nome completo': row.athlete,
      'Nome social': row.social_name || '—',
      Sexo: row.sex || '—',
      Nascimento: row.birth_date ? SkateTrack.formatDateOnly(row.birth_date) : '—',
      RG: row.rg || '—',
      CPF: row.cpf || '—',
      Origem: row.origin || '—',
      Destino: row.destination || '—',
      Período: row.period || '—',
      Motivo: row.reason || '—',
      Observação: row.notes || '—'
    }));
    exportToXlsx(`relatorio_planos_${SkateTrack.todayDateString()}.xlsx`, rows, 'Planos', 'Relatório de Planos');
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
