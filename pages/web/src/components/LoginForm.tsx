import { isPasswordConfiguredLocally, login, type SessionInfo } from '@src/lib/auth';
import { useI18n } from '@sync-your-cookie/shared';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from '@sync-your-cookie/ui';
import { Loader2, Lock } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

type LoginFormProps = {
  sessionInfo: SessionInfo | null;
  onSuccess: () => void;
};

export function LoginForm({ sessionInfo, onSuccess }: LoginFormProps) {
  const { t } = useI18n();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const accessPasswordConfigured = sessionInfo?.passwordConfigured ?? isPasswordConfiguredLocally();
  const showDevHint = import.meta.env.DEV && !import.meta.env.VITE_WEB_ACCESS_PASSWORD?.trim();
  const accessPath = sessionInfo?.basePath ?? '/';

  const handleSubmit = async () => {
    if (!accessPasswordConfigured) {
      toast.error(t('accessPasswordNotConfigured'));
      return;
    }
    if (!password.trim()) {
      toast.warning(t('enterAccessPassword'));
      return;
    }

    setLoading(true);
    try {
      const result = await login(password);
      if (result.ok) {
        toast.success(t('loginSuccess'));
        onSuccess();
        return;
      }
      if (result.error === 'password_not_configured') {
        toast.error(t('accessPasswordNotConfigured'));
        return;
      }
      toast.error(t('wrongPassword'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="max-w-md mx-auto mt-8">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Lock size={20} className="text-primary" />
          <CardTitle>{t('webLoginTitle')}</CardTitle>
        </div>
        <CardDescription>{t('webLoginDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!accessPasswordConfigured ? (
          <p className="text-sm text-destructive">{t('accessPasswordNotConfigured')}</p>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="accessPassword">{t('accessPassword')}</Label>
              <Input
                id="accessPassword"
                type="password"
                autoComplete="current-password"
                placeholder={t('accessPasswordPlaceholder')}
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    void handleSubmit();
                  }
                }}
              />
            </div>
            {showDevHint && <p className="text-xs text-muted-foreground">{t('devDefaultPasswordHint')}</p>}
            <p className="text-xs text-muted-foreground">{t('webAccessPathHint', { path: accessPath })}</p>
            <Button className="w-full" onClick={() => void handleSubmit()} disabled={loading}>
              {loading ? <Loader2 size={16} className="mr-2 animate-spin" /> : null}
              {t('login')}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
