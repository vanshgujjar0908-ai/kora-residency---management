import { useCallback, useEffect, useState } from 'react';
import { AdminDashboard } from './components/AdminDashboard.tsx';
import { PortalAuth } from './components/PortalAuth.tsx';
import { PublicSite } from './components/PublicSite.tsx';
import { TenantPortal } from './components/TenantPortal.tsx';
import { apiRequest, getStoredToken, setStoredToken } from './lib/api.ts';
import type { AuthUser, PublicSiteData } from './types.ts';

type AppView = 'public' | 'portal';

export default function App() {
  const [view, setView] = useState<AppView>('public');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [publicData, setPublicData] = useState<PublicSiteData | null>(null);
  const [loadingSite, setLoadingSite] = useState(true);
  const [siteError, setSiteError] = useState<string | null>(null);

  const fetchPublicSite = useCallback(async () => {
    setSiteError(null);
    try {
      const data = await apiRequest<PublicSiteData>('/api/public/site');
      setPublicData(data);
    } catch (err) {
      setSiteError(
        err instanceof Error ? err.message : 'Unable to load property website.'
      );
    } finally {
      setLoadingSite(false);
    }
  }, []);

  useEffect(() => {
    void fetchPublicSite();

    const token = getStoredToken();
    if (token) {
      apiRequest<{ user: AuthUser }>('/api/auth/me')
        .then((res) => setUser(res.user))
        .catch(() => {
          setStoredToken(null);
          setUser(null);
        });
    }
  }, [fetchPublicSite]);

  function handleBackToSite() {
    setView('public');
    void fetchPublicSite();
  }

  function handleLogout() {
    setStoredToken(null);
    setUser(null);
    setView('portal');
  }

  if (view === 'portal') {
    if (!user) {
      return (
        <PortalAuth
          onSuccess={(loggedInUser) => setUser(loggedInUser)}
          onBackToSite={handleBackToSite}
        />
      );
    }
    if (user.role === 'admin') {
      return (
        <AdminDashboard
          user={user}
          onLogout={handleLogout}
          onBackToSite={handleBackToSite}
        />
      );
    }
    return (
      <TenantPortal
        user={user}
        onLogout={handleLogout}
        onBackToSite={handleBackToSite}
      />
    );
  }

  if (loadingSite || !publicData) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center px-6">
        {siteError ? (
          <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl p-6 text-center">
            <p className="text-sm font-semibold text-red-600">{siteError}</p>
            <button
              type="button"
              onClick={() => void fetchPublicSite()}
              className="mt-4 px-4 py-2 text-sm font-semibold text-white bg-blue-700 rounded-lg cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="max-w-3xl w-full space-y-4">
            <div className="h-12 bg-white border border-slate-200 rounded-xl animate-pulse" />
            <div className="h-80 bg-white border border-slate-200 rounded-xl animate-pulse" />
          </div>
        )}
      </div>
    );
  }

  return (
    <PublicSite
      data={publicData}
      onOpenPortal={() => setView('portal')}
      loggedInRole={user ? user.role : null}
    />
  );
}
