let plansProfile;
let plansState = [];
let originLocationController;
let destinationLocationController;

document.addEventListener('DOMContentLoaded', async () => {
  SkateTrack.attachSidebarToggle();
  const notice = document.getElementById('pageNotice');
  const list = document.getElementById('plansList');
  const countEl = document.getElementById('plansCount');
  const activeEl = document.getElementById('activePlansCount');

  try {
    const sessionData = await SkateTrack.getSessionProfile('athlete');
    if (!sessionData) return;
    plansProfile = sessionData.profile;
    SkateTrack.renderShell({ role: 'athlete', activePage: 'plans.html', profile: plansProfile });
    SkateTrack.injectTopbarTitle('Meus planos', 'Planejamento de deslocamentos e histórico cadastrado.');

    bindPlanComposer(notice, list, countEl, activeEl);
    initPlanLocationLists();
    initPasswordModal();
    await refreshPlans(plansProfile.id, list, countEl, activeEl);
    handleQueryActions();
  } catch (error) {
    console.error(error);
    SkateTrack.setNotice(notice, error.message || 'Falha ao carregar planos.', 'error');
  }
});

function bindPlanComposer(notice, list, countEl, activeEl) {
  document.getElementById('openPlanComposer')?.addEventListener('click', () => openComposer());
  document.getElementById('closePlanComposer')?.addEventListener('click', closeComposer);
  document.getElementById('cancelPlanEdit')?.addEventListener('click', closeComposer);

  const form = document.getElementById('planForm');
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const submitButton = document.getElementById('planSubmitButton');
    submitButton.disabled = true;
    submitButton.textContent = 'Salvando...';
    SkateTrack.setNotice(notice, 'Salvando plano...', 'muted');

    const formData = new FormData(form);
    const editingId = formData.get('editingPlanId')?.toString().trim();
    const payload = {
      athlete_id: plansProfile.id,
      start_date: formData.get('start_date'),
      end_date: formData.get('end_date'),
      origin_country: formData.get('origin_country')?.toString().trim() || null,
      origin_state: formData.get('origin_state')?.toString().trim() || null,
      origin_city: formData.get('origin_city')?.toString().trim() || null,
      destination_country: formData.get('destination_country')?.toString().trim() || null,
      destination_state: formData.get('destination_state')?.toString().trim() || null,
      destination_city: formData.get('destination_city')?.toString().trim() || null,
      travel_reason: formData.get('travel_reason')?.toString().trim() || null,
      notes: formData.get('notes')?.toString().trim() || null,
    };

    if (payload.end_date < payload.start_date) {
      SkateTrack.setNotice(notice, 'A data final precisa ser igual ou posterior à data inicial.', 'warning');
      submitButton.disabled = false;
      submitButton.textContent = 'Salvar plano';
      return;
    }

    try {
      if (editingId) {
        const target = plansState.find(plan => plan.id === editingId);
        if (!canEditPlan(target)) throw new Error('A edição só está disponível para planos futuros ou em andamento.');
        const { error } = await window.sb.from('plans').update(payload).eq('id', editingId).eq('athlete_id', plansProfile.id);
        if (error) throw error;
        SkateTrack.setNotice(notice, 'Plano atualizado com sucesso.', 'success');
      } else {
        const { error } = await window.sb.from('plans').insert(payload);
        if (error) throw error;
        SkateTrack.setNotice(notice, 'Plano salvo com sucesso.', 'success');
      }
      closeComposer();
      await refreshPlans(plansProfile.id, list, countEl, activeEl);
    } catch (error) {
      console.error(error);
      SkateTrack.setNotice(notice, error.message || 'Não foi possível salvar o plano.', 'error');
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Salvar plano';
    }
  });
}

