import { useEffect, useState, type ReactNode } from 'react';
import { ApiError } from '../../services/api/client';
import { downloads } from '../../services/download/client';
import { estimateDownload } from '../../services/download/estimate';
import type { DownloadProgress, DownloadScopeChoice } from '../../types/download';
import { DownloadConsent } from './DownloadConsent';
import { DownloadProgressPanel } from './DownloadProgressPanel';
import { DownloadStart } from './DownloadStart';

/**
 * Wires the download screens to the local program: follows its progress stream, asks for consent
 * before every run, and reloads the bank when a run succeeds. Holds no download logic itself.
 */
export function DownloadController(props: { hasBank: boolean; questionCount: number; importSlot: ReactNode; onBankChanged: () => void }) {
  const { onBankChanged } = props;
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [connected, setConnected] = useState(true);
  const [choosing, setChoosing] = useState<DownloadScopeChoice | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let lastStatus: DownloadProgress['status'] | null = null;
    return downloads.follow(
      (p) => {
        setProgress(p);
        if (p.status === 'running') setPanelOpen(true);
        if (p.status === 'succeeded' && lastStatus === 'running') onBankChanged();
        lastStatus = p.status;
      },
      setConnected,
    );
  }, [onBankChanged]);

  const run = async (scope: DownloadScopeChoice) => {
    setChoosing(null);
    setError(null);
    try {
      setProgress(await downloads.start(scope));
      setPanelOpen(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    }
  };

  const act = (fn: () => Promise<unknown>) => () => {
    setError(null);
    fn().catch((e: unknown) => setError(e instanceof ApiError ? e.message : String(e)));
  };

  const running = progress?.status === 'running';

  return (
    <>
      {!connected && (
        <p className="rounded-lg border border-amber-900/50 bg-amber-950/30 p-3 text-sm text-amber-200" role="status">
          Lost contact with Blackbook's local program. Reconnecting...
        </p>
      )}
      {error && (
        <p className="rounded-lg border border-red-900/50 bg-[#121215] p-3 text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
      {running && !panelOpen ? (
        <button
          type="button"
          onClick={() => setPanelOpen(true)}
          className="w-full rounded-lg border border-[#27272A] bg-[#121215] p-4 text-left text-sm text-zinc-200 hover:border-zinc-500"
        >
          A download is running. Show progress
        </button>
      ) : (
        !running && (
          <DownloadStart
            hasBank={props.hasBank}
            questionCount={props.questionCount}
            estimate={estimateDownload}
            onChoose={setChoosing}
            importSlot={props.importSlot}
          />
        )
      )}
      {choosing && (
        <DownloadConsent
          scope={choosing}
          estimate={estimateDownload(choosing)}
          dataFolder={progress?.dataFolder ?? ''}
          onConfirm={() => void run(choosing)}
          onCancel={() => setChoosing(null)}
        />
      )}
      {progress && panelOpen && progress.status !== 'idle' && (
        <DownloadProgressPanel
          progress={progress}
          onCancel={act(() => downloads.cancel())}
          onRetry={() => {
            if (progress.scope) setChoosing(progress.scope);
          }}
          onClose={() => setPanelOpen(false)}
          onFreeCache={act(async () => setProgress(await downloads.freeCache()))}
        />
      )}
    </>
  );
}
