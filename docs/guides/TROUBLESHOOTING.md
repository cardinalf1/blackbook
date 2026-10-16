# Troubleshooting & Diagnostics

## Common Issues and Solutions

### 1. Questions fail to download or hang
- **Cause**: College Board's public question repository servers may be temporarily experiencing rate limits or downtime.
- **Solution**:
  - Cancel the current download and click **Retry**.
  - Check your internet connection.
  - If you have a friend who uses Blackbook, ask them to export a `Blackbook-QuestionBank.zip` file and use the **Import Backup** button on the Question Bank page.

### 2. "Windows protected your PC" (SmartScreen) on installation
- **Cause**: Open-source tools released directly on GitHub without expensive corporate EV code-signing certificates trigger SmartScreen until reputation builds.
- **Solution**:
  - Click **More info**.
  - Click **Run anyway**.
  - You can verify the checksum of your installer against `SHA256SUMS.txt` published with the release on GitHub.

### 3. Groq AI returns an error or "Invalid API Key"
- **Cause**: The key was typed incorrectly, or your Groq API quota has been reached.
- **Solution**:
  - Open **Settings**, delete the saved key, and paste the exact key from `console.groq.com/keys`.
  - Click **Test Connection** to view the raw status response.

### 4. Desmos Calculator shows a blank window or fails to load
- **Cause**: Either an invalid Desmos API key was entered or your network is offline.
- **Solution**:
  - Verify your computer is connected to the internet (the calculator frame is loaded from Desmos's CDN).
  - Check your key in **Settings &rarr; Desmos Calculator**.

### 5. App crashes or shows the Error Screen
- **Action**:
  - Click **Copy diagnostics** on the error screen.
  - Check your data folder to ensure disk space is available.
  - Submit an issue on GitHub with the copied diagnostics (personal data and keys are automatically excluded from diagnostics).

## Finding Your App Data Folder
- **Windows**: `%APPDATA%\Blackbook` (press Win+R, type `%APPDATA%\Blackbook`, and press Enter).
- **macOS**: `~/Library/Application Support/Blackbook`.
- **Linux**: `~/.config/Blackbook`.