async function refreshPlans(athleteId, list, countEl, activeEl) {
  const { data, error } = await window.sb
    .from('plans')
    .select('*')
    .eq('athlete_id', athleteId)
    .order('start_date', { ascending: false });

  if (error) throw error;
  plansState = data || [];

  countEl.textContent = plansState.length;
  activeEl.textContent = plansState.filter(plan => SkateTrack.isPlanActive(plan)).length;
  const nextPlan = plansState.find(plan => plan.start_date >= SkateTrack.todayDateString()) || plansState[0];
  document.getElementById('nextWindow').textContent = nextPlan?.start_date ? SkateTrack.formatDateOnly(nextPlan.start_date) : '—';

  if (!plansState.length) {
    list.innerHTML = '<div class="empty-state">Nenhum plano cadastrado até o momento.</div>';
    return;
  }

  list.innerHTML = plansState.map(plan => {
    const editable = canEditPlan(plan);
    const status = getPlanStatus(plan);
    return `
      <article class="plan-item enhanced-plan-item">
        <div class="plan-item-head">
          <div>
            <p class="item-title">${SkateTrack.escapeHtml(SkateTrack.buildPlanSummary(plan))}</p>
            <p class="item-meta">${SkateTrack.formatDateOnly(plan.start_date)} até ${SkateTrack.formatDateOnly(plan.end_date)}</p>
          </div>
          <span class="status-pill ${status.className}">${status.label}</span>
        </div>
        <div class="item-grid">
          <div><strong>Origem</strong>${SkateTrack.escapeHtml([plan.origin_city, plan.origin_state, plan.origin_country].filter(Boolean).join(' / ') || '—')}</div>
          <div><strong>Destino</strong>${SkateTrack.escapeHtml([plan.destination_city, plan.destination_state, plan.destination_country].filter(Boolean).join(' / ') || '—')}</div>
          <div><strong>Motivo</strong>${SkateTrack.escapeHtml(plan.travel_reason || '—')}</div>
          <div><strong>Período</strong>${SkateTrack.escapeHtml(`${SkateTrack.formatDateOnly(plan.start_date)} até ${SkateTrack.formatDateOnly(plan.end_date)}`)}</div>
        </div>
        ${plan.notes ? `<div class="item-observation">${SkateTrack.escapeHtml(plan.notes)}</div>` : ''}
        <div class="item-actions-inline">
          ${editable ? `<button class="inline-link-button" type="button" data-edit-plan="${plan.id}">Editar</button>` : '<span class="history-lock">Fechado</span>'}
        </div>
      </article>
    `;
  }).join('');

  list.querySelectorAll('[data-edit-plan]').forEach(button => {
    button.addEventListener('click', () => {
      const target = plansState.find(plan => plan.id === button.dataset.editPlan);
      if (target) openComposer(target);
    });
  });
}

async function openComposer(plan = null) {
  const composer = document.getElementById('planComposer');
  const form = document.getElementById('planForm');
  const title = document.getElementById('composerTitle');
  composer.classList.remove('hidden');
  composer.scrollIntoView({ behavior: 'smooth', block: 'start' });

  if (plan) {
    title.textContent = 'Editar plano';
    form.editingPlanId.value = plan.id;
    form.start_date.value = plan.start_date || '';
    form.end_date.value = plan.end_date || '';
    form.origin_country.value = plan.origin_country || '';
    form.destination_country.value = plan.destination_country || '';
    form.travel_reason.value = plan.travel_reason || '';
    form.notes.value = plan.notes || '';
    await originLocationController?.hydrate({
      country: plan.origin_country || '',
      state: plan.origin_state || '',
      city: plan.origin_city || ''
    });
    await destinationLocationController?.hydrate({
      country: plan.destination_country || '',
      state: plan.destination_state || '',
      city: plan.destination_city || ''
    });
  } else {
    title.textContent = 'Novo plano';
    form.reset();
    form.editingPlanId.value = '';
    originLocationController?.reset();
    destinationLocationController?.reset();
  }
}

function closeComposer() {
  const composer = document.getElementById('planComposer');
  const form = document.getElementById('planForm');
  composer.classList.add('hidden');
  form.reset();
  form.editingPlanId.value = '';
  document.getElementById('composerTitle').textContent = 'Novo plano';
}

function canEditPlan(plan) {
  return !!plan && plan.end_date >= SkateTrack.todayDateString();
}

function getPlanStatus(plan) {
  if (SkateTrack.isPlanActive(plan)) return { label: 'Em andamento', className: 'success' };
  if (plan.start_date > SkateTrack.todayDateString()) return { label: 'Futuro', className: 'muted' };
  return { label: 'Encerrado', className: 'warning' };
}

function handleQueryActions() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('new') === '1') openComposer();
  const editId = params.get('edit');
  if (editId) {
    const target = plansState.find(plan => plan.id === editId);
    if (target && canEditPlan(target)) openComposer(target);
  }
}

function initPlanLocationLists() {
  SkateTrack.populateCountryList('countryOptions');
  originLocationController = SkateTrack.createLocationController({
    countryInput: document.getElementById('origin_country'),
    stateInput: document.getElementById('origin_state'),
    cityInput: document.getElementById('origin_city'),
    stateListId: 'originStateOptions',
    cityListId: 'originCityOptions'
  });
  destinationLocationController = SkateTrack.createLocationController({
    countryInput: document.getElementById('destination_country'),
    stateInput: document.getElementById('destination_state'),
    cityInput: document.getElementById('destination_city'),
    stateListId: 'destinationStateOptions',
    cityListId: 'destinationCityOptions'
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

function debounce(fn, wait = 300) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), wait);
  };
}
