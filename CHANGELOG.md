# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-10-16

### Initial Public Release
- **Test Room Simulation**:
  - Full Digital SAT authentic testing environment.
  - Live module timer, hide-timer option, and 5-minute warning banner.
  - Formula sheet reference sheet with geometric facts and formulas.
  - Answer choice strike-through eliminator and question flagging.
  - Line reader tool with drag, resize, and darkening masks.
  - Full-screen figure zoom and inspection frames.
  - Highlight and annotation toolbar with 4 color styles and note saving.
  - Sandboxed Desmos calculator integration (graphing and scientific modes) using user API key.
- **Practice Modes & Study Workflows**:
  - Full-length adaptive exam simulation with multistage scoring engine.
  - Granular drill builder with taxonomy filtering across all Math and Reading/Writing skills and difficulty levels.
  - 20-question rapid blitz mode with randomized draws.
  - Mistake notebook with automatic error tagging, categorized review, and reflection notes.
  - AI weak-area drill generator with personalized practice sets (powered by user Groq key).
- **Analytics & Mastery Insights**:
  - Domain and skill-level accuracy heatmaps.
  - Pacing charts with time-spent-per-question distribution and speed alerts.
  - Score projection ranges based on realistic item-response models.
  - AI coach summary highlighting high-yield study topics.
- **Desktop Architecture & Privacy**:
  - Standalone desktop client powered by Electron and a high-performance local Bun sidecar.
  - 100% offline data storage in local SQLite database and JSON bank file.
  - Zero telemetry, zero analytics tracking, zero centralized user accounts.
  - Portable Question Bank zip backup export and import for seamless offline sharing.
  - Two-stage fast downloader with immediate drill capability in ~30 seconds.
