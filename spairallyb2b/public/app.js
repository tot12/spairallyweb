/*
   app.js - Entry point
   initApp() is called by loader.js after all partials are injected into the DOM.
*/

function initApp() {
  const token = localStorage.getItem('spairally_token');
  const user  = getSavedUser();

  if (token && user) {
    setToken(token);
    const payload = parseJwt(token);
    if (payload.exp && payload.exp * 1000 > Date.now()) {
      onLogin(user);
      return;
    }
  }

  // No valid session — show auth screen and normalise URL to /login
  clearToken();
  if (location.pathname !== '/login') {
    history.replaceState(null, '', '/login');
  }
  if (window.lucide) lucide.createIcons();
}
