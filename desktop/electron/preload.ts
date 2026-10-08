// The bridge between the page and the main process: only these calls exist, all of them checked on the other side.

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  store: {
    read: (name: string) => ipcRenderer.invoke('store:read', name),
    write: (name: string, json: string) => ipcRenderer.invoke('store:write', name, json),
  },
  blobs: {
    put: (id: string, data: Uint8Array) => ipcRenderer.invoke('blob:put', id, data),
    get: (id: string) => ipcRenderer.invoke('blob:get', id),
    delete: (id: string) => ipcRenderer.invoke('blob:delete', id),
  },
  secret: {
    get: (account: string) => ipcRenderer.invoke('secret:get', account),
    set: (account: string, value: string) => ipcRenderer.invoke('secret:set', account, value),
    delete: (account: string) => ipcRenderer.invoke('secret:delete', account),
  },
  http: (request: unknown) => ipcRenderer.invoke('http', request),
  openFiles: (options: unknown) => ipcRenderer.invoke('files:open', options),
  saveFile: (name: string, data: Uint8Array) => ipcRenderer.invoke('files:save', name, data),
  htmlToPdf: (html: string) => ipcRenderer.invoke('pdf:html', html),
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  calc: {
    show: (rect: { x: number; y: number; width: number; height: number }) => ipcRenderer.send('calc:show', rect),
    hide: () => ipcRenderer.send('calc:hide'),
  },
  onNavigate: (callback: (index: number) => void) => {
    const listener = (_event: unknown, index: number) => callback(index);
    ipcRenderer.on('navigate', listener);
    return () => ipcRenderer.removeListener('navigate', listener);
  },
  version: ipcRenderer.sendSync('app:version') as string,
});
