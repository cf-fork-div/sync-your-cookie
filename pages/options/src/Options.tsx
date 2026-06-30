import {
  ErrorFallback,
  GITHUB_REPO_URL,
  LoadingFallback,
  normalizeServerUrl,
  useDocumentTitle,
  useI18n,
  useStorageSuspense,
  useTheme,
  verifySyncServer,
  withErrorBoundary,
  withSuspense,
} from '@sync-your-cookie/shared';
import { accountProfileStorage, getActiveProfile } from '@sync-your-cookie/storage/lib/accountProfileStorage';
import { accountStorage } from '@sync-your-cookie/storage/lib/accountStorage';
import {
  AccountProfileDropdown,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  LanguageDropdown,
  ThemeDropdown,
  Toaster,
} from '@sync-your-cookie/ui';
import { Eye, EyeOff, Loader2, Plus, SlidersVertical, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { SettingsPopover } from './components/SettingsPopover';

const Options = () => {
  const { t, localePreference, setLocale } = useI18n();
  useDocumentTitle('pageTitleOptions');
  const profileState = useStorageSuspense(accountProfileStorage);
  const accountInfo = useStorageSuspense(accountStorage);
  const [profileName, setProfileName] = useState('');
  const [serverUrl, setServerUrl] = useState(accountInfo.serverUrl || '');
  const [authPassword, setAuthPassword] = useState(accountInfo.authPassword || '');
  const [openEye, setOpenEye] = useState(false);
  const [loadingSave, setLoadingSave] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const { setTheme } = useTheme();

  const activeProfile = getActiveProfile(profileState);

  useEffect(() => {
    setServerUrl(accountInfo.serverUrl || '');
    setAuthPassword(accountInfo.authPassword || '');
    setProfileName(activeProfile?.name || '');
  }, [accountInfo.serverUrl, accountInfo.authPassword, activeProfile?.name, activeProfile?.id]);

  const handleServerUrlInput: React.ChangeEventHandler<HTMLInputElement> = evt => {
    setServerUrl(evt.target.value);
  };

  const handleAuthPasswordInput: React.ChangeEventHandler<HTMLInputElement> = evt => {
    setAuthPassword(evt.target.value);
  };

  const handleProfileNameInput: React.ChangeEventHandler<HTMLInputElement> = evt => {
    setProfileName(evt.target.value);
  };

  const handleSwitchProfile = async (id: string) => {
    if (id === profileState.activeProfileId) {
      return;
    }
    await accountProfileStorage.setActiveProfileId(id);
    const profile = profileState.accountProfileList.find(item => item.id === id);
    if (profile) {
      toast.success(t('profileSwitched', { name: profile.name }));
    }
  };

  const handleAddProfile = async () => {
    const count = profileState.accountProfileList.length;
    const profile = await accountProfileStorage.addProfile(
      t('profileNumber', { number: count + 1 }),
    );
    toast.success(t('profileAdded'));
    setProfileName(profile.name);
    setServerUrl('');
    setAuthPassword('');
  };

  const handleDeleteProfile = async () => {
    if (!activeProfile) {
      return;
    }
    if (profileState.accountProfileList.length <= 1) {
      toast.warning(t('cannotDeleteLastProfile'));
      return;
    }
    await accountProfileStorage.deleteProfile(activeProfile.id);
    setDeleteDialogOpen(false);
    toast.success(t('profileDeleted'));
  };

  const handleSave = async () => {
    if (!serverUrl?.trim() || !authPassword?.trim()) {
      toast.warning(t('serverUrlPasswordRequired'));
      return;
    }
    try {
      setLoadingSave(true);
      const normalizedUrl = normalizeServerUrl(serverUrl);
      await verifySyncServer(normalizedUrl, authPassword.trim());
      toast.success(t('saveSuccess'));
      await accountProfileStorage.updateActiveProfile({
        name: profileName.trim() || activeProfile?.name || t('profileNumber', { number: 1 }),
        serverUrl: normalizedUrl,
        authPassword: authPassword.trim(),
        accountId: undefined,
        namespaceId: undefined,
        token: undefined,
      });
    } catch (err: unknown) {
      const code = err instanceof Error ? err.message : 'verify_failed';
      if (code === 'wrong_password') {
        toast.error(t('wrongPassword'));
      } else if (code === 'datasource_not_configured') {
        toast.error(t('datasourceNotConfigured'));
      } else if (code === 'password_not_configured') {
        toast.error(t('accessPasswordNotConfigured'));
      } else {
        toast.error(t('verifyFailed', { message: code }));
      }
    } finally {
      setLoadingSave(false);
    }
  };

  const handleToggleEye = () => {
    setOpenEye(!openEye);
  };

  return (
    <div className="w-screen h-screen absolute top-0 left-0 right-0 bottom-0 flex flex-col items-center justify-center p-4 bg-background ">
      <div className="fixed right-8 top-8 flex gap-2">
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
        <ThemeDropdown
          setTheme={setTheme}
          labels={{ light: t('light'), dark: t('dark'), system: t('system'), toggleTheme: t('toggleTheme') }}
        />
      </div>
      <div className=" mt-[-80px] flex justify-center flex-col items-center">
        <img
          src={chrome.runtime.getURL('options/logo.png')}
          className="size-40 overflow-hidden object-contain mb-4 animate-[spin_20s_linear_infinite]"
          alt="logo"
        />
        <div className="w-full">
          <Card className="mx-auto min-w-[400px] max-w-lg">
            <CardHeader className="relative">
              <div className="flex justify-between items-center gap-2 pr-8">
                <CardTitle className="text-xl">{t('settings')}</CardTitle>
                <AccountProfileDropdown
                  profiles={profileState.accountProfileList.map(profile => ({
                    id: profile.id,
                    name: profile.name,
                  }))}
                  activeProfileId={profileState.activeProfileId}
                  onSelect={handleSwitchProfile}
                  onAdd={handleAddProfile}
                  labels={{
                    accountProfile: t('accountProfile'),
                    addProfile: t('addProfile'),
                    switchProfile: t('switchProfile'),
                  }}
                />
              </div>
              <SettingsPopover
                trigger={
                  <Button variant="secondary" size="icon" className="size-6 absolute right-4 top-4">
                    <SlidersVertical size={18} />
                  </Button>
                }
              />
            </CardHeader>
            <CardContent>
              <CardDescription className="mt-[-16px] mb-4">{t('enterSyncServer')}</CardDescription>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="profileName">{t('profileName')}</Label>
                    <div className="flex gap-1">
                      <Button variant="outline" size="icon" className="size-7" onClick={handleAddProfile} title={t('addProfile')}>
                        <Plus size={14} />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-7"
                        disabled={profileState.accountProfileList.length <= 1}
                        onClick={() => setDeleteDialogOpen(true)}
                        title={t('deleteProfile')}>
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                  <Input
                    id="profileName"
                    value={profileName}
                    onChange={handleProfileNameInput}
                    className="w-full"
                    type="text"
                    placeholder={t('profileNamePlaceholder')}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="serverUrl">{t('syncServerUrl')}</Label>
                  <Input
                    id="serverUrl"
                    value={serverUrl}
                    onChange={handleServerUrlInput}
                    className="w-full"
                    type="url"
                    placeholder={t('syncServerUrlPlaceholder')}
                    autoComplete="url"
                  />
                </div>
                <div className="grid gap-2">
                  <div className="flex justify-between items-center ">
                    <Label htmlFor="authPassword">{t('accessPassword')}</Label>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={() => handleToggleEye()}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          handleToggleEye();
                        }
                      }}
                      className="cursor-pointer">
                      {openEye ? <EyeOff size={18} /> : <Eye size={18} />}
                    </span>
                  </div>
                  <Input
                    id="authPassword"
                    value={authPassword}
                    onChange={handleAuthPasswordInput}
                    className="w-full mb-4"
                    type={openEye ? 'text' : 'password'}
                    placeholder={t('accessPasswordPlaceholder')}
                    autoComplete="current-password"
                    required
                  />
                </div>
                <Button disabled={loadingSave} onClick={handleSave} type="submit" className="w-full">
                  {loadingSave ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {t('save')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteProfile')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteProfileConfirm', { name: activeProfile?.name || '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteProfile}>{t('delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="mt-2 text-sm">
        {t('sourceOnGitHub')}{' '}
        <a
          className="font-bold inline-flex items-center "
          href={GITHUB_REPO_URL}
          target="_blank"
          rel="noopener noreferrer">
          GitHub
          <img
            src={chrome.runtime.getURL('popup/github.svg')}
            className="ml-1 h-4 w-4 overflow-hidden object-contain "
            alt="GitHub"
          />
        </a>
        .
      </div>

      <Toaster
        position="top-center"
        richColors
        visibleToasts={1}
        toastOptions={{
          duration: 2000,
        }}
      />
    </div>
  );
};

export default withErrorBoundary(withSuspense(Options, <LoadingFallback />), <ErrorFallback />);
