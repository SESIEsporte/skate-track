document.addEventListener('DOMContentLoaded', async () => {
  SkateTrack.attachSidebarToggle();
  const notice = document.getElementById('pageNotice');
  const list = document.getElementById('plansList');
  const countEl = document.getElementById('plansCount');
  const activeEl = document.getElementById('activePlansCount');

  try {
    const sessionData = await SkateTrack.getSessionProfile('athlete');
    if (!sessionData) return;
    const { profile } = sessionData;
    SkateTrack.renderShell({ role: 'athlete', activePage: 'plans.html', profile });
    SkateTrack.injectTopbarTitle('Meus planos', 'Planejamento de deslocamentos para cobertura, logística e seguro.');
    bindPlanForm(profile, notice, list, countEl, activeEl);
    await refreshPlans(profile.id, list, countEl, activeEl);
  } catch (error) {
    console.error(error);
    SkateTrack.setNotice(notice, error.message || 'Falha ao carregar planos.', 'error');
  }
});

function bindPlanForm(profile, notice, list, countEl, activeEl) {
  const form = document.getElementById('planForm');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Salvando...';
    SkateTrack.setNotice(notice, 'Registrando plano...', 'muted');

    const formData = new FormData(form);
    const payload = {
      athlete_id: profile.id,
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
      const { error } = await window.sb.from('plans').insert(payload);
      if (error) throw error;
      form.reset();
      SkateTrack.setNotice(notice, 'Plano salvo com sucesso.', 'success');
      await refreshPlans(profile.id, list, countEl, activeEl);
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
    .order('start_date', { ascending: true });

  if (error) throw error;

  countEl.textContent = data.length;
  activeEl.textContent = data.filter(plan => SkateTrack.isPlanActive(plan)).length;
  document.getElementById('nextWindow').textContent = data[0]?.start_date ? SkateTrack.formatDateOnly(data[0].start_date) : '—';

  if (!data.length) {
    list.innerHTML = '<div class="empty-state">Nenhum plano cadastrado até o momento.</div>';
    return;
  }

  list.innerHTML = data.map(plan => {
    const active = SkateTrack.isPlanActive(plan);
    return `
      <article class="plan-item">
        <div class="plan-item-head">
          <div>
            <p class="item-title">${SkateTrack.escapeHtml(plan.travel_reason || 'Deslocamento planejado')}</p>
            <p class="item-meta">${SkateTrack.formatDateOnly(plan.start_date)} até ${SkateTrack.formatDateOnly(plan.end_date)}</p>
          </div>
          <span class="status-pill ${active ? 'success' : 'muted'}">${active ? 'Ativo' : 'Programado'}</span>
        </div>
        <div class="item-grid">
          <div><strong>Origem</strong>${SkateTrack.escapeHtml([plan.origin_city, plan.origin_state, plan.origin_country].filter(Boolean).join(' / ') || '—')}</div>
          <div><strong>Destino</strong>${SkateTrack.escapeHtml([plan.destination_city, plan.destination_state, plan.destination_country].filter(Boolean).join(' / ') || '—')}</div>
          <div><strong>Período</strong>${SkateTrack.escapeHtml(`${plan.start_date} → ${plan.end_date}`)}</div>
          <div><strong>Motivo</strong>${SkateTrack.escapeHtml(plan.travel_reason || '—')}</div>
        </div>
        ${plan.notes ? `<div class="item-observation">${SkateTrack.escapeHtml(plan.notes)}</div>` : ''}
      </article>
    `;
  }).join('');
}
