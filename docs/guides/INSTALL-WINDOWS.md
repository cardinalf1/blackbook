# Installing Blackbook on Windows

## System Requirements
- Windows 10 or Windows 11 (64-bit)
- ~250 MB free disk space for the application
- ~100 MB free disk space for the downloaded question bank and practice history

## Installation Steps

1. **Download the Installer**:
   - Go to the [Blackbook GitHub Releases](https://github.com/cardinalf1/blackbook/releases) page.
   - Download the latest installer: `Blackbook-Setup-1.0.0.exe`.

2. **Run the Installer**:
   - Double-click `Blackbook-Setup-1.0.0.exe`.
   - If Windows SmartScreen displays a notice (*"Windows protected your PC"*), click **More info** and then **Run anyway**. (Because Blackbook is open-source independent software without an expensive commercial code-signing certificate, Windows shows this for newly released executables).
   - Follow the prompt to complete installation. Blackbook installs to your user local program folder (`%LOCALAPPDATA%\Programs\blackbook`) and creates a desktop shortcut.

3. **First Launch**:
   - Launch Blackbook from the Start Menu or Desktop.
   - On the Welcome screen, click **Download Question Bank**. In about 30 seconds, initial practice questions will be ready for drilling while the rest of the bank finishes downloading in the background.
   - Alternatively, if you have a `Blackbook-QuestionBank.zip` file, click **Import Existing Backup** to load questions instantly without downloading.

## Where Your Data Lives
- App data and SQLite database: `%APPDATA%\Blackbook\`
  - `user.db`: your practice sessions, answers, notes, and metrics
  - `bank.json`: downloaded question bank
  - `prefs.json`: UI and tool preferences
  - `secrets/`: local encrypted credentials (Groq / Desmos)
- Backups: `Documents\Blackbook Backups\`
