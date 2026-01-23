# Contributing to MCP Repo Search Server

First off, thanks for taking the time to contribute! 🎉

This project follows a **strict, secure, and structured** development philosophy. We love contributions that make the server faster, smarter, or safer.

## ⚖️ Legal Note

By contributing to this project, you agree that your contributions will be licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**.

---

## 🛠️ Development Workflow

We use the standard GitHub Flow:

1.  **Fork** the repository.
2.  **Clone** your fork locally.
3.  **Create a Branch** for your feature (`git checkout -b feature/amazing-feature`).
4.  **Install Dependencies**:
    ```bash
    npm install
    ```
5.  **Code** your feature.
6.  **Test**: Ensure all tests pass.
    ```bash
    npm test
    ```
7.  **Push** to your branch.
8.  **Open a Pull Request**.

---

## 🧪 Testing Guidelines

We take stability seriously. **No PR will be merged without tests.**

*   **Unit Tests**: We use `vitest`.
*   **Security Tests**: Modifying file access? You MUST add tests in `src/utils/path-utils.spec.ts`.
*   **Run Tests**: `npm test` runs the full suite.

---

## 🏗️ Project Structure

*   `src/core`: Low-level logic (Config persistence, Git scanning).
*   `src/search`: The engines (Text, AST, File).
*   `src/tools`: MCP Tool definitions (Glue code).
*   `src/utils`: Helpers (Path security, Logger).

---

## 📝 Commit Messages

We prefer [Conventional Commits](https://www.conventionalcommits.org/):

*   `feat: add support for Python AST`
*   `fix: resolve symlink issue on Windows`
*   `docs: update README badges`
*   `refactor: simplify repository manager`

---

Thank you for building with us! 🚀
