document.querySelector('#login-form').addEventListener('submit', async event => {
  event.preventDefault();
  const button = document.querySelector('#login-button');
  const status = document.querySelector('#login-status');
  button.disabled = true;
  status.textContent = 'Entrando…';
  try {
    const response = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: document.querySelector('#password').value }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Não foi possível entrar.');
    location.replace('/');
  } catch (error) { status.textContent = error.message; button.disabled = false; }
});
