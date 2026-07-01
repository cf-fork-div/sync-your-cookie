import {
  DomainPayload,
  hostnameMatchesPage,
  MessageType,
  SendResponse,
  SetLocalStorageMessagePayload,
} from '@sync-your-cookie/shared';
import { devLog } from '@sync-your-cookie/shared/lib/utils/devLog';
import { messageListener } from './listener';

class Observer {
  subscribeGetLocalStorage(callback: (data: DomainPayload, sendResponse: (data: SendResponse) => void) => void) {
    messageListener.on(MessageType.GetLocalStorage, callback);
  }

  subscribeSetLocalStorage(
    callback: (data: SetLocalStorageMessagePayload, sendResponse: (data: SendResponse) => void) => void,
  ) {
    messageListener.on(MessageType.SetLocalStorage, callback);
  }
}

export const observer = new Observer();

class eventHandler {
  init() {
    this.handleGetLocalStorage();
    this.handleSetLocalStorage();
  }

  handleGetLocalStorage() {
    observer.subscribeGetLocalStorage(async (result: DomainPayload, sendResponse: (data: SendResponse) => void) => {
      if (!hostnameMatchesPage(window.location.hostname, result.domain)) {
        devLog('localStorage domain not match', result.domain);
        sendResponse({
          isOk: false,
          msg: 'localStorage domain not match',
        });
        return;
      }

      try {
        const items: { key: string; value: string }[] = [];
        const localObject = { ...localStorage };
        for (const key in localObject) {
          const value: string = localObject[key].toString();
          items.push({ key, value });
        }

        sendResponse({
          isOk: true,
          msg: 'get localStorage success',
          result: items,
        });
      } catch (error) {
        devLog('get localStorage error', error);
        sendResponse({
          isOk: false,
          msg: 'get localStorage error',
          result: error,
        });
      }
    });
  }

  handleSetLocalStorage() {
    observer.subscribeSetLocalStorage(
      async (result: SetLocalStorageMessagePayload, sendResponse: (data: SendResponse) => void) => {
        if (!hostnameMatchesPage(window.location.hostname, result.domain)) {
          devLog('localStorage domain not match', result.domain);
          sendResponse({
            isOk: false,
            msg: 'localStorage domain not match',
          });
          return;
        }

        try {
          const values = result.value;
          const setKey = result.onlyKey;
          if (result.replace) {
            localStorage.clear();
          }
          if (setKey) {
            const targetItem = values.find(item => item.key === setKey);
            if (targetItem) {
              localStorage.setItem(setKey, targetItem.value || '');
            } else {
              devLog('no target item', setKey);
            }
          } else {
            for (const item of values) {
              localStorage.setItem(item.key || '', item.value || '');
            }
          }
          sendResponse({
            isOk: true,
            msg: 'set localStorage success',
          });
        } catch (error) {
          devLog('set localStorage error', error);
          sendResponse({
            isOk: false,
            msg: 'set localStorage error',
            result: error,
          });
        }
      },
    );
  }
}

export const eventHandlerInstance = new eventHandler();
