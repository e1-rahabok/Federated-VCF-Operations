import React, { useEffect, useState } from 'react';
import { Header } from './components/Header';
import { LoginPage } from './pages/LoginPage';
import { HomePage } from './pages/HomePage';
import { AlertsPage } from './pages/AlertsPage';
import { AlertDetailPage } from './pages/AlertDetailPage';
import { MetricsPage } from './pages/MetricsPage';
import { ObjectDetailPage } from './pages/ObjectDetailPage';
import { SettingsPage } from './pages/SettingsPage';

export const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
  const [currentPath, setCurrentPath] = useState<string>(window.location.pathname || '/');
  const [selectedInstance, setSelectedInstance] = useState<string>('ALL');
  const [selectedTimeRange, setSelectedTimeRange] = useState<string>('24h');

  useEffect(() => {
    const onPopState = () => setCurrentPath(window.location.pathname || '/');
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = (path: string) => {
    setCurrentPath(path);
    window.history.pushState({}, '', path);
  };

  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  const pageProps = { onNavigate: navigate, instanceId: selectedInstance, timeRange: selectedTimeRange };

  const renderCurrentPage = () => {
    if (currentPath === '/') {
      return <HomePage {...pageProps} />;
    }
    if (currentPath === '/alerts') {
      return <AlertsPage {...pageProps} />;
    }
    if (currentPath.startsWith('/alerts/')) {
      return <AlertDetailPage alertId={decodeURIComponent(currentPath.split('/alerts/')[1])} {...pageProps} />;
    }
    if (currentPath === '/metrics') {
      return <MetricsPage {...pageProps} />;
    }
    if (currentPath.startsWith('/objects/')) {
      return <ObjectDetailPage resourceUuid={decodeURIComponent(currentPath.split('/objects/')[1])} {...pageProps} />;
    }
    if (currentPath === '/settings') {
      return <SettingsPage />;
    }
    return (
      <div style={{ padding: '24px' }}>
        <div className="panel">
          <h2>404 - Page Not Found</h2>
          <p style={{ color: '#94a3b8', marginTop: '8px' }}>The requested path <code>{currentPath}</code> was not recognized.</p>
          <button className="btn-primary" style={{ marginTop: '12px' }} onClick={() => navigate('/')}>🏠 Return to Home</button>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#0f172a', color: '#f8fafc' }}>
      <Header
        currentPath={currentPath}
        onNavigate={navigate}
        selectedInstance={selectedInstance}
        onSelectInstance={setSelectedInstance}
        selectedTimeRange={selectedTimeRange}
        onSelectTimeRange={setSelectedTimeRange}
      />
      <main style={{ flex: 1, maxWidth: '1400px', width: '100%', margin: '0 auto' }}>
        {renderCurrentPage()}
      </main>
    </div>
  );
};
