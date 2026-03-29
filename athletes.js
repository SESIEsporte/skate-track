document.addEventListener('DOMContentLoaded', async () => {
  SkateTrack.attachSidebarToggle();
  const notice = document.getElementById('pageNotice');
  const modal = document.getElementById('athleteModal');
  const closeButtons = modal.querySelectorAll('[data-close-modal]');
  closeButtons.forEach(button => button.addEventListener('click', () => modal.classList.remove('open')));
  modal.addEventListener('click', event => { if (event.target === modal) modal.classList.remove('open'); });

  try {
    const sessionData = await SkateTrack.getSessionProfile('admin');
    if (!sessionData) return;
    SkateTrack.renderShell({ role: 'admin', activePage: 'athletes.html', profile: sessionData.profile });
    SkateTrack.injectTopbarTitle('Atletas', 'Base administrativa com edição real do cadastro pessoal já existente no Supabase.');
    await loadAthletes(notice);
    document.getElementById('searchAthlete').addEventListener('input', () => filterAthletes());
  } catch (error) {
    console.error(error);
    SkateTrack.setNotice(notice, error.message || 'Falha ao carregar atletas.', 'error');
  }
});

let athleteRows = [];
let athleteMap = new Map();

async function loadAthletes(notice) {
  SkateTrack.setNotice(notice, 'Buscando atletas...', 'muted');
  const [{ data: athletes, error: athleteError }, { data: checkins, error: checkinError }, { data: plans, error: plansError }] = await Promise.all([
    window.sb.from('profiles').select('*').eq('role', 'athlete').order('full_name', { ascending: true }),
    window.sb.from('checkins').select('id, athlete_id, checkin_at, location_type, city, country').order('checkin_at', { ascending: false }),
    window.sb.from('plans').select('id, athlete_id, start_date, end_date, destination_city, destination_country').order('start_date', { ascending: false })
  ]);

  if (athleteError) throw athleteError;
  if (checkinError) throw checkinError;
  if (plansError) throw plansError;

  athleteRows = athletes;
  athleteMap = new Map(athletes.map(item => [item.id, item]));

  const latestCheckinByAthlete = new Map();
  checkins.forEach(item => { if (!latestCheckinByAthlete.has(item.athlete_id)) latestCheckinByAthlete.set(item.athlete_id, item); });
  const latestPlanByAthlete = new Map();
  plans.forEach(item => { if (!latestPlanByAthlete.has(item.athlete_id)) latestPlanByAthlete.set(item.athlete_id, item); });

  document.getElementById('athletesCount').textContent = athletes.length;
  document.getElementById('activeAthletesCount').textContent = athletes.filter(item => item.active).length;
  document.getElementById('withCpfCount').textContent = athletes.filter(item => item.cpf).length;

  const tbody = document.getElementById('athletesTableBody');
  tbody.innerHTML = athletes.map(athlete => {
    const latestCheckin = latestCheckinByAthlete.get(athlete.id);
    const latestPlan = latestPlanByAthlete.get(athlete.id);
    return `
      <tr data-athlete-row data-search="${SkateTrack.escapeHtml(`${athlete.full_name || ''} ${athlete.social_name || ''} ${athlete.username || ''}`.toLowerCase())}">
        <td><strong>${SkateTrack.escapeHtml(athlete.full_name || athlete.username)}</strong><br><span class="muted small">${SkateTrack.escapeHtml(athlete.social_name || '')}</span></td>
        <td>${SkateTrack.escapeHtml(athlete.username || '—')}</td>
        <td><span class="status-pill ${athlete.active ? 'success' : 'danger'}">${athlete.active ? 'Ativo' : 'Inativo'}</span></td>
        <td>${athlete.birth_date ? SkateTrack.formatDateOnly(athlete.birth_date) : '—'}</td>
        <td>${latestCheckin ? SkateTrack.formatDateTime(latestCheckin.checkin_at) : '—'}</td>
        <td>${latestPlan ? SkateTrack.escapeHtml([latestPlan.destination_city, latestPlan.destination_country].filter(Boolean).join(' / ') || '—') : '—'}</td>
        <td><button class="secondary-button" data-edit-athlete="${athlete.id}">Abrir cadastro</button></td>
      </tr>
    `;
  }).join('') || '<tr><td colspan="7">Nenhum atleta encontrado.</td></tr>';

  document.querySelectorAll('[data-edit-athlete]').forEach(button => {
    button.addEventListener('click', async () => openAthleteModal(button.dataset.editAthlete, latestCheckinByAthlete, latestPlanByAthlete));
  });

  SkateTrack.setNotice(notice, '', 'muted');
}

