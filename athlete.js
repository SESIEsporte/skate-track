let athleteProfile;
let athleteState = { checkins: [], plans: [] };
let manualLocationController;

document.addEventListener('DOMContentLoaded', async () => {
  SkateTrack.attachSidebarToggle();
  const notice = document.getElementById('pageNotice');

  try {
    const sessionData = await SkateTrack.getSessionProfile('athlete');
    if (!sessionData) return;
    athleteProfile = sessionData.profile;
    SkateTrack.renderShell({ role: 'athlete', activePage: 'athlete.html', profile: athleteProfile });
    SkateTrack.injectTopbarTitle('Meu dia', 'Check-in rápido e acompanhamento do dia.');
    document.getElementById('athleteName').textContent = athleteProfile.social_name || athleteProfile.full_name || athleteProfile.username;
    document.getElementById('todayDate').textContent = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(new Date());
    document.getElementById('athleteAccent').style.background = SkateTrack.getAthleteColor(hashString(athleteProfile.id || athleteProfile.username || '1'));

    bindAthleteActions();
    initLocationLists();
    initPasswordModal();
    await refreshAthleteView(notice);
  } catch (error) {
    console.error(error);
    SkateTrack.setNotice(notice, error.message || 'Falha ao carregar a área do atleta.', 'error');
  }
});

function bindAthleteActions() {
  bindGpsButtons();
  bindManualModal();
}

function bindGpsButtons() {
  const desktop = document.getElementById('gpsCheckinButton');
  const mobile = document.getElementById('gpsCheckinButtonMobile');
  [desktop, mobile].forEach(button => button?.addEventListener('click', submitGpsCheckin));
}

async function submitGpsCheckin() {
  const pageNotice = document.getElementById('pageNotice');
  toggleGpsButtons(true, 'Capturando...');
  SkateTrack.setNotice(pageNotice, 'Capturando localização atual...', 'muted');

  try {
    const position = await getCurrentPosition();
    const coords = position.coords;
    let address = { country: '', state_region: '', city: '', location_name: '' };
    try {
      address = await SkateTrack.reverseGeocode(coords.latitude, coords.longitude);
    } catch (error) {
      console.warn('Reverse geocoding indisponível:', error.message);
    }

    const payload = {
      athlete_id: athleteProfile.id,
      checkin_at: new Date().toISOString(),
      location_type: 'gps',
      latitude: coords.latitude,
      longitude: coords.longitude,
      gps_accuracy_meters: coords.accuracy,
      country: address.country || null,
      state_region: address.state_region || null,
      city: address.city || null,
      location_name: address.location_name || null,
      observation: null,
    };

    const { error } = await window.sb.from('checkins').insert(payload);
    if (error) throw error;
    SkateTrack.setNotice(pageNotice, 'Check-in registrado com sucesso.', 'success');
    await refreshAthleteView(pageNotice);
  } catch (error) {
    console.error(error);
    const message = error.code === 1
      ? 'A localização foi bloqueada no navegador. Use o registro manual.'
      : (error.message || 'Não foi possível registrar o check-in.');
    SkateTrack.setNotice(pageNotice, message, 'error');
  } finally {
    toggleGpsButtons(false, 'Usar localização atual');
  }
}

function toggleGpsButtons(disabled, label) {
  ['gpsCheckinButton', 'gpsCheckinButtonMobile'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.disabled = disabled;
    el.textContent = label;
  });
}

