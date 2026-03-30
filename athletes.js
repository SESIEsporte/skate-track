const ADMIN_SUPABASE_URL = 'https://knfockwyslspdxyuokvv.supabase.co';
const ADMIN_SUPABASE_ANON_KEY = 'sb_publishable_c_F2FA-vcunpHa6PQAgkgA_Frb6x00A';

let athleteRows = [];
let athleteMap = new Map();
let latestCheckinByAthlete = new Map();
let currentUserRole = 'admin';

function getAdminScopedClient() {
  return window.supabase.createClient(ADMIN_SUPABASE_URL, ADMIN_SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  SkateTrack.attachSidebarToggle();
  const notice = document.getElementById('pageNotice');
  const modal = document.getElementById('athleteModal');
  const closeButtons = modal.querySelectorAll('[data-close-modal]');
  closeButtons.forEach(button => button.addEventListener('click', closeAthleteModal));
  modal.addEventListener('click', event => { if (event.target === modal) closeAthleteModal(); });

  try {
    const sessionData = await SkateTrack.getSessionProfile(['admin', 'manager']);
    if (!sessionData) return;
    currentUserRole = sessionData.profile.role;
    SkateTrack.renderShell({ role: currentUserRole, activePage: 'athletes.html', profile: sessionData.profile });
    SkateTrack.injectTopbarTitle('Atletas', currentUserRole === 'admin' ? 'Base administrativa do cadastro de atletas.' : 'Consulta da base de atletas ativos e inativos.');
    bindAthleteActions();
    await loadAthletes(notice);
  } catch (error) {
    console.error(error);
    SkateTrack.setNotice(notice, error.message || 'Falha ao carregar atletas.', 'error');
  }
});

function bindAthleteActions() {
  document.getElementById('searchAthlete').addEventListener('input', filterAthletes);
  document.getElementById('openNewAthlete').addEventListener('click', () => openAthleteModal(null));
  if (currentUserRole !== 'admin') {
    document.getElementById('openNewAthlete')?.classList.add('hidden');
  }
}

async function loadAthletes(notice) {
  SkateTrack.setNotice(notice, 'Buscando atletas...', 'muted');
  const dateRange = SkateTrack.todayRange();
  const athleteSource = SkateTrack.getAthleteDirectorySource(currentUserRole);
  const [{ data: athletes, error: athleteError }, { data: checkins, error: checkinError }] = await Promise.all([
    window.sb.from(athleteSource).select('*').eq('role', 'athlete').order('full_name', { ascending: true }),
    window.sb.from('checkins').select('id, athlete_id, checkin_at').gte('checkin_at', dateRange.start).lt('checkin_at', dateRange.end).order('checkin_at', { ascending: false })
  ]);

  if (athleteError) throw athleteError;
  if (checkinError) throw checkinError;

  athleteRows = athletes || [];
  athleteMap = new Map(athleteRows.map(item => [item.id, item]));
  latestCheckinByAthlete = new Map();
  (checkins || []).forEach(item => { if (!latestCheckinByAthlete.has(item.athlete_id)) latestCheckinByAthlete.set(item.athlete_id, item); });

  document.getElementById('activeAthletesCount').textContent = athleteRows.filter(item => item.active).length;
  syncAthletesTableHead();

  const tbody = document.getElementById('athletesTableBody');
  const colspan = currentUserRole === 'admin' ? 6 : 5;
  tbody.innerHTML = athleteRows.map(athlete => {
    const latestCheckin = latestCheckinByAthlete.get(athlete.id);
    const actionLabel = currentUserRole === 'admin' ? 'Abrir cadastro' : 'Ver perfil';
    const cells = [
      `<td><strong>${SkateTrack.escapeHtml(athlete.full_name || athlete.username)}</strong>${athlete.social_name ? `<br><span class="muted small">${SkateTrack.escapeHtml(athlete.social_name)}</span>` : ''}</td>`,
      `<td>${SkateTrack.escapeHtml(athlete.username || '—')}</td>`,
      `<td><span class="status-pill ${athlete.active ? 'success' : 'danger'}">${athlete.active ? 'Ativo' : 'Inativo'}</span></td>`
    ];
    if (currentUserRole === 'admin') {
      cells.push(`<td>${athlete.birth_date ? SkateTrack.formatDateOnly(athlete.birth_date) : '—'}</td>`);
    }
    cells.push(`<td>${latestCheckin ? SkateTrack.formatDateTime(latestCheckin.checkin_at) : '—'}</td>`);
    cells.push(`<td><button class="secondary-button" data-edit-athlete="${athlete.id}">${actionLabel}</button></td>`);
    return `<tr data-athlete-row data-search="${SkateTrack.escapeHtml(`${athlete.full_name || ''} ${athlete.social_name || ''} ${athlete.username || ''}`.toLowerCase())}">${cells.join('')}</tr>`;
  }).join('') || `<tr><td colspan="${colspan}">Nenhum atleta encontrado.</td></tr>`;

  document.querySelectorAll('[data-edit-athlete]').forEach(button => {
    button.addEventListener('click', () => openAthleteModal(button.dataset.editAthlete));
  });

  SkateTrack.setNotice(notice, '', 'muted');
}

