import { useState } from 'react';
import type { BankScreenProps } from '../../types/home';
import type { BankBackupState } from '../../types/screens';
import { DownloadController } from '../download/DownloadController';
import { ImportPanel } from '../ImportPanel';
import { BankBackupPanel } from '../release/BankBackupPanel';
import { T } from '../ui/tokens';

export function BankScreen({
  questionCount,
  onBankChanged,
  onBack,
}: BankScreenProps) {
  const hasBank = questionCount > 0;
  const [backupState, setBackupState] = useState<BankBackupState>({ kind: 'idle' });

  const handleExport = async () => {
    setBackupState({ kind: 'exporting' });
    try {
      const res = await fetch('/api/bank/export');
      if (!res.ok) throw new Error('Export failed.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const header = res.headers.get('content-disposition');
      const filenameMatch = header?.match(/filename="?([^"]+)"?/);
      a.download = (filenameMatch && filenameMatch[1]) ? filenameMatch[1] : 'Blackbook-QuestionBank.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setBackupState({ kind: 'exported', canShowFile: false });
    } catch (e) {
      setBackupState({ kind: 'error', message: e instanceof Error ? e.message : 'Export failed.' });
    }
  };

  const handleImport = async (file: File) => {
    setBackupState({ kind: 'importing', fileName: file.name, progress: null });
    try {
      const buffer = await file.arrayBuffer();
      const res = await fetch('/api/bank/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: buffer,
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) {
        throw new Error(data.error ?? 'Import failed.');
      }
      setBackupState({ kind: 'imported', questions: data.imported ?? 0 });
      onBankChanged();
    } catch (e) {
      setBackupState({ kind: 'error', message: e instanceof Error ? e.message : 'Import failed.' });
    }
  };

  return (
    <div className={`${T.page} p-4 sm:p-6 max-w-4xl mx-auto space-y-6`}>
      <header className="flex items-center gap-4 border-b border-[#27272A] pb-4">
        <button
          type="button"
          onClick={onBack}
          className={`${T.secondary} text-xs py-1.5 px-3`}
          aria-label="Back"
        >
          Back
        </button>
        <h1 className={`${T.title} text-base`}>Question bank</h1>
      </header>

      <div className="space-y-6">
        <DownloadController
          hasBank={hasBank}
          questionCount={questionCount}
          importSlot={<ImportPanel onImported={onBankChanged} />}
          onBankChanged={onBankChanged}
        />
        <BankBackupPanel
          hasBank={hasBank}
          questionCount={questionCount}
          state={backupState}
          onExport={handleExport}
          onImport={handleImport}
        />
        <ImportPanel onImported={onBankChanged} />
      </div>
    </div>
  );
}
