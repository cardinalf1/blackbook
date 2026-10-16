// The only bridge between the page and the desktop shell. It runs sandboxed with context
// isolation, so the page never gets ipcRenderer or Node; it gets these few named calls.

import { contextBridge, ipcRenderer } from 'electron';
import type { BlackbookDesktop, DesktopPage, DesktopPageState } from '../src/types/desktop';

let stateHandler: (() => DesktopPageState | Promise<DesktopPageState>) | null = null;
let flushHandler: (() => Promise<void>) | null = null;
let navigateHandler: ((page: DesktopPage) => void) | null = null;

ipcRenderer.on('bb:query-state', (_e, id: number) => {
  void (async () => {
    let state: DesktopPageState = { timedTestInProgress: false };
    try {
      if (stateHandler) state = await stateHandler();
    } catch {
      // answer with the default
    }
    ipcRenderer.send('bb:state', id, { timedTestInProgress: state.timedTestInProgress === true });
  })();
});

ipcRenderer.on('bb:flush', (_e, id: number) => {
  void (async () => {
    let ok = true;
    try {
      if (flushHandler) await flushHandler();
    } catch {
      ok = false;
    }
    ipcRenderer.send('bb:flush-done', id, ok);
  })();
});

ipcRenderer.on('bb:navigate', (_e, page: unknown) => {
  if ((page === 'help' || page === 'about') && navigateHandler) navigateHandler(page);
});

const api: BlackbookDesktop = {
  version: () => ipcRenderer.invoke('bb:version'),
  quit: () => ipcRenderer.invoke('bb:quit'),
  openDataFolder: () => ipcRenderer.invoke('bb:open-data-folder'),
  showLastDownload: () => ipcRenderer.invoke('bb:show-last-download'),
  openExternal: (url) => ipcRenderer.invoke('bb:open-external', String(url)),
  copyDiagnostics: (lines) => ipcRenderer.invoke('bb:copy-diagnostics', Array.from(lines, String).slice(-40)),
  updateStatus: () => ipcRenderer.invoke('bb:update-status'),
  setUpdateCheck: (enabled) => ipcRenderer.invoke('bb:set-update-check', enabled === true),
  restartProgram: () => ipcRenderer.invoke('bb:restart-program'),
  onStateQuery: (h) => {
    stateHandler = h;
  },
  onFlush: (h) => {
    flushHandler = h;
  },
  onNavigate: (h) => {
    navigateHandler = h;
  },
};

contextBridge.exposeInMainWorld('blackbookDesktop', api);
