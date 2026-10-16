import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { WelcomeScreen } from './WelcomeScreen';
import { WhileYouWaitPanel } from './WhileYouWaitPanel';
import { BankBackupPanel } from './BankBackupPanel';
import { SaveCopyPrompt } from './SaveCopyPrompt';
import { HelpScreen } from './HelpScreen';
import { AboutScreen } from './AboutScreen';

describe('Phase 10 Screen Components (Step 5 & 6)', () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount();
      });
      root = null;
    }
    container.remove();
  });

  it('WelcomeScreen renders all options and handles clicks', async () => {
    const onDownload = vi.fn();
    const onImport = vi.fn();
    const onLookAround = vi.fn();

    await act(async () => {
      root?.render(
        <WelcomeScreen
          onDownload={onDownload}
          onImport={onImport}
          onLookAround={onLookAround}
          downloadEnabled={true}
        />,
      );
    });

    expect(container.textContent).toContain('Welcome to Blackbook');
    expect(container.textContent).toContain('Download Question Bank');
    expect(container.textContent).toContain('Import Existing Backup');
    expect(container.textContent).toContain('Look Around First');

    const buttons = container.querySelectorAll('button');
    buttons[0]?.click();
    expect(onDownload).toHaveBeenCalledTimes(1);

    buttons[1]?.click();
    expect(onImport).toHaveBeenCalledTimes(1);

    buttons[2]?.click();
    expect(onLookAround).toHaveBeenCalledTimes(1);
  });

  it('WhileYouWaitPanel enables first drill when stage one is ready', async () => {
    const onStartFirstDrill = vi.fn();
    const onOpenGuide = vi.fn();
    const onOpenSettings = vi.fn();

    await act(async () => {
      root?.render(
        <WhileYouWaitPanel
          stageOneReady={true}
          questionsReady={2000}
          groqKeySaved={false}
          desmosKeySaved={true}
          onOpenSettings={onOpenSettings}
          onStartFirstDrill={onStartFirstDrill}
          onOpenGuide={onOpenGuide}
        />,
      );
    });

    expect(container.textContent).toContain('While You Wait');
    expect(container.textContent).toContain('2000 questions ready');
    expect(container.textContent).toContain('Start First Drill');

    const drillBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Start First Drill'));
    drillBtn?.click();
    expect(onStartFirstDrill).toHaveBeenCalledTimes(1);
  });

  it('BankBackupPanel renders state and triggers callbacks', async () => {
    const onExport = vi.fn();
    const onImport = vi.fn();
    const onShowFile = vi.fn();

    await act(async () => {
      root?.render(
        <BankBackupPanel
          hasBank={true}
          questionCount={3695}
          state={{ kind: 'exported', canShowFile: true }}
          onExport={onExport}
          onImport={onImport}
          onShowFile={onShowFile}
        />,
      );
    });

    expect(container.textContent).toContain('Question bank backup exported successfully!');
    expect(container.textContent).toContain('3695 questions stored');

    const showBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Show in folder'));
    showBtn?.click();
    expect(onShowFile).toHaveBeenCalledTimes(1);
  });

  it('SaveCopyPrompt fires onSave and onNotNow', async () => {
    const onSave = vi.fn();
    const onNotNow = vi.fn();

    await act(async () => {
      root?.render(
        <SaveCopyPrompt
          questionCount={3695}
          onSave={onSave}
          onNotNow={onNotNow}
        />,
      );
    });

    expect(container.textContent).toContain('Download Complete!');
    expect(container.textContent).toContain('3695');

    const buttons = container.querySelectorAll('button');
    buttons[0]?.click(); // Not now
    expect(onNotNow).toHaveBeenCalledTimes(1);

    buttons[1]?.click(); // Save backup copy
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('HelpScreen displays data folder and copies diagnostics', async () => {
    const onCopyDiagnostics = vi.fn().mockResolvedValue(true);
    const onOpenSettings = vi.fn();
    const onBack = vi.fn();

    await act(async () => {
      root?.render(
        <HelpScreen
          desktop={true}
          dataFolder="C:/Test/DataFolder"
          onOpenDataFolder={vi.fn()}
          onCopyDiagnostics={onCopyDiagnostics}
          onOpenSettings={onOpenSettings}
          onBack={onBack}
        />,
      );
    });

    expect(container.textContent).toContain('Help & Troubleshooting');
    expect(container.textContent).toContain('C:/Test/DataFolder');

    const copyBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Copy Diagnostics'));
    await act(async () => {
      copyBtn?.click();
    });
    expect(onCopyDiagnostics).toHaveBeenCalledTimes(1);
  });

  it('AboutScreen shows versions and triggers licenses view', async () => {
    const onOpenLicenses = vi.fn();
    const onBack = vi.fn();

    await act(async () => {
      root?.render(
        <AboutScreen
          version="1.0.0"
          electron="32.0.0"
          platform="win32"
          onOpenLicenses={onOpenLicenses}
          onBack={onBack}
        />,
      );
    });

    expect(container.textContent).toContain('Blackbook v1.0.0');
    expect(container.textContent).toContain('win32');
    expect(container.textContent).toContain('32.0.0');

    const licBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Third-Party Licenses'));
    licBtn?.click();
    expect(onOpenLicenses).toHaveBeenCalledTimes(1);
  });
});
