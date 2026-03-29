document.addEventListener('DOMContentLoaded', async () => {
  SkateTrack.attachSidebarToggle();
  const notice = document.getElementById('pageNotice');
  const historyContainer = document.getElementById('historyContainer');
  const quickStats = {
    todayCount: document.getElementById('todayCount'),
    gpsCount: document.getElementById('gpsCount'),
    activePlans: document.getElementById('activePlans')
  };

  let profile;

  try {
    const sessionData = await SkateTrack.getSessionProfile('athlete');
    if (!sessionData) return;
    profile = sessionData.profile;
    SkateTrack.renderShell({ role: 'athlete', activePage: 'athlete.html', profile });
    SkateTrack.injectTopbarTitle('Meu dia', 'Registro operacional do dia com check-ins reais e histórico imediato.');
    document.getElementById('athleteName').textContent = profile.social_name || profile.full_name || profile.username;
    document.getElementById('todayDate').textContent = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(new Date());

    bindCheckinForms(profile);
    await refreshAthleteView(profile, historyContainer, quickStats, notice);
  } catch (error) {
    console.error(error);
    SkateTrack.setNotice(notice, error.message || 'Falha ao carregar a área do atleta.', 'error');
  }
});

function bindCheckinForms(profile) {
  const gpsButton = document.getElementById('gpsCheckinButton');
  const manualForm = document.getElementById('manualCheckinForm');
  const manualToggleButtons = document.querySelectorAll('[data-checkin-mode]');
  const manualPanel = document.getElementById('manualPanel');
  const pageNotice = document.getElementById('pageNotice');

  manualToggleButtons.forEach(button => {
    button.addEventListener('click', () => {
      manualToggleButtons.forEach(btn => btn.classList.toggle('active', btn === button));
      const mode = button.dataset.checkinMode;
      manualPanel.classList.toggle('hidden', mode !== 'manual');
    });
  });

  gpsButton?.addEventListener('click', async () => {
    gpsButton.disabled = true;
    gpsButton.textContent = 'Capturando localização...';
    SkateTrack.setNotice(pageNotice, 'Solicitando localização do navegador...', 'muted');

    try {
      const position = await getCurrentPosition();
      const coords = position.coords;
      let address = { country: '', state_region: '', city: '', location_name: '' };
      try {
        address = await SkateTrack.reverseGeocode(coords.latitude, coords.longitude);
      } catch (error) {
        console.warn('Reverse geocoding não disponível:', error.message);
      }

      const payload = {
        athlete_id: profile.id,
        checkin_at: new Date().toISOString(),
        location_type: 'gps',
        latitude: coords.latitude,
        longitude: coords.longitude,
        gps_accuracy_meters: coords.accuracy,
        country: address.country,
        state_region: address.state_region,
        city: address.city,
        location_name: address.location_name,
        observation: document.getElementById('gpsObservation').value.trim() || null,
      };

      const { error } = await window.sb.from('checkins').insert(payload);
      if (error) throw error;
      document.getElementById('gpsObservation').value = '';
      SkateTrack.setNotice(pageNotice, 'Check-in GPS registrado com sucesso.', 'success');
      await refreshAthleteView(profile, document.getElementById('historyContainer'), {
        todayCount: document.getElementById('todayCount'),
        gpsCount: document.getElementById('gpsCount'),
        activePlans: document.getElementById('activePlans')
      }, pageNotice);
    } catch (error) {
      console.error(error);
      const msg = error.code === 1
        ? 'Permissão de localização negada. Use o check-in manual se necessário.'
        : (error.message || 'Falha ao registrar check-in GPS.');
      SkateTrack.setNotice(pageNotice, msg, 'error');
    } finally {
      gpsButton.disabled = false;
      gpsButton.textContent = 'Registrar check-in com GPS';
    }
  });

  manualForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submitButton = manualForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Salvando...';
    SkateTrack.setNotice(pageNotice, 'Registrando check-in manual...', 'muted');

    const formData = new FormData(manualForm);
    const payload = {
      athlete_id: profile.id,
      checkin_at: new Date().toISOString(),
      location_type: 'manual',
      country: formData.get('country')?.toString().trim() || null,
      state_region: formData.get('state_region')?.toString().trim() || null,
      city: formData.get('city')?.toString().trim() || null,
      location_name: formData.get('location_name')?.toString().trim() || null,
      observation: formData.get('observation')?.toString().trim() || null,
    };

    try {
      const { data, error } = await window.sb.from('checkins').insert(payload).select('id').single();
      if (error) throw error;

      let geocodeResult = null;
      let geocodeStatus = 'not_found';
      try {
        geocodeResult = await SkateTrack.geocodeQuery(payload);
        geocodeStatus = geocodeResult ? 'ok' : 'not_found';
      } catch (error) {
        geocodeStatus = 'error';
      }

      const geocodePayload = {
        checkin_id: data.id,
        geocoding_status: geocodeStatus,
        geocoding_source: geocodeResult?.source || 'nominatim',
        geocoded_latitude: geocodeResult?.latitude || null,
        geocoded_longitude: geocodeResult?.longitude || null,
      };
      await window.sb.from('checkin_geocoding').insert(geocodePayload);

      manualForm.reset();
      SkateTrack.setNotice(pageNotice, geocodeResult
        ? 'Check-in manual salvo e geocodificado com sucesso.'
        : 'Check-in manual salvo. O ponto não pôde ser geocodificado automaticamente.', geocodeResult ? 'success' : 'warning');
      await refreshAthleteView(profile, document.getElementById('historyContainer'), {
        todayCount: document.getElementById('todayCount'),
        gpsCount: document.getElementById('gpsCount'),
        activePlans: document.getElementById('activePlans')
      }, pageNotice);
    } catch (error) {
      console.error(error);
      SkateTrack.setNotice(pageNotice, error.message || 'Falha ao salvar check-in manual.', 'error');
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Salvar check-in manual';
    }
  });
}

