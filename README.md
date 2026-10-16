# Blackbook

Blackbook is a free, open-source, independent Digital SAT® practice environment and study simulator. It runs completely offline on your desktop with zero user accounts, zero tracking, and complete privacy.

*SAT® is a registered trademark of the College Board, which is not affiliated with and does not endorse this software.*

---

## Features

- **Realistic Test Room**: Authentic practice interface featuring timer controls, hide-timer mode, question navigation matrix, formula sheet reference, line reader, answer eliminator, and embedded Desmos graphing/scientific calculator.
- **Rich Study Modes**:
  - Full-length adaptive practice modules
  - Targeted drill mode with granular skill and difficulty selection
  - 20-question randomized rapid practice
  - Mistake notebook with automatic categorization and reflection notes
  - AI-guided weak-area drill generation (requires optional Groq key)
- **Deep Analytics & Insights**:
  - Comprehensive skill accuracy heatmaps across all Math and Reading/Writing domains
  - Pacing and time-spent-per-question analysis
  - Estimated score ranges and performance trends
  - AI coach summary and targeted study recommendations
- **100% Offline & Private**:
  - All test attempts, notes, mistakes, and metrics are stored locally in an SQLite database on your computer.
  - Zero telemetry, zero analytics tracking, and zero cloud accounts.
  - Portable Question Bank Backup: Export and import standalone `.zip` backups to share between your devices without re-downloading.

---

## Download & Installation

Visit the [Releases](https://github.com/cardinalf1/blackbook/releases) page to download the latest desktop installer:

- **Windows**: Download and run `Blackbook-Setup-1.0.0.exe`. See [Windows Installation Guide](docs/guides/INSTALL-WINDOWS.md).
- **macOS**: Download `Blackbook-1.0.0-mac.dmg`. See [macOS Installation Guide](docs/guides/INSTALL-MAC.md).

---

## Getting Started

1. **Question Bank**:
   - On first launch, click **Download Question Bank** to fetch the official public educator repository (~3,700 questions). A 10-question drill is available after ~30 seconds while the full bank finishes downloading in the background.
   - Alternatively, if you already have a `Blackbook-QuestionBank.zip` file, click **Import Existing Backup** to load questions instantly with zero network access.
2. **Optional Features**:
   - **Groq AI Explanations**: Free fast inference for hints, explanations, and coaching. See [Groq Setup Guide](docs/guides/GET-A-GROQ-KEY.md).
   - **Desmos Calculator**: Embed the official Desmos calculator in Math sections. See [Desmos Setup Guide](docs/guides/GET-A-DESMOS-KEY.md).
3. **Sharing with Classmates**:
   - Export a zip of your question bank from the **Question bank** screen. See [Friend Sharing Checklist](docs/guides/FRIEND-CHECKLIST.md).

---

## Network & Privacy Policy

Blackbook never uploads your test results, answers, notes, or practice history. External network egress occurs exclusively for:
1. Downloading public question bank items during initial setup or manual refresh.
2. Direct AI requests to `api.groq.com` when configured with your own Groq key.
3. Loading the Desmos calculator frame from `www.desmos.com` when configured with your own Desmos key.
4. Daily GitHub release checks for software updates.

For detailed network audit documentation, read [docs/network.md](docs/network.md).

---

## Development & Building from Source

### Prerequisites
- [Bun](https://bun.sh/) (v1.1+)
- Node.js (v20+)

### Commands
```bash
# Install dependencies
bun install

# Run the desktop app in development
bun run dev

# Run all unit and integration tests (Vitest)
bun run test

# Typecheck with TypeScript compiler
bun run typecheck

# Build web distribution bundle
bun run build

# Package desktop installer
bun run build:electron
```

### Content & Legal Note
This repository contains no copyrighted test questions, passages, or images. All tests execute using synthetic fixtures, and questions are downloaded directly by the user on their own machine.
