import {
  ErrorFallback,
  GITHUB_HOW_TO_USE_URL,
  GITHUB_REPO_URL,
  LoadingFallback,
  useDocumentTitle,
  useI18n,
  useStorageSuspense,
  useTheme,
  verifyCloudflareToken,
  withErrorBoundary,
  withSuspense,
} from '@sync-your-cookie/shared';
import { accountProfileStorage } from '@sync-your-cookie/storage/lib/accountProfileStorage';
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
  const [token, setToken] = useState(accountInfo.token);
  const [accountId, setAccountId] = useState(accountInfo.accountId);
  const [namespaceId, setNamespaceId] = useState(accountInfo.namespaceId);
  const [openEye, setOpenEye] = useState(false);
  const [loadingSave, setLoadingSave] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const { setTheme } = useTheme();

  const activeProfile = profileState.accountProfileList.find(
    profile => profile.id === profileState.activeProfileId,
  );

  useEffect(() => {
    setToken(accountInfo.token);
    setAccountId(accountInfo.accountId);
    setNamespaceId(accountInfo.namespaceId);
    setProfileName(activeProfile?.name || '');
  }, [accountInfo.token, accountInfo.accountId, accountInfo.namespaceId, activeProfile?.name, activeProfile?.id]);

  const handleTokenInput: React.ChangeEventHandler<HTMLInputElement> = evt => {
    setToken(evt.target.value);
  };

  const handleAccountInput: React.ChangeEventHandler<HTMLInputElement> = evt => {
    setAccountId(evt.target.value);
  };

  const handleNamespaceInput: React.ChangeEventHandler<HTMLInputElement> = evt => {
    setNamespaceId(evt.target.value);
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
    setToken('');
    setAccountId('');
    setNamespaceId('');
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
    if (!accountId?.trim() || !token?.trim()) {
      toast.warning(t('accountIdTokenRequired'));
      return;
    } else if (!namespaceId?.trim()) {
      toast.warning(t('namespaceIdRequired'));
      return;
    }
    try {
      setLoadingSave(true);
      const res = await verifyCloudflareToken(accountId.trim(), token.trim());
      if (res.success === true) {
        const [message] = res.messages;
        if (message?.message) {
          toast.success(t('saveSuccessWithMessage', { message: message.message.replace('API', '') }));
        } else {
          toast.success(t('saveSuccess'));
        }
        await accountProfileStorage.updateActiveProfile({
          name: profileName.trim() || activeProfile?.name || t('profileNumber', { number: 1 }),
          accountId: accountId.trim(),
          namespaceId: namespaceId.trim(),
          token: token.trim(),
        });
      } else {
        const [error] = res.errors;
        if (error?.message) {
          toast.error(t('verifyFailed', { message: error.message }));
        } else {
          toast.error(t('verifyFailedUnknown'));
        }
      }
    } catch (err: any) {
      console.log('error', err);
      const [error] = err?.errors || [];
      if (error?.message) {
        toast.error(t('verifyFailed', { message: error.message }));
      } else {
        toast.error(t('verifyFailedUnknown'));
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
              <CardDescription className="mt-[-16px] mb-4">{t('enterCloudflareAccount')}</CardDescription>
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
                  <div className="flex justify-between items-center ">
                    <Label htmlFor="token">{t('authorizationToken')}</Label>
                    <p className="flex items-center text-center text-xs">
                      <a
                        href={GITHUB_HOW_TO_USE_URL}
                        target="_blank"
                        className=" cursor-pointer underline mx-2"
                        rel="noreferrer">
                        {t('howToGetIt')}
                      </a>
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
                    </p>
                  </div>
                  <Input
                    id="token"
                    value={token}
                    onChange={handleTokenInput}
                    className="w-full mb-2"
                    type={openEye ? 'text' : 'password'}
                    placeholder={t('cloudflareTokenPlaceholder')}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <div className="flex justify-between items-center ">
                    <Label htmlFor="accountId">{t('accountId')}</Label>
                    <p className="flex items-center text-center text-xs">
                      {t('noCloudflareAccount')}
                      <a
                        href="https://dash.cloudflare.com/sign-up"
                        target="_blank"
                        className=" cursor-pointer underline ml-2"
                        rel="noreferrer">
                        {t('signUp')}
                      </a>
                    </p>
                  </div>
                  <Input
                    id="accountId"
                    value={accountId}
                    onChange={handleAccountInput}
                    className="w-full mb-2"
                    type="text"
                    placeholder={t('cloudflareAccountIdPlaceholder')}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <div className="flex justify-between items-center ">
                    <Label htmlFor="namespaceId">{t('namespaceId')}</Label>
                    {namespaceId?.trim() && accountId?.trim() ? (
                      <a
                        href={`https://dash.cloudflare.com/${accountId.trim()}/workers/kv/namespaces/${namespaceId.trim()}`}
                        target="_blank"
                        className=" cursor-pointer underline ml-2"
                        rel="noreferrer">
                        {t('goToNamespace')}
                      </a>
                    ) : null}
                  </div>
                  <Input
                    id="namespaceId"
                    value={namespaceId}
                    onChange={handleNamespaceInput}
                    className="w-full mb-4"
                    type="text"
                    placeholder={t('namespaceIdPlaceholder')}
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