async function refreshAthleteView(profile, historyContainer, quickStats, notice) {
  const { start, end } = SkateTrack.todayRange();
  const [{ data: checkins, error: checkinError }, { data: plans, error: plansError }] = await Promise.all([
    window.sb
      .from('checkins')
      .select('*')
      .eq('athlete_id', profile.id)
      .gte('checkin_at', start)
      .lt('checkin_at', end)
      .order('checkin_at', { ascending: false }),
    window.sb
      .from('plans')
      .select('*')
      .eq('athlete_id', profile.id)
      .order('start_date', { ascending: true })
  ]);

  if (checkinError) throw checkinError;
  if (plansError) throw plansError;

  quickStats.todayCount.textContent = checkins.length;
  quickStats.gpsCount.textContent = checkins.filter(item => item.location_type === 'gps').length;
  quickStats.activePlans.textContent = plans.filter(plan => SkateTrack.isPlanActive(plan)).length;

  if (!checkins.length) {
    historyContainer.innerHTML = '<div class="empty-state">Nenhum check-in registrado hoje.</div>';
  } else {
    historyContainer.innerHTML = checkins.map(item => `
      <article class="timeline-item">
        <div class="timeline-item-head">
          <div>
            <p class="item-title">${item.location_type === 'gps' ? 'Check-in via GPS' : 'Check-in manual'}</p>
            <p class="item-meta">${SkateTrack.formatDateTime(item.checkin_at)} • ${SkateTrack.getLocationLabel(item)}</p>
          </div>
          <span class="status-pill ${item.location_type === 'gps' ? 'success' : 'warning'}">${item.location_type === 'gps' ? 'GPS' : 'Manual'}</span>
        </div>
        <div class="item-grid">
          <div><strong>País</strong>${SkateTrack.escapeHtml(item.country || '—')}</div>
          <div><strong>Cidade</strong>${SkateTrack.escapeHtml(item.city || '—')}</div>
          <div><strong>Estado / Região</strong>${SkateTrack.escapeHtml(item.state_region || '—')}</div>
          <div><strong>Local</strong>${SkateTrack.escapeHtml(item.location_name || '—')}</div>
        </div>
        ${item.observation ? `<div class="item-observation">${SkateTrack.escapeHtml(item.observation)}</div>` : ''}
      </article>
    `).join('');
  }

  const activePlansContainer = document.getElementById('todayPlans');
  const activePlans = plans.filter(plan => SkateTrack.isPlanActive(plan));
  if (!activePlans.length) {
    activePlansContainer.innerHTML = '<div class="empty-state">Nenhum plano ativo para hoje.</div>';
  } else {
    activePlansContainer.innerHTML = activePlans.map(plan => `
      <article class="plan-item">
        <div class="plan-item-head">
          <div>
            <p class="item-title">${SkateTrack.escapeHtml(plan.travel_reason || 'Deslocamento planejado')}</p>
            <p class="item-meta">${SkateTrack.formatDateOnly(plan.start_date)} até ${SkateTrack.formatDateOnly(plan.end_date)}</p>
          </div>
          <span class="status-pill success">Ativo</span>
        </div>
        <div class="item-grid">
          <div><strong>Origem</strong>${SkateTrack.escapeHtml([plan.origin_city, plan.origin_state, plan.origin_country].filter(Boolean).join(' / ') || '—')}</div>
          <div><strong>Destino</strong>${SkateTrack.escapeHtml([plan.destination_city, plan.destination_state, plan.destination_country].filter(Boolean).join(' / ') || '—')}</div>
        </div>
        ${plan.notes ? `<div class="item-observation">${SkateTrack.escapeHtml(plan.notes)}</div>` : ''}
      </article>
    `).join('');
  }

  if (notice?.textContent === 'Validando acesso...') {
    SkateTrack.setNotice(notice, '', 'muted');
  }
}

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocalização não suportada neste navegador.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0
    });
  });
}
