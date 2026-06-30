import {
  ErrorFallback,
  extractDomainAndPort,
  GITHUB_REPO_URL,
  LoadingFallback,
  openExtensionOptionsPage,
  useDocumentTitle,
  useI18n,
  useStorageSuspense,
  useTheme,
  withErrorBoundary,
  withSuspense,
} from '@sync-your-cookie/shared';

import { accountProfileStorage, getActiveProfile } from '@sync-your-cookie/storage/lib/accountProfileStorage';
import { Button, Image, Spinner, Toaster } from '@sync-your-cookie/ui';
import { CloudDownload, CloudUpload, Copyright, PanelRightOpen, RotateCw, Settings } from 'lucide-react';
import { useEffect, useState } from 'react';

import { AutoSwitch } from './components/AutoSwtich';
import { useDomainConfig } from './hooks/useDomainConfig';

const Popup = () => {
  const { theme } = useTheme();
  const { t } = useI18n();
  useDocumentTitle('pageTitlePopup');
  const profileState = useStorageSuspense(accountProfileStorage);
  const activeProfile = getActiveProfile(profileState);
  const [activeTabUrl, setActiveTabUrl] = useState('');
  const [favIconUrl, setFavIconUrl] = useState('');

  const {
    pushing,
    toggleAutoPushState,
    toggleAutoPullState,
    domain,
    setDomain,
    domainItemConfig,
    domainItemStatus,
    handlePush,
    handlePull,
  } = useDomainConfig();

  useEffect(() => {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, async function (tabs) {
      if (tabs.length > 0) {
        const activeTab = tabs[0];
        if (activeTab.url && activeTab.url.startsWith('http')) {
          setFavIconUrl(activeTab?.favIconUrl || '');
          setActiveTabUrl(activeTab.url);
          const [domain, tempPort] = await extractDomainAndPort(activeTab.url);
          setDomain(domain + `${tempPort ? ':' + tempPort : ''}`);
        }
      }
    });
  }, []);

  const isPushingOrPulling = domainItemStatus.pushing || domainItemStatus.pulling;

  const handleAndReload = () => {
    handlePull(activeTabUrl, domain, true);
  };

  return (
    <div className="flex flex-col items-center min-w-[400px] justify-center bg-background ">
      <header className=" p-2 flex w-full justify-between items-center bg-card/50 shadow-md border-b border-border ">
        <div className="flex items-center">
          <img
            src={chrome.runtime.getURL('options/logo.png')}
            className="h-10 w-10 overflow-hidden object-contain "
            alt="logo"
          />
          <div className="flex flex-col">
            <h2 className="text-base text-foreground	font-bold">{t('appName')}</h2>
            {activeProfile ? (
              <span className="text-xs text-muted-foreground truncate max-w-[180px]">
                {t('currentProfile', { name: activeProfile.name })}
              </span>
            ) : null}
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            openExtensionOptionsPage();
          }}
          className="cursor-pointer text-sm mr-[-8px] ">
          <Settings size={20} />
        </Button>
      </header>
      <main className="p-4 ">
        <Spinner show={false}>
          {domain ? (
            <div className="flex justify-center items-center mb-2  ">
              <Image src={favIconUrl} />
              <h3 className="text-center whitespace-nowrap text-xl text-primary font-bold">{domain}</h3>
            </div>
          ) : null}

          <div className=" flex flex-col">
            {/* <Button title={cloudflareAccountId} className="mb-2" onClick={handleUpdateToken}>
            Update Token
          </Button> */}
            <div className="flex items-center mb-2 ">
              <Button
                disabled={!activeTabUrl || isPushingOrPulling || pushing}
                className=" mr-2 w-[160px] justify-start"
                onClick={() => handlePush(domain, activeTabUrl, favIconUrl)}>
                {domainItemStatus.pushing ? (
                  <RotateCw size={16} className="mr-2 animate-spin" />
                ) : (
                  <CloudUpload size={16} className="mr-2" />
                )}
                {t('pushCookie')}
              </Button>
              <AutoSwitch
                disabled={!activeTabUrl}
                onChange={() => toggleAutoPushState(domain)}
                id="autoPush"
                value={!!domainItemConfig.autoPush}
              />
            </div>

            <div className="flex items-center mb-2 ">
              <Button
                disabled={!activeTabUrl || isPushingOrPulling}
                className=" w-[160px] mr-2 justify-start"
                onClick={() => handleAndReload()}>
                {domainItemStatus?.pulling ? (
                  <RotateCw size={16} className="mr-2 animate-spin" />
                ) : (
                  <CloudDownload size={16} className="mr-2" />
                )}
                {t('pullCookie')}
              </Button>

              <AutoSwitch
                disabled={!activeTabUrl}
                onChange={() => toggleAutoPullState(domain)}
                id="autoPull"
                value={!!domainItemConfig.autoPull}
              />
            </div>

            <Button
              className="mb-2 justify-start"
              onClick={async () => {
                chrome.windows.getCurrent(async currentWindow => {
                  // const res = await chrome.sidePanel.getOptions({
                  //   tabId: currentWindow.id,
                  // });
                  chrome.sidePanel
                    .open({ windowId: currentWindow.id! })
                    .then(() => {
                      console.log('Side panel opened successfully');
                    })
                    .catch(error => {
                      console.error('Error opening side panel:', error);
                    });
                });
              }}>
              <PanelRightOpen size={16} className="mr-2" />
              {t('openManager')}
            </Button>
          </div>
          <Toaster
            theme={theme}
            closeButton
            toastOptions={{
              duration: 1500,
              style: {
                // width: 'max-content',
                // margin: '0 auto',
              },
              // className: 'w-[240px]',
            }}
            visibleToasts={1}
            richColors
            position="top-center"
          />
        </Spinner>
      </main>
      <footer className="w-full text-center justify-center p-4 flex items-center border-t border-border/90 ">
        <span>
          <Copyright size={16} />
        </span>
        <a
          className="inline-flex items-center mx-1 text-sm underline"
          href={GITHUB_REPO_URL}
          target="_blank"
          rel="noopener noreferrer">
          cf-fork-div
        </a>
        <a href={GITHUB_REPO_URL} target="_blank" rel="noopener noreferrer">
          <img
            src={chrome.runtime.getURL('popup/github.svg')}
            className="h-4 w-4 overflow-hidden object-contain "
            alt="GitHub"
          />
        </a>
      </footer>
    </div>
  );
};

export default withErrorBoundary(withSuspense(Popup, <LoadingFallback />), <ErrorFallback />);
