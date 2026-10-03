# Project Safety & Development Guidelines (ERP)

## 🚨 MANDATORY: Git Push & Deployment Safety Requirement

The live website is deployed to:
**https://maint-dept.github.io/ERP/**

### 1. Incremental, Non-Destructive Evolution Only
- **NEVER** replace, re-import, reset, or overwrite the entire existing project with an older copy of files, backup ZIPs, or external exports.
- **NEVER** overwrite the current project with previously existing files.
- **NEVER** reset or revert the Git repository to an older commit to implement a new feature.
- **ALWAYS** start every task from the latest, current codebase in this repository (`HEAD` on `main`).
- **ALWAYS** make only targeted, required changes to the current/latest files.
- **ALWAYS** preserve all existing features, bug fixes, configurations, MySQL Primary and multi-database sync settings, authentication logic, roles, permissions, and user data.

### 2. Single Authoritative Source of Truth: `public/`
- **`public/` is the ONLY canonical source of truth** for all frontend files (`public/index.html`, `public/js/`, `public/css/`, `public/lib/`).
- **Why?**
  1. GitHub Pages deployment workflow (`.github/workflows/deploy.yml`) directly deploys `./public`.
  2. Local server (`server.js`) strictly serves from `path.join(__dirname, 'public')`.
- **Absolute Rule on Root Files**:
  - All development, edits, and updates MUST occur strictly inside `public/`.
  - Root copies are secondary mirrors only. If root files are synchronized, it must **ALWAYS be one-way: `public/` → root**.
  - **NEVER** copy root files into `public/`.
  - **NEVER** overwrite `public/` with root or external files.

### 3. Verification & Push Protocol
Before pushing any changes to GitHub:
1. **Check Git Status & Diffs**: Run `git status` and `git diff` to inspect every modified line. Ensure no existing features, permissions, configurations, or UI improvements were accidentally removed or reverted.
2. **Preserve Uncommitted Work**: If there are existing uncommitted changes in the workspace, do not blindly discard them. Understand and preserve them.
3. **Syntax / Code Check**: Validate all modified scripts (`node --check public/js/...`) to prevent runtime syntax errors.
4. **Test & Verify**: Confirm that the application loads and functions as expected.
5. **Commit & Push**: Commit with a clear, descriptive message and push to `origin/main`.
6. **Live Deployment**: Verify that GitHub Actions / GitHub Pages deploys the commit cleanly to `https://maint-dept.github.io/ERP/`.

### 4. Critical "Never Do This" List
- ❌ Do NOT restore an old ZIP as the project base.
- ❌ Do NOT import old files over newer files without checking differences.
- ❌ Do NOT reset/revert repository to an older commit to implement a new feature.
- ❌ Do NOT replace entire source code with a previously generated or cached version.
- ❌ Do NOT copy root files over `public/`.
- ❌ Do NOT remove existing database configurations (MySQL Primary & PostgreSQL sync).
- ❌ Do NOT remove existing Admin/User authentication, roles, or permission structures.
- ❌ Do NOT overwrite newer code with older code.
- ❌ Do NOT assume an old file is newer just because it already existed.

---
**Core Rule (Strict & Immutable)**:  
`Current Latest Code in public/ → New Change in public/ → Preserve All Previous Changes → Test → Git Diff Check → Commit → Push → Live Verify`  
*(NEVER: Old Version → Overwrite Current Version → Push)*

