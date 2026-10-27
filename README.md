# 🛡️ contract-guard

[![CI](https://github.com/AhmedHoussou/contract-guard/actions/workflows/ci.yml/badge.svg)](https://github.com/AhmedHoussou/contract-guard/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> Autonomous API contract testing and negative boundary fuzzing engine for OpenAPI 3.0 / Swagger specifications.

`contract-guard` ingests your API specifications, resolves internal `$ref` schemas, synthesizes schema-compliant payloads, and autonomously generates boundary mutations (type mismatches, missing required fields, enum violations, and null injections) to expose schema drift and unhandled edge cases before they hit production.

---

## ⚡ Key Features

* **Zero-Config Schema Ingestion:** Parses YAML and JSON OpenAPI 3.0 specs and resolves complex nested `$ref` components.
* **Autonomous Boundary Fuzzing:** Automatically computes negative test vectors from schema constraints (`minLength`, `minimum`, `enum`, `required`).
* **Strict Contract Validation:** Validates API response bodies against defined response schemas using compiled JSON Schema validators (`ajv`).
* **Built-in Mock Server:** Includes a lightweight mock server mode (`--mock`) for local testing and CI pipeline verification.
* **Developer Velocity:** Executes a complete 15+ mutation suite in ~150ms with zero cloud dependencies.

---

## 🏗️ Architecture

```text
[OpenAPI 3.0 YAML / JSON Spec]
              │
              ▼
    [Spec Parser & Dereferencer]
              │
      ┌───────┴──────────────────────────┐
      ▼                                  ▼
[Contract Baseline]            [Boundary & Negative Fuzzer]
- Schema-compliant payloads    - Missing required properties
- 2xx Response verification     - Min/Max numerical bounds
- Response body validation      - MinLength string bounds
                               - Invalid enum values
                               - Type mutation (number -> string)
                               - Null injections
      │                                  │
      └────────────────┬─────────────────┘
                       ▼
             [HTTP Test Runner & Ajv]
                       │
                       ▼
         [Terminal Matrix & Exit Code]
```

---

## 🚀 Quick Start

### Installation

```bash
# Clone the repository
git clone [https://github.com/AhmedHoussou/contract-guard.git](https://github.com/AhmedHoussou/contract-guard.git)
cd contract-guard

# Install dependencies
npm install

# Build distribution
npm run build
```

### Running Locally with Built-in Mock Server

```bash
node dist/cli.js --spec sample-spec.yaml --mock
```

### Running Against a Live API

```bash
node dist/cli.js --spec ./specs/user-service.yaml --target [https://api.staging.example.com](https://api.staging.example.com)
```

---

## ⚙️ CLI Options

| Flag | Argument | Description | Default |
| :--- | :--- | :--- | :--- |
| `-s, --spec` | `<path>` | Path to OpenAPI 3.0 YAML or JSON spec | **Required** |
| `-t, --target` | `<url>` | Base URL of the target API service | `http://localhost:4000` |
| `--mock` | *None* | Starts an internal mock server for zero-setup execution | `false` |

---

## 🔄 CI/CD Pipeline Integration

Add `contract-guard` directly to your GitHub Actions workflow to block PRs that introduce breaking schema changes:

```yaml
name: API Contract Guard

on:
  pull_request:
    paths:
      - 'openapi/**'
      - 'src/api/**'

jobs:
  contract-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - run: npm ci
      - run: npm run build

      - name: Validate Contract & Edge Cases
        run: node dist/cli.js --spec openapi/spec.yaml --target http://localhost:4000 --mock
```

---

## 📄 License

MIT