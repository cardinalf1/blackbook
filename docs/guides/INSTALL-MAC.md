# Installing Blackbook on macOS

## System Requirements
- macOS 12 (Monterey) or later (Apple Silicon or Intel)
- ~300 MB free disk space

## Installation Steps

1. **Download the DMG**:
   - Go to [Blackbook GitHub Releases](https://github.com/cardinalf1/blackbook/releases).
   - Download `Blackbook-1.0.0-mac.dmg` (or build from source with `bun run build:electron`).

2. **Install to Applications**:
   - Double-click the downloaded `.dmg` file.
   - Drag the `Blackbook` app icon into your `Applications` folder.

3. **Gatekeeper Notice**:
   - The first time you launch Blackbook, macOS may display a message stating the developer cannot be verified.
   - To open: Right-click (or Control-click) `Blackbook` in `Applications` and select **Open**, then click **Open** in the confirmation dialog.

4. **First Run**:
   - On the Welcome screen, choose **Download Question Bank** to fetch questions, or import a pre-existing `Blackbook-QuestionBank.zip` file.

## Where Your Data Lives
- App data and SQLite database: `~/Library/Application Support/Blackbook/`
  - `user.db`: your practice sessions and attempts
  - `bank.json`: local question repository
  - `prefs.json`: preferences
- Backups: `~/Documents/Blackbook Backups/`
