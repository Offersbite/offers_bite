import { useCallback, useEffect, useState } from 'react';
import { AuthPage } from './features/auth/AuthPage.jsx';
import { DashboardPage } from './features/dashboard/DashboardPage.jsx';
import { getSessionUser } from './services/authApi.js';
import './styles/global.css';

function getInitialTheme() {
  const savedTheme = window.localStorage.getItem('offersbite-theme-v2');
  return savedTheme === 'light' ? 'light' : 'dark';
}

export default function App() {
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [sessionError, setSessionError] = useState('');
  const [theme, setTheme] = useState(getInitialTheme);
  const clearSession = useCallback(() => setUser(null), []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('offersbite-theme-v2', theme);
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      'content',
      theme === 'dark' ? '#111815' : '#f7f8f5',
    );
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((currentTheme) => currentTheme === 'dark' ? 'light' : 'dark');
  }, []);

  useEffect(() => {
    let active = true;
    getSessionUser()
      .then((currentUser) => {
        if (active) setUser(currentUser);
      })
      .catch((error) => {
        if (active && error.status !== 401) setSessionError(error.message);
      })
      .finally(() => {
        if (active) setAuthChecked(true);
      });
    return () => {
      active = false;
    };
  }, []);

  if (!authChecked) {
    return (
      <main className="session-loading">
        <div className="loading-mark">O</div>
        <span>Getting your savings space ready</span>
      </main>
    );
  }

  if (!user) {
    return (
      <AuthPage
        initialError={sessionError}
        onAuthenticated={(signedInUser) => {
          setSessionError('');
          setUser(signedInUser);
        }}
      />
    );
  }

  return (
    <DashboardPage
      user={user}
      theme={theme}
      onToggleTheme={toggleTheme}
      onUserUpdated={setUser}
      onLogout={clearSession}
    />
  );
}
