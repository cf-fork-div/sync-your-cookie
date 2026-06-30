import { ConnectForm } from '@src/components/ConnectForm';
import { CookieViewer } from '@src/components/CookieViewer';
import { LoginForm } from '@src/components/LoginForm';
import { fetchSession, logout, type SessionInfo } from '@src/lib/auth';
import type { ViewerSession } from '@src/lib/types';
import { useI18n } from '@sync-your-cookie/shared';
import { Button, LanguageDropdown, Toaster } from '@sync-your-cookie/ui';
import { Cookie, LogOut } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function App() {
  const { t, localePreference, setLocale } = useI18n();
  const [authReady, setAuthReady] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [session, setSession] = useState<ViewerSession | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchSession().then(info => {
      if (cancelled) {
        return;
      }
      setSessionInfo(info);
      setAuthReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = () => {
    void logout().then(() => {
      setSessionInfo(prev => (prev ? { ...prev, authenticated: false } : prev));
      setSession(null);
    });
  };

  const handleLoginSuccess = () => {
    setSessionInfo(prev =>
      prev ? { ...prev, authenticated: true } : { authenticated: true, passwordConfigured: true, basePath: '/' },
    );
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border bg-card/60 px-4 py-3 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Cookie size={20} />
        </div>
        <div className="flex-1">
          <h1 className="text-lg font-semibold leading-tight">Sync Your Cookie</h1>
          <p className="text-xs text-muted-foreground">
            {sessionInfo?.authenticated ? t('webSubtitle') : t('webLoginSubtitle')}
          </p>
        </div>
        <LanguageDropdown
          locale={localePreference}
          setLocale={setLocale}
          labels={{
            language: t('language'),
            followSystem: t('followSystem'),
            english: t('english'),
            chinese: t('chinese'),
          }}
        />
        {sessionInfo?.authenticated && (
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut size={14} className="mr-1.5" />
            {t('logout')}
          </Button>
        )}
      </header>

      <main className="flex-1 p-4 max-w-6xl w-full mx-auto">
        {!authReady ? null : !sessionInfo?.authenticated ? (
          <LoginForm sessionInfo={sessionInfo} onSuccess={handleLoginSuccess} />
        ) : session ? (
          <CookieViewer session={session} onSessionChange={setSession} onDisconnect={() => setSession(null)} />
        ) : (
          <ConnectForm onLoaded={setSession} />
        )}
      </main>

      <Toaster closeButton richColors position="top-center" visibleToasts={2} />
    </div>
  );
}
