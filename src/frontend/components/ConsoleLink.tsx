import React, { useState } from 'react';
import { apiGet } from '../api';

interface ConsoleLinkProps {
  instanceId: string;
  resourceUuid: string;
  alertId?: string;
  label: string;
  description: string;
}

/** Asks the backend for the deep link into the source VCF Operations console and opens it in a new tab. */
export const ConsoleLink: React.FC<ConsoleLinkProps> = ({ instanceId, resourceUuid, alertId, label, description }) => {
  const [error, setError] = useState<string | null>(null);

  const handleOpen = async () => {
    try {
      const params = `objectUuid=${encodeURIComponent(resourceUuid)}${alertId ? `&alertId=${encodeURIComponent(alertId)}` : ''}`;
      const { url } = await apiGet(`/instances/${encodeURIComponent(instanceId)}/console-url?${params}`);
      setError(null);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0f172a' }}>
      <div>
        <strong style={{ fontSize: '14px' }}>{description}</strong>
        <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>Opens the source VCF Operations 9 web console in a new browser tab</div>
        {error && <div style={{ fontSize: '12px', color: '#fca5a5', marginTop: '4px' }}>⚠️ {error}</div>}
      </div>
      <button className="btn-primary" style={{ padding: '10px 20px', fontSize: '14px' }} onClick={handleOpen}>
        🚀 {label} ➔
      </button>
    </div>
  );
};