function syncAthletesTableHead() {
  const head = document.getElementById('athletesTableHead');
  if (!head) return;
  const columns = ['Nome', 'Usuário', 'Status'];
  if (currentUserRole === 'admin') columns.push('Nascimento');
  columns.push('Último check-in', 'Ação');
  head.innerHTML = `<tr>${columns.map(label => `<th>${label}</th>`).join('')}</tr>`;
}

function filterAthletes() {
  const value = document.getElementById('searchAthlete').value.trim().toLowerCase();
  document.querySelectorAll('[data-athlete-row]').forEach(row => {
    row.classList.toggle('hidden', value && !row.dataset.search.includes(value));
  });
}

function openAthleteModal(athleteId = null) {
  const form = document.getElementById('athleteForm');
  const modal = document.getElementById('athleteModal');
  const modalNotice = document.getElementById('modalNotice');
  const submitButton = form.querySelector('button[type="submit"]');
  const isAdmin = currentUserRole === 'admin';

  SkateTrack.setNotice(modalNotice, '', 'muted');
  form.reset();
  form.elements.id.value = '';
  form.elements.active.value = 'true';
  form.elements.initial_password.required = false;
  form.querySelectorAll('[data-sensitive-field]').forEach(field => field.classList.toggle('hidden', !isAdmin));
  form.querySelectorAll('[data-admin-only]').forEach(field => field.classList.toggle('hidden', !isAdmin));
  submitButton.classList.toggle('hidden', !isAdmin);

  form.querySelectorAll('input, select').forEach(element => {
    if (element.name === 'id') return;
    element.disabled = !isAdmin;
  });

  if (athleteId) {
    const athlete = athleteMap.get(athleteId);
    if (!athlete) return;
    document.getElementById('modalTitle').textContent = athlete.full_name || athlete.username;
    document.getElementById('modalSubtitle').textContent = athlete.username || '';
    form.elements.id.value = athlete.id;
    form.elements.full_name.value = athlete.full_name || '';
    form.elements.social_name.value = athlete.social_name || '';
    form.elements.username.value = athlete.username || '';
    form.elements.sex.value = athlete.sex || '';
    form.elements.birth_date.value = athlete.birth_date || '';
    form.elements.rg.value = athlete.rg || '';
    form.elements.cpf.value = athlete.cpf || '';
    form.elements.active.value = String(athlete.active);
    form.elements.initial_password.value = '';
    form.elements.initial_password.parentElement.classList.add('hidden');
  } else {
    if (!isAdmin) return;
    document.getElementById('modalTitle').textContent = 'Novo atleta';
    document.getElementById('modalSubtitle').textContent = 'Criar acesso inicial do atleta';
    form.elements.initial_password.required = true;
    form.querySelectorAll('input, select').forEach(element => {
      if (element.name === 'id') return;
      element.disabled = false;
    });
  }

  form.onsubmit = async (event) => {
    event.preventDefault();
    submitButton.disabled = true;
    submitButton.textContent = 'Salvando...';

    try {
      if (!isAdmin) throw new Error('Seu perfil é somente leitura.');
      if (form.elements.id.value) {
        await updateAthlete(form.elements.id.value, form);
        SkateTrack.setNotice(document.getElementById('pageNotice'), 'Cadastro atualizado com sucesso.', 'success');
      } else {
        await createAthlete(form);
        SkateTrack.setNotice(document.getElementById('pageNotice'), 'Novo atleta criado com sucesso.', 'success');
      }
      closeAthleteModal();
      await loadAthletes(document.getElementById('pageNotice'));
    } catch (error) {
      console.error(error);
      SkateTrack.setNotice(modalNotice, error.message || 'Não foi possível salvar o atleta.', 'error');
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Salvar atleta';
    }
  };

  modal.classList.add('open');
}

async function updateAthlete(athleteId, form) {
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
  const { error } = await window.sb.from('profiles').update(payload).eq('id', athleteId);
  if (error) throw error;
}

async function createAthlete(form) {
  const username = form.elements.username.value.trim().toLowerCase();
  const password = form.elements.initial_password.value.trim();
  if (!username) throw new Error('Informe o usuário do atleta.');
  if (password.length < 6) throw new Error('A senha inicial precisa ter ao menos 6 caracteres.');

  const isolated = getAdminScopedClient();
  const email = SkateTrack.usernameToEmail(username);
  const signUpResult = await isolated.auth.signUp({ email, password });
  if (signUpResult.error) throw signUpResult.error;

  const userId = signUpResult.data.user?.id;
  if (!userId) throw new Error('Não foi possível criar o acesso do atleta.');

  const profilePayload = {
    id: userId,
    username,
    full_name: form.elements.full_name.value.trim() || null,
    social_name: form.elements.social_name.value.trim() || null,
    role: 'athlete',
    active: form.elements.active.value === 'true',
    sex: form.elements.sex.value || null,
    birth_date: form.elements.birth_date.value || null,
    rg: form.elements.rg.value.trim() || null,
    cpf: form.elements.cpf.value.trim() || null,
    updated_at: new Date().toISOString()
  };

  const { error } = await window.sb.from('profiles').upsert(profilePayload, { onConflict: 'id' });
  if (error) throw error;
}

function closeAthleteModal() {
  document.getElementById('athleteModal').classList.remove('open');
  document.getElementById('athleteForm').reset();
  SkateTrack.setNotice(document.getElementById('modalNotice'), '', 'muted');
}
