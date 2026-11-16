try {
  const response = await fetch('/api/session');
  const session = await response.json();
  if (!session.signedIn) location.replace('/login');
  else if (session.protected) {
    const form = document.createElement('form');
    form.action = '/logout'; form.method = 'POST'; form.className = 'logout-form';
    const button = document.createElement('button');
    button.className = 'today-button'; button.type = 'submit'; button.textContent = 'Sair';
    form.append(button); document.querySelector('.topbar').append(form);
  }
} catch { /* O diário informa erros de conexão em seu próprio status. */ }
