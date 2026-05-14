# API to Test Case Design Document Generator

Converts API definitions into exhaustive test case design documents. Every endpoint must be
covered completely — generate ALL derivable test cases, not a representative sample.
Leave nothing out: every field, every constraint, every status code, every auth scenario,
every integration flow, and every edge case must appear as a distinct test case row.

---

## Supported Input Formats

| Format | How to Provide |
|---|---|
| Swagger / OpenAPI Link | Paste the URL (e.g., `https://petstore.swagger.io/v2/swagger.json`) |
| Swagger / OpenAPI JSON | Paste the raw JSON or YAML content directly |
| Postman Collection | Paste the exported JSON (v2.0 / v2.1) |

If the user provides a **Swagger link**, fetch the spec from the URL before proceeding.
If the input format is ambiguous, ask the user to clarify.

---

## Workflow

### Step 1 — Detect and Parse the Input

**Swagger Link:**
- Fetch the spec from the URL.
- Detect version: `openapi: 3.x.x` (OpenAPI 3) or `swagger: "2.0"` (Swagger 2).
- Follow the OpenAPI Parsing Guide (included below).

**Swagger / OpenAPI JSON:**
- Accept pasted JSON or YAML.
- Detect version and parse accordingly.

**Postman Collection:**
- Confirm via `info.schema` containing `schema.getpostman.com`.
- Extract from each `item`: method, URL path, headers, body (raw/form-data/urlencoded), example responses.
- Map Postman folders → API modules/groups.
- Treat each `item.request` as one endpoint.

For every endpoint extract:
- **Method + Path** — e.g., `POST /api/v1/users`
- **Path params** — name, type, required
- **Query params** — name, type, required, default, allowed values
- **Headers** — required custom headers beyond auth
- **Request body** — every field: name, type, required/optional, constraints (minLength, maxLength, minimum, maximum, enum, format, pattern, nullable, default)
- **Response codes** — every documented status code and its full response schema:
  - **Swagger 2.0**: `paths[path][method].responses[statusCode].schema` (resolve `$ref` chains)
  - **OpenAPI 3.x**: `paths[path][method].responses[statusCode].content["application/json"].schema`
  - **Postman**: `item.response[*].body` (parse as JSON if available)
  - For each status code, build a concrete example JSON object by walking the schema and substituting `example` / `default` values, or realistic placeholder values when neither is present
  - Store this as the **expected response JSON** for that status code; use it in the "Response Json" column
- **Auth scheme** — Bearer, API Key, Basic, OAuth2, or none
- **Examples** — use provided example values as baseline test data

If critical information is missing (auth method, base URL, error schema), ask the user before generating.

---

### Step 2 — Generate ALL Test Cases Per Endpoint

For every endpoint, generate test cases systematically across every category below.
**Do not skip any category. Do not summarize multiple cases into one row.**
Each scenario = one TC row.

---

#### CATEGORY 1 — Positive / Happy Path

| Scenario | Test Case |
|---|---|
| All required fields only (minimal valid) | Valid values for every required field, omit all optional |
| All required + all optional fields | Valid values for every field in the schema |
| Each optional field individually added | One TC per optional field: required fields + that one optional field |
| Use spec-provided example values | If the spec has `example` / `examples`, use them verbatim |
| Each valid enum value | One TC per enum value for any enum field |
| Both boolean states | One TC for `true`, one for `false` per boolean field |

---

#### CATEGORY 2 — Negative / Validation

**Missing required fields:**
- One TC per required field: send body with that field omitted → expect 400/422

**Wrong data types:**
- One TC per field: send a string where an integer is expected, integer where a string is expected, array where an object is expected, etc. → expect 400/422

**Invalid formats:**
- `format: email` → send "notanemail", "missing@", "@nodomain" → one TC each
- `format: uuid` → send "not-a-uuid", "123", empty string → one TC each
- `format: date` → send "31-13-2024", "not-a-date", "2024/99/99" → one TC each
- `format: date-time` → send invalid ISO 8601 strings → one TC each
- `format: uri` → send plain text without scheme → one TC
- Custom `pattern` (regex) → send a value that violates the pattern → one TC

**Invalid enum values:**
- One TC per enum field: send a value not in the allowed list → expect 400/422
- Send empty string for an enum field → one TC

**Malformed body:**
- Send completely empty body `{}` → one TC
- Send body with syntax error (broken JSON) → one TC → expect 400
- Send no body at all for endpoints that require a body → one TC
- Send an array `[]` as root instead of an object → one TC

---

#### CATEGORY 3 — Boundary / Limit