function bindManualModal() {
  const modal = document.getElementById('manualCheckinModal');
  const form = document.getElementById('manualCheckinForm');
  const openButtons = [document.getElementById('openManualCheckin'), document.getElementById('openManualCheckinMobile')];
  openButtons.forEach(button => button?.addEventListener('click', () => openManualModal()));
  modal.querySelectorAll('[data-close-manual]').forEach(button => button.addEventListener('click', closeManualModal));
  modal.addEventListener('click', event => { if (event.target === modal) closeManualModal(); });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const notice = document.getElementById('manualNotice');
    const submitButton = document.getElementById('manualSubmitButton');
    submitButton.disabled = true;
    submitButton.textContent = 'Salvando...';
    SkateTrack.setNotice(notice, 'Salvando registro...', 'muted');

    const formData = new FormData(form);
    const checkinId = formData.get('manualCheckinId')?.toString().trim();
    const payload = {
      athlete_id: athleteProfile.id,
      country: formData.get('country')?.toString().trim() || null,
      state_region: formData.get('state_region')?.toString().trim() || null,
      city: formData.get('city')?.toString().trim() || null,
      location_name: formData.get('location_name')?.toString().trim() || null,
      observation: formData.get('observation')?.toString().trim() || null,
      location_type: 'manual'
    };

    try {
      let checkinRecordId = checkinId;
      if (checkinId) {
        const target = athleteState.checkins.find(item => item.id === checkinId);
        if (!target || !isToday(target.checkin_at)) throw new Error('Este check-in manual não pode mais ser editado.');
        const { error } = await window.sb.from('checkins').update(payload).eq('id', checkinId).eq('athlete_id', athleteProfile.id);
        if (error) throw error;
      } else {
        payload.checkin_at = new Date().toISOString();
        const { data, error } = await window.sb.from('checkins').insert(payload).select('id').single();
        if (error) throw error;
        checkinRecordId = data.id;
      }

      await upsertManualGeocoding(checkinRecordId, payload);
      SkateTrack.setNotice(document.getElementById('pageNotice'), checkinId ? 'Check-in manual atualizado.' : 'Check-in manual registrado com sucesso.', 'success');
      closeManualModal();
      await refreshAthleteView(document.getElementById('pageNotice'));
    } catch (error) {
      console.error(error);
      SkateTrack.setNotice(notice, error.message || 'Falha ao salvar check-in manual.', 'error');
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Salvar check-in';
    }
  });
}

async function openManualModal(checkin = null) {
  const modal = document.getElementById('manualCheckinModal');
  const form = document.getElementById('manualCheckinForm');
  document.getElementById('manualModalTitle').textContent = checkin ? 'Editar check-in manual' : 'Check-in manual';
  SkateTrack.setNotice(document.getElementById('manualNotice'), '', 'muted');
  if (checkin) {
    document.getElementById('manualCheckinId').value = checkin.id;
    form.country.value = checkin.country || '';
    form.location_name.value = checkin.location_name || '';
    form.observation.value = checkin.observation || '';
    await manualLocationController?.hydrate({
      country: checkin.country || '',
      state: checkin.state_region || '',
      city: checkin.city || ''
    });
  } else {
    form.reset();
    document.getElementById('manualCheckinId').value = '';
    manualLocationController?.reset();
  }
  modal.classList.add('open');
}

function closeManualModal() {
  document.getElementById('manualCheckinModal').classList.remove('open');
}

async function upsertManualGeocoding(checkinId, payload) {
  try {
    await SkateTrack.geocodeManualWithGeoapify({
      checkinId,
      country: payload.country,
      state: payload.state_region,
      city: payload.city
    });
  } catch (error) {
    console.warn('Geocodificação manual não concluída:', error.message);
  }
}

async function refreshAthleteView(noticeEl) {
  const { start, end } = SkateTrack.todayRange();
  const { data: checkins, error: checkinsError } = await window.sb
    .from('checkins')
    .select('*, checkin_geocoding(*)')
    .eq('athlete_id', athleteProfile.id)
    .gte('checkin_at', start)
    .lt('checkin_at', end)
    .order('checkin_at', { ascending: false });
  if (checkinsError) throw checkinsError;

  const { data: plans, error: plansError } = await window.sb
    .from('plans')
    .select('*')
    .eq('athlete_id', athleteProfile.id)
    .order('start_date', { ascending: false });
  if (plansError) throw plansError;

  athleteState.checkins = checkins || [];
  athleteState.plans = plans || [];

  renderSummary(checkins || [], plans || []);
  renderHistory(checkins || []);
  renderWeekPlans(plans || []);
  if (noticeEl && noticeEl.classList.contains('muted')) SkateTrack.setNotice(noticeEl, '', 'muted');
}

function renderSummary(checkins, plans) {
  const weekPlans = plans.filter(plan => SkateTrack.isPlanInCurrentWeek(plan));
  document.getElementById('todayCount').textContent = checkins.length;
  document.getElementById('weekPlansCount').textContent = weekPlans.length;

  const latest = checkins[0];
  const statusText = document.getElementById('todayStatusText');
  const statusMeta = document.getElementById('todayStatusMeta');
  if (latest) {
    statusText.textContent = 'Check-in realizado';
    statusMeta.textContent = `${SkateTrack.formatTime(latest.checkin_at)} • ${latest.location_type === 'gps' ? 'GPS' : 'Manual'}`;
  } else {
    statusText.textContent = 'Pendente';
    statusMeta.textContent = 'Nenhum check-in realizado hoje';
  }
}

