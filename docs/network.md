# Network Egress Policy and Audit

Blackbook is a fully local desktop application. Your practice questions, answers, notes, attempts, mistakes, time-per-question, and telemetry are stored exclusively on your own machine in your user data folder (`user.db`, `bank.json`, `prefs.json`). They are never uploaded or sent to any central server, analytics provider, or telemetry collector.

## Network Traffic Rules

1. **Zero Phone-Home / Zero Telemetry**:
   - The app has no user accounts, no tracking pixels, no Google Analytics, no PostHog, and no telemetry pings.
   - All telemetry and event logs are strictly local and stored in `user.db`.

2. **Permitted External Destinations**:
   External network requests occur only for four explicitly user-driven features:

   | Destination | Host / Domain | Trigger | What is Transferred |
   |-------------|---------------|---------|---------------------|
   | **Question Bank Download** | `api.collegeboard.org`, `questionbank.collegeboard.org` | Initial first-run setup or manual refresh clicked by user | HTTPS GET to fetch public questions and PDF source links. No user data sent. |
   | **AI Explanations & Coaching** | `api.groq.com` | User explicitly asks for AI explanation or coaching with their own Groq API key | Question prompt, passage, choices, user's response, and system prompt. Key sent in auth header. If "Include question text" setting is turned off by user, only skill code/domain is sent. |
   | **Desmos Calculator Frame** | `www.desmos.com` | User opens calculator in Math section with their own Desmos API key | Desmos calculator embedded script/frame from official Desmos CDN. No practice data sent. |
   | **Update Checks** | `api.github.com` | Daily check (can be disabled in Settings) | HTTPS GET to `https://api.github.com/repos/cardinalf1/blackbook/releases/latest`. Sends User-Agent header only. No user data, progress, or keys sent. |

3. **Electron Security Restrictions**:
   - The Electron window runs with context isolation enabled and nodeIntegration disabled.
   - The web session webRequest filter blocks navigation to any host other than `127.0.0.1:<port>`.
   - External links clicked by the user (such as documentation guides) are opened exclusively in the operating system's default browser via `shell.openExternal`, never inside the application container.
