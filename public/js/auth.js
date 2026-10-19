/**
 * CAMFIX Client Auth Manager
 * Manages JWT tokens, user profiles, and quick persona switcher
 */

const auth = {
  token: localStorage.getItem('camfix_token') || null,
  user: JSON.parse(localStorage.getItem('camfix_user') || 'null'),

  init() {
    if (this.token && !this.user) {
      this.fetchUser();
    }
  },

  setSession(token, user) {
    this.token = token;
    this.user = user;
    localStorage.setItem('camfix_token', token);
    localStorage.setItem('camfix_user', JSON.stringify(user));
    app.updateUserUI();
  },

  clearSession() {
    this.token = null;
    this.user = null;
    localStorage.removeItem('camfix_token');
    localStorage.removeItem('camfix_user');
    app.updateUserUI();
    app.navigate('home');
  },

  async handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (data.success) {
        this.setSession(data.token, data.user);
        app.closeModal('authModal');
        app.showToast(`Welcome back, ${data.user.name}!`, 'success');
        app.navigate('dashboard');
      } else {
        app.showToast(data.error || 'Login failed', 'error');
      }
    } catch (err) {
      app.showToast('Network error during login', 'error');
    }
  },

  async handleRegister(e) {
    e.preventDefault();
    const name = document.getElementById('regName').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    const role = document.getElementById('regRole').value;

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role })
      });
      const data = await res.json();

      if (data.success) {
        this.setSession(data.token, data.user);
        app.closeModal('authModal');
        app.showToast(`Account registered successfully!`, 'success');
        app.navigate('dashboard');
      } else {
        app.showToast(data.error || 'Registration failed', 'error');
      }
    } catch (err) {
      app.showToast('Network error during registration', 'error');
    }
  },

  async quickLogin(email) {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'password123' })
      });
      const data = await res.json();

      if (data.success) {
        this.setSession(data.token, data.user);
        app.closeModal('authModal');
        app.showToast(`Logged in as ${data.user.name} (${data.user.role})`, 'success');
        app.navigate('dashboard');
      } else {
        app.showToast(data.error || 'Quick login failed', 'error');
      }
    } catch (err) {
      app.showToast('Failed to switch user persona', 'error');
    }
  },

  async fetchUser() {
    if (!this.token) return;
    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      const data = await res.json();
      if (data.success) {
        this.user = data.user;
        localStorage.setItem('camfix_user', JSON.stringify(data.user));
        app.updateUserUI();
      } else {
        this.clearSession();
      }
    } catch (err) {
      console.error('Failed to fetch user:', err);
    }
  }
};
