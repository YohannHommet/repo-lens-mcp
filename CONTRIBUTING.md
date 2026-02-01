# Contributing to MCP Repo Search Server

First off, thanks for taking the time to contribute! 🎉

This project follows a **strict, secure, and structured** development philosophy. We love contributions that make the server faster, smarter, or safer.

## ⚖️ Legal Note

By contributing to this project, you agree that your contributions will be licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**.

---

## 🛠️ Development Workflow

We use the standard GitHub Flow:

1. **Fork** the repository.
2. **Clone** your fork locally.
3. **Create a Branch** for your feature (`git checkout -b feature/amazing-feature`).
4. **Install Dependencies**:

    ```bash
    npm install
    ```

5. **Code** your feature.
6. **Lint**: Ensure code passes fast oxlint checks.

    ```bash
    npm run lint          # Fast oxlint checks
    npm run lint:fix      # Auto-fix linting issues
    ```

7. **Test**: Ensure all tests pass.

    ```bash
    npm test              # Run test suite
    npm run test:coverage # Check coverage (target: 90%+)
    ```

8. **Build**: Verify the build works with tsdown.

    ```bash
    npm run build         # Build with tsdown
    ```

9. **Push** to your branch.
10. **Open a Pull Request**.

---

## 🚀 Performance & Tooling

We've optimized our development toolchain for speed:

### **Fast Linting with oxlint**

- **25x faster** than ESLint (40ms vs 1s+)
- Auto-fix most issues: `npm run lint:fix`
- Focus on correctness and suspicious rules by default

### **Modern Build with tsdown**

- **Zero-config** TypeScript bundling
- **Faster builds** than tsc
- ESM output with proper tree-shaking

### **Comprehensive Testing**

- **90%+ test coverage** required
- **Security tests** for file operations
- **Performance benchmarks** for regressions

---

## 🧪 Testing Guidelines

We take stability seriously. **No PR will be merged without tests.**

- **Unit Tests**: We use `vitest`.
- **Security Tests**: Modifying file access? You MUST add tests in `src/utils/path-utils.spec.ts`.
- **Run Tests**: `npm test` runs the full suite.

---

## 🏗️ Project Structure

- `src/core`: Low-level logic (Config persistence, Git scanning)
- `src/search`: Search engines (Text, AST, API routes)
- `src/tools`: MCP Tool definitions (Glue code)
- `src/utils`: Helpers (Path security, Logger)
- `src/parsers`: Language parsers and AST handling
- `scripts/`: Build and benchmark scripts
- `docs/`: Documentation and guides

---

## � Linting Configuration

We use **oxlint** with a focused rule set:

### **Enabled Categories**

- `correctness`: Code that is outright wrong
- `suspicious`: Code that is most likely wrong

### **Configuration File**

- `.oxlintrc.json`: Main oxlint configuration
- Uses local schema reference for reliability

### **Common Commands**

```bash
npm run lint          # Check for issues
npm run lint:fix      # Auto-fix safe issues
npx oxlint --fix      # More aggressive fixes
```

### **Note on Strict Rules**

- No async/await in tests (use sync alternatives when possible)
- No optional chaining (use explicit null checks)
- No object spread (use Object.assign)

---

## �📝 Commit Messages

We prefer [Conventional Commits](https://www.conventionalcommits.org/):

- `feat: add support for Python AST`
- `fix: resolve symlink issue on Windows`
- `docs: update README badges`
- `refactor: simplify repository manager`

---

Thank you for building with us! 🚀
