import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export type AccountLoginFormValues = {
  profileName: string;
  serverUrl: string;
  authPassword: string;
};

export type AccountLoginScreenLabels = {
  title: string;
  description: string;
  profileName: string;
  profileNamePlaceholder: string;
  serverUrl: string;
  serverUrlPlaceholder: string;
  authPassword: string;
  authPasswordPlaceholder: string;
  submit: string;
  settingsHint: string;
};

type AccountLoginScreenProps = {
  values: AccountLoginFormValues;
  onChange: (patch: Partial<AccountLoginFormValues>) => void;
  onSubmit: () => void | Promise<void>;
  loggingIn?: boolean;
  compact?: boolean;
  labels: AccountLoginScreenLabels;
  githubUrl: string;
};

export function AccountLoginScreen({
  values,
  onChange,
  onSubmit,
  loggingIn = false,
  compact = false,
  labels,
  githubUrl,
}: AccountLoginScreenProps) {
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (evt: React.FormEvent) => {
    evt.preventDefault();
    await onSubmit();
  };

  return (
    <div
      className={`flex flex-col items-center justify-center bg-background ${compact ? 'p-4 min-h-[420px]' : 'min-h-screen p-6'}`}>
      <Card className={`w-full ${compact ? 'max-w-md' : 'max-w-lg'}`}>
        <CardHeader>
          <CardTitle>{labels.title}</CardTitle>
          <CardDescription>{labels.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="login-profile-name">{labels.profileName}</Label>
              <Input
                id="login-profile-name"
                value={values.profileName}
                onChange={evt => onChange({ profileName: evt.target.value })}
                placeholder={labels.profileNamePlaceholder}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-server-url">{labels.serverUrl}</Label>
              <Input
                id="login-server-url"
                type="url"
                value={values.serverUrl}
                onChange={evt => onChange({ serverUrl: evt.target.value })}
                placeholder={labels.serverUrlPlaceholder}
                autoComplete="url"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-auth-password">{labels.authPassword}</Label>
              <div className="relative">
                <Input
                  id="login-auth-password"
                  type={showPassword ? 'text' : 'password'}
                  value={values.authPassword}
                  onChange={evt => onChange({ authPassword: evt.target.value })}
                  placeholder={labels.authPasswordPlaceholder}
                  className="pr-10"
                  autoComplete="current-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowPassword(v => !v)}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </Button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loggingIn}>
              {loggingIn ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {labels.submit}
            </Button>
          </form>
          <p className="mt-4 text-xs text-muted-foreground text-center">
            {labels.settingsHint}{' '}
            <a className="underline" href={githubUrl} target="_blank" rel="noreferrer">
              GitHub
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
