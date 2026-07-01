import { isTrustedExtensionSender, Message, MessageType, SendResponse } from '@sync-your-cookie/shared';
import { devLog } from '@sync-your-cookie/shared/lib/utils/devLog';
import EventEmitter from 'eventemitter3';

/**
 * 消息监听器类
 * 基于发布订阅模式，集中管理消息处理
 */
export class MessageListener {
  private emitter: EventEmitter;
  private static instance: MessageListener;
  public debuggerOpen = true;

  private timer: number | null = null;

  constructor() {
    this.emitter = new EventEmitter();
    this.init();
  }

  public static getInstance(): MessageListener {
    if (!MessageListener.instance) {
      MessageListener.instance = new MessageListener();
    }
    return MessageListener.instance;
  }

  handleMessage = (
    message: Message,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: SendResponse) => void,
  ) => {
    if (!isTrustedExtensionSender(sender)) {
      return false;
    }

    if (message.toString() === 'ping') {
      this.listen();
      return;
    }

    if (message.type === MessageType.GetLocalStorage) {
      this.emit(MessageType.GetLocalStorage, message.payload, sendResponse);
    } else if (message.type === MessageType.SetLocalStorage) {
      this.emit(MessageType.SetLocalStorage, message.payload, sendResponse);
    }
    return true;
  };

  private init(): void {
    this.listen(false);
  }

  public ping = () => {
    chrome.runtime.sendMessage('ping', () => {
      setTimeout(this.ping, 1000);
    });
  };

  public listen = (initSetTimeout = true) => {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    const fn = this.handleMessage;
    chrome.runtime.onMessage.removeListener(fn);
    chrome.runtime.onMessage.addListener(fn);
    if (initSetTimeout) {
      this.timer = setTimeout(() => {
        devLog('listen timeout reset');
        this.listen();
      }, 6000);
    }
  };

  public on(event: string, callback: (...args: any[]) => void): void {
    this.emitter.on(event, callback);
  }

  async emit(event: string, data: any, sendResponse?: (...args: any[]) => void): Promise<void> {
    devLog('content message payload', event);
    return new Promise((resolve, reject) => {
      try {
        if (sendResponse) {
          this.emitter.emit(event, data, (message: unknown) => {
            sendResponse(message);
            resolve();
          });
        } else {
          this.emitter.emit(event, data);
          resolve();
        }
      } catch (error) {
        reject(error);
      }
    });
  }
}

export const messageListener = MessageListener.getInstance();
