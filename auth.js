document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('loginForm');
  const notice = document.getElementById('loginNotice');
  const submitButton = document.getElementById('loginSubmit');

  try {
    await SkateTrack.routeByRole();
  } catch (error) {
    SkateTrack.setNotice(notice, 'Não foi possível validar a sessão existente.', 'error');
  }

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    if (!username || !password) {
      SkateTrack.setNotice(notice, 'Informe usuário e senha para continuar.', 'warning');
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = 'Entrando...';
    SkateTrack.setNotice(notice, 'Validando acesso...', 'muted');

    try {
      const email = SkateTrack.usernameToEmail(username);
      const { error } = await window.sb.auth.signInWithPassword({ email, password });
      if (error) throw error;

      const { data: { session } } = await window.sb.auth.getSession();
      if (!session) throw new Error('Sessão não iniciada.');

      const { data: profile, error: profileError } = await window.sb
        .from('profiles')
        .select('role, active')
        .eq('id', session.user.id)
        .single();

      if (profileError || !profile) throw new Error('Perfil não localizado.');
      if (!profile.active) throw new Error('Seu acesso está inativo. Contate o administrador.');

      const target = ['admin', 'manager'].includes(profile.role) ? 'admin.html' : 'athlete.html';
      window.location.href = target;
    } catch (error) {
      console.error(error);
      let message = 'Não foi possível realizar o login.';
      if (error.message?.toLowerCase().includes('invalid login credentials')) {
        message = 'Usuário ou senha inválidos.';
      } else if (error.message) {
        message = error.message;
      }
      SkateTrack.setNotice(notice, message, 'error');
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Entrar';
    }
  });
});
