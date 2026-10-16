import type { BankScreenProps } from '../../types/home';
import { DownloadController } from '../download/DownloadController';
import { ImportPanel } from '../ImportPanel';
import { T } from '../ui/tokens';

export function BankScreen({
  questionCount,
  onBankChanged,
  onBack,
}: BankScreenProps) {
  const hasBank = questionCount > 0;

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
        <ImportPanel onImported={onBankChanged} />
      </div>
    </div>
  );
}