function renderHistory(checkins) {
  const container = document.getElementById('historyContainer');
  if (!checkins.length) {
    container.innerHTML = '<div class="empty-state compact-empty">Nenhum check-in realizado hoje.</div>';
    return;
  }

  container.innerHTML = checkins.slice(0, 5).map(item => {
    const canEdit = item.location_type === 'manual' && isToday(item.checkin_at);
    const location = [item.city, item.location_name, item.country].filter(Boolean).join(' • ') || 'Sem local detalhado';
    return `
      <article class="history-row-item">
        <div>
          <p class="history-main">${SkateTrack.formatTime(item.checkin_at)} • ${item.location_type === 'gps' ? 'GPS' : 'Manual'}</p>
          <p class="history-sub">${SkateTrack.escapeHtml(location)}</p>
        </div>
        ${canEdit ? `<button class="inline-link-button" type="button" data-edit-checkin="${item.id}">Editar</button>` : '<span class="history-lock">Fechado</span>'}
      </article>
    `;
  }).join('');

  container.querySelectorAll('[data-edit-checkin]').forEach(button => {
    button.addEventListener('click', () => {
      const target = athleteState.checkins.find(item => item.id === button.dataset.editCheckin);
      if (target) openManualModal(target);
    });
  });
}

function renderWeekPlans(plans) {
  const container = document.getElementById('weekPlans');
  const weekPlans = plans.filter(plan => SkateTrack.isPlanInCurrentWeek(plan));
  if (!weekPlans.length) {
    container.innerHTML = '<div class="empty-state compact-empty">Nenhum plano cadastrado para a semana vigente.</div>';
    return;
  }

  container.innerHTML = weekPlans.map(plan => `
    <article class="week-plan-row">
      <div>
        <p class="item-title">${SkateTrack.escapeHtml(SkateTrack.buildPlanSummary(plan))}</p>
        <p class="item-meta">${SkateTrack.formatDateOnly(plan.start_date)} até ${SkateTrack.formatDateOnly(plan.end_date)}</p>
      </div>
      <a class="inline-link-button" href="plans.html?edit=${plan.id}">Abrir</a>
    </article>
  `).join('');
}

function initLocationLists() {
  SkateTrack.populateCountryList('countryOptions');
  manualLocationController = SkateTrack.createLocationController({
    countryInput: document.getElementById('country'),
    stateInput: document.getElementById('state_region'),
    cityInput: document.getElementById('city'),
    stateListId: 'stateOptions',
    cityListId: 'cityOptions'
  });
}

function initPasswordModal() {
  const openButton = document.getElementById('changePasswordOpen');
  const modal = document.getElementById('passwordModal');
  const form = document.getElementById('passwordForm');
  openButton?.addEventListener('click', () => modal.classList.add('open'));
  modal.querySelectorAll('[data-close-password]').forEach(button => button.addEventListener('click', closePasswordModal));
  modal.addEventListener('click', event => { if (event.target === modal) closePasswordModal(); });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const notice = document.getElementById('passwordNotice');
    const newPassword = document.getElementById('newPassword').value.trim();
    const confirmPassword = document.getElementById('confirmPassword').value.trim();
    if (newPassword.length < 6) return SkateTrack.setNotice(notice, 'A senha precisa ter ao menos 6 caracteres.', 'warning');
    if (newPassword !== confirmPassword) return SkateTrack.setNotice(notice, 'A confirmação da senha não confere.', 'warning');

    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Salvando...';
    try {
      const { error } = await window.sb.auth.updateUser({ password: newPassword });
      if (error) throw error;
      SkateTrack.setNotice(notice, 'Senha atualizada com sucesso.', 'success');
      form.reset();
      setTimeout(closePasswordModal, 900);
    } catch (error) {
      console.error(error);
      SkateTrack.setNotice(notice, error.message || 'Não foi possível alterar a senha.', 'error');
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Salvar senha';
    }
  });
}

function closePasswordModal() {
  document.getElementById('passwordModal').classList.remove('open');
  document.getElementById('passwordForm').reset();
  SkateTrack.setNotice(document.getElementById('passwordNotice'), '', 'muted');
}

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocalização não suportada neste navegador.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 0,
    });
  });
}

function debounce(fn, wait = 300) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), wait);
  };
}

function isToday(dateValue) {
  return new Date(dateValue).toDateString() === new Date().toDateString();
}

function hashString(value) {
  return String(value).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
}
