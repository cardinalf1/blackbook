# Legal Architecture and Analysis

This document outlines the legal principles, copyright considerations, and trademark compliance policies guiding the architecture of Blackbook.

## 1. Zero Copyrighted Test Content in the Codebase

- **Principle**: The Blackbook repository and distributed installer executables contain **zero copyrighted test questions, passages, stimuli, answer choices, or official answer explanations**.
- **Implementation**:
  - The `data/` and `fixtures/` folders containing real questions or local user databases are strictly ignored by `.gitignore` and enforced by automated tests (`scripts/gitignore.test.ts`).
  - Unit and integration tests run entirely against synthetic in-memory fixtures (`services/__fixtures__/synthetic.ts`).
  - Question content is acquired strictly by the end user on their own local machine by downloading directly from the public educator repository (`api.collegeboard.org`) or importing a user-provided file.

## 2. Independent Software Architecture

- **Clean-Room Implementation**: Blackbook is an independent, original software implementation written in TypeScript, React, and Bun. No proprietary source code, binaries, or reverse-engineered assets from testing organizations are included.
- **Local Program / No SaaS Relay**: Blackbook has no central servers, proxies, or SaaS relays. The application executes 100% locally on the user's personal computer.
- **User Privacy**: All practice attempts, notes, answers, and metrics remain encrypted and stored locally in the user's application data folder.

## 3. Nominative Fair Use of Trademarks

- "SAT®" and "College Board®" are registered trademarks of the College Board.
- Under trademark law (the nominative fair use doctrine):
  - Referencing "SAT" is necessary to identify the test for which the software helps students prepare.
  - The marks are used only to the extent necessary to identify the subject matter.
  - No logos, stylized marks, or branding elements belonging to the College Board are used.
  - A prominent disclaimer is displayed across the application, repository, documentation, and releases:
    > *"SAT® is a registered trademark of the College Board, which is not affiliated with and does not endorse this software."*

## 4. Third-Party Integrations

- **Desmos®**:
  - The Desmos calculator is embedded via Desmos Studio PBC's official API in an iframe.
  - Blackbook requires users to provide their own Desmos API key.
  - No test attempts or user practice data are communicated to Desmos.
- **Groq®**:
  - AI question explanations and coaching are powered by Groq's official API.
  - Users provide their own personal Groq API key.
  - The application communicates directly via HTTPS to `api.groq.com`; no intermediaries exist.
