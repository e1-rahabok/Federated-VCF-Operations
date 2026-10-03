import React, { useState } from 'react';
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

  const navigate = (path: string) => {
    setCurrentPath(path);
    window.history.pushState({}, '', path);
  };

  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  const renderCurrentPage = () => {
    if (currentPath === '/') {
      return <HomePage onNavigate={navigate} />;
    }
    if (currentPath === '/alerts') {
      return <AlertsPage onNavigate={navigate} />;
    }
    if (currentPath.startsWith('/alerts/')) {
      const alertId = currentPath.split('/alerts/')[1] || 'alt-98234-vcf';
      return <AlertDetailPage alertId={alertId} onNavigate={navigate} />;
    }
    if (currentPath === '/metrics') {
      return <MetricsPage onNavigate={navigate} />;
    }
    if (currentPath.startsWith('/objects/')) {
      const resourceUuid = currentPath.split('/objects/')[1] || 'vm-007';
      return <ObjectDetailPage resourceUuid={resourceUuid} onNavigate={navigate} />;
    }
    if (currentPath === '/settings') {
      return <SettingsPage />;
    }
    return <HomePage onNavigate={navigate} />;
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
