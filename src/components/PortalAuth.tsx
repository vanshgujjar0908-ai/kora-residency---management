import { useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowLeft, KeyRound, Shield, UserCheck } from 'lucide-react';
import { apiRequest, setStoredToken } from '../lib/api.ts';
import type { AuthUser } from '../types.ts';

interface PortalAuthProps {
  onSuccess: (user: AuthUser) => void;
  onBackToSite: () => void;
}

export function PortalAuth({ onSuccess, onBackToSite }: PortalAuthProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function performLogin(loginEmail: string, loginPassword: string) {
    setError(null);
    setLoading(true);
    try {
      const res = await apiRequest<{ token: string; user: AuthUser }>(
        '/api/auth/login',
        {
          method: 'POST',
          body: JSON.stringify({
            email: loginEmail,
            password: loginPassword,
          }),
        }
      );
      setStoredToken(res.token);
      onSuccess(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed.');
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    void performLogin(email, password);
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <span className="font-display text-lg font-bold text-slate-900 whitespace-nowrap">
            Kora Residency
          </span>
          <button
            type="button"
            onClick={onBackToSite}
            className="inline-flex items-center gap-2 min-h-[40px] px-2 text-sm font-medium text-slate-600 hover:text-slate-900 cursor-pointer whitespace-nowrap"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" />
            <span>Back to Website</span>
          </button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-8 sm:py-12">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-6 sm:p-8">
          <div className="mb-6">
            <h1 className="font-display text-2xl font-bold text-slate-900">
              Portal Sign In
            </h1>
            <p className="mt-1.5 text-sm text-slate-600">
              Access your Resident Stay Dashboard or Property Admin Console.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@koraresidency.in"
                className="w-full px-3.5 py-2.5 text-base sm:text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full px-3.5 py-2.5 text-base sm:text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 font-medium">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[44px] py-2.5 px-4 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-60 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <KeyRound className="w-4 h-4" />
              <span>{loading ? 'Signing in...' : 'Sign In'}</span>
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-200">
            <div className="text-xs font-semibold text-slate-500 mb-3">
              Quick Demo Access
            </div>
            <div className="space-y-2.5">
              <button
                type="button"
                disabled={loading}
                onClick={() =>
                  void performLogin('admin@koraresidency.in', 'admin123')
                }
                className="w-full min-h-[48px] px-4 py-2.5 text-left border border-slate-200 hover:border-blue-300 hover:bg-blue-50/40 rounded-lg transition-colors flex items-center justify-between gap-3 cursor-pointer"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Shield className="w-4 h-4 text-blue-700 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-900">
                      Admin Dashboard
                    </div>
                    <div className="text-xs text-slate-500 font-mono truncate">
                      admin@koraresidency.in
                    </div>
                  </div>
                </div>
                <span className="text-xs font-semibold text-blue-700 shrink-0">
                  Enter
                </span>
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={() =>
                  void performLogin('aarav.mehta@koraresidency.in', 'tenant123')
                }
                className="w-full min-h-[48px] px-4 py-2.5 text-left border border-slate-200 hover:border-blue-300 hover:bg-blue-50/40 rounded-lg transition-colors flex items-center justify-between gap-3 cursor-pointer"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <UserCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-900 truncate">
                      Resident Portal (Aarav Mehta · Rm 201)
                    </div>
                    <div className="text-xs text-slate-500 font-mono truncate">
                      aarav.mehta@koraresidency.in
                    </div>
                  </div>
                </div>
                <span className="text-xs font-semibold text-blue-700 shrink-0">
                  Enter
                </span>
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