function filterAthletes() {
  const value = document.getElementById('searchAthlete').value.trim().toLowerCase();
  document.querySelectorAll('[data-athlete-row]').forEach(row => {
    row.classList.toggle('hidden', value && !row.dataset.search.includes(value));
  });
}

async function openAthleteModal(athleteId, latestCheckinByAthlete, latestPlanByAthlete) {
  const athlete = athleteMap.get(athleteId);
  if (!athlete) return;

  const modal = document.getElementById('athleteModal');
  const form = document.getElementById('athleteForm');
  const futurePanel = document.getElementById('futureCoverageFields');
  document.getElementById('modalTitle').textContent = athlete.full_name || athlete.username;
  document.getElementById('modalSubtitle').textContent = athlete.username;
  form.elements.id.value = athlete.id;
  form.elements.full_name.value = athlete.full_name || '';
  form.elements.social_name.value = athlete.social_name || '';
  form.elements.username.value = athlete.username || '';
  form.elements.sex.value = athlete.sex || '';
  form.elements.birth_date.value = athlete.birth_date || '';
  form.elements.rg.value = athlete.rg || '';
  form.elements.cpf.value = athlete.cpf || '';
  form.elements.active.value = String(athlete.active);
  document.getElementById('operationalHistory').innerHTML = buildOperationalSummary(latestCheckinByAthlete.get(athleteId), latestPlanByAthlete.get(athleteId));
  futurePanel.innerHTML = `
    <div class="notice">
      Campos administrativos como unidade responsável, referência, categoria e situação ainda não existem na base atual. A interface foi reservada para expansão futura, sem simular persistência inexistente.
    </div>
  `;

  form.onsubmit = async (event) => {
    event.preventDefault();
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Salvando...';
    const payload = {
      full_name: form.elements.full_name.value.trim() || null,
      social_name: form.elements.social_name.value.trim() || null,
      username: form.elements.username.value.trim() || null,
      sex: form.elements.sex.value || null,
      birth_date: form.elements.birth_date.value || null,
      rg: form.elements.rg.value.trim() || null,
      cpf: form.elements.cpf.value.trim() || null,
      active: form.elements.active.value === 'true',
      updated_at: new Date().toISOString()
    };

    try {
      const { error } = await window.sb.from('profiles').update(payload).eq('id', athleteId);
      if (error) throw error;
      modal.classList.remove('open');
      await loadAthletes(document.getElementById('pageNotice'));
      SkateTrack.setNotice(document.getElementById('pageNotice'), 'Cadastro atualizado com sucesso.', 'success');
    } catch (error) {
      console.error(error);
      SkateTrack.setNotice(document.getElementById('modalNotice'), error.message || 'Falha ao salvar cadastro.', 'error');
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Salvar alterações';
    }
  };

  SkateTrack.setNotice(document.getElementById('modalNotice'), '', 'muted');
  modal.classList.add('open');
}

function buildOperationalSummary(checkin, plan) {
  const blocks = [];
  if (checkin) {
    blocks.push(`
      <article class="record-item">
        <div class="record-item-head">
          <div>
            <p class="item-title">Último check-in</p>
            <p class="item-meta">${SkateTrack.formatDateTime(checkin.checkin_at)} • ${checkin.location_type === 'gps' ? 'GPS' : 'Manual'}</p>
          </div>
        </div>
        <div class="item-grid">
          <div><strong>País</strong>${SkateTrack.escapeHtml(checkin.country || '—')}</div>
          <div><strong>Cidade</strong>${SkateTrack.escapeHtml(checkin.city || '—')}</div>
        </div>
      </article>
    `);
  }
  if (plan) {
    blocks.push(`
      <article class="record-item">
        <div class="record-item-head">
          <div>
            <p class="item-title">Plano mais recente</p>
            <p class="item-meta">${SkateTrack.formatDateOnly(plan.start_date)} até ${SkateTrack.formatDateOnly(plan.end_date)}</p>
          </div>
        </div>
        <div class="item-grid">
          <div><strong>Destino</strong>${SkateTrack.escapeHtml([plan.destination_city, plan.destination_country].filter(Boolean).join(' / ') || '—')}</div>
        </div>
      </article>
    `);
  }
  return blocks.length ? blocks.join('') : '<div class="empty-state">Sem histórico operacional recente para exibir.</div>';
}