| Constraint | Test Cases to Generate |
|---|---|
| `minLength: N` | Length N-1 (fail), Length N (pass), Length N+1 (pass) |
| `maxLength: N` | Length N-1 (pass), Length N (pass), Length N+1 (fail) |
| `minimum: N` | Value N-1 (fail), Value N (pass), Value N+1 (pass) |
| `maximum: N` | Value N-1 (pass), Value N (pass), Value N+1 (fail) |
| `minItems: N` (array) | N-1 items (fail), N items (pass), N+1 items (pass) |
| `maxItems: N` (array) | N-1 items (pass), N items (pass), N+1 items (fail) |
| Integer field | 0 (zero), -1 (negative), very large number (e.g. 2147483647) |
| String field | Empty string `""`, single character, whitespace-only `"   "` |

---

#### CATEGORY 4 — Edge Cases

**String field edge cases:**
- String with leading/trailing whitespace
- String with special characters: `!@#$%^&*()_+-=[]{}|;':",.<>?/\``
- String with Unicode characters: accented letters (é, ü), CJK characters (中文), emoji (😀)
- String with SQL injection attempt: `'; DROP TABLE users; --`
- String with HTML/script injection: `<script>alert(1)</script>`
- Maximum possible length string (if no maxLength defined, test 10,000 chars)

**Request-level edge cases:**
- Very large payload (e.g., 10 MB body)
- Wrong Content-Type: send `text/plain` for a JSON endpoint → expect 415
- Wrong HTTP method on valid path → expect 405

---

#### CATEGORY 5 — Authorization & Authentication

| Scenario | Expected Result |
|---|---|
| No Authorization header | 401 Unauthorized |
| Malformed token: `Authorization: Bearer` (no value) | 401 Unauthorized |
| Invalid token value: random string | 401 Unauthorized |
| Expired token | 401 Unauthorized |
| Valid token with insufficient scope/role | 403 Forbidden |
| Valid token with correct permissions | Expected 2xx response |

---

#### CATEGORY 6 — Integration / End-to-End Flows

**CRUD Flow** (generate for every resource with Create + Read + Update + Delete endpoints):

| TC | Flow Step |
|---|---|
| TC-XXX | Create resource — POST with valid payload → capture returned `id` |
| TC-XXX | Read created resource — GET /{id} → verify fields match payload |
| TC-XXX | Update resource — PUT/PATCH /{id} → verify 200 |
| TC-XXX | Read after update — GET /{id} → verify updated values |
| TC-XXX | Delete resource — DELETE /{id} → verify 200/204 |
| TC-XXX | Read after delete — GET /{id} → verify 404 |

---

### Step 3 — Generate the Test Case Design Document

#### Document Header

```
Project     : <API title from spec>
Version     : <API version>
Base URL    : <servers[0].url or host+basePath>
Prepared By : QA Team
Date        : <today's date>
Total TCs   : <count>
```

#### Endpoint Summary Table

| # | Method | Endpoint | Description | Auth Required | TC Count |
|---|---|---|---|---|---|

#### Test Cases per Endpoint

For each endpoint produce a complete table:

| TC ID | Title | Precondition | Test Steps | Test Data | Expected Result | Category | Response Json |
|---|---|---|---|---|---|---|---|

**Response Json rules:**
- 2xx rows: concrete JSON from the success response schema
- 4xx/5xx rows: error response JSON, or `N/A` if spec defines no error body
- Always resolve `$ref` references before building the example object

---

### Step 4 — Output Structure

1. Document Header
2. Endpoint Summary Table
3. Integration Flow Summary Table
4. Test Case Tables (one per endpoint)
5. Integration Flow Test Cases
6. Test Data Appendix
7. Coverage Matrix
8. Open Questions

---

## Coverage Matrix Format

| Endpoint | Positive | Negative | Boundary | Edge Case | Auth | Integration | Total |
|---|---|---|---|---|---|---|---|

---

## Quality Checklist

- [ ] Every documented status code has at least one test case
- [ ] Every required field has an individual "missing field" test case
- [ ] Every enum field has one TC per valid value and one TC for an invalid value
- [ ] Every string field with minLength/maxLength has boundary TCs at N-1, N, N+1
- [ ] Every auth-protected endpoint has: no-token (401), invalid-token (401), expired-token (401), wrong-role (403), valid-token (2xx)
- [ ] Every resource with CRUD endpoints has a full CRUD integration flow
- [ ] TC IDs are sequential and unique across the whole document
- [ ] Every TC row has a populated "Response Json" column
