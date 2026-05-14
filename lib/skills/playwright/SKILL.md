# Playwright API Testing — TypeScript Automation

Expert guidance for converting Swagger/OpenAPI test case design documents into Playwright TypeScript API test scripts using `@playwright/test`'s built-in `APIRequestContext`.

For full API reference, see `references/API_REFERENCE.md`.

---

## CRITICAL WORKFLOW — Follow These Steps

When the user provides a test case design document:

1. **Read the test case design document** — understand all endpoints, HTTP methods, request payloads, expected responses, and test scenarios listed.
2. **Group test cases by endpoint** — organize into `test.describe` blocks per resource/controller.
3. **Identify auth requirements** — Bearer tokens, API keys, Basic Auth, or cookies.
4. **Write test files to the project `tests/api/` folder** — one file per controller/resource group.
5. **Generate a `playwright.config.ts`** if one does not already exist — configured for API-only testing (no browser).
6. **Execute tests** using:
   ```bash
   npx playwright test tests/api/ --reporter=html
   ```

---

## Project Structure

```
project-root/
├── playwright.config.ts
├── tests/
│   └── api/
│       ├── auth.spec.ts
│       ├── users.spec.ts
│       └── ...
├── test-data/
│   └── fixtures.ts
└── utils/
    └── api-helpers.ts
```

---

## playwright.config.ts (API-Only)

```typescript
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/api',
  fullyParallel: true,
  retries: 1,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: process.env.BASE_URL ?? 'https://api.example.com',
    extraHTTPHeaders: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
  },
})
```

---

## Converting a Test Case Design Document

### Step 1 — Read the document

Identify for each test case:
- **Endpoint** (e.g., `POST /api/v1/users`)
- **Description** (what the test validates)
- **Preconditions** (auth token, existing data)
- **Request payload / query params / path params**
- **Expected HTTP status code**
- **Expected response body fields**
- **Scenario type** (positive, negative, boundary, edge case)

### Step 2 — Map to Playwright test structure

| Design Doc element | Playwright construct |
|---|---|
| Resource group / controller | `test.describe('Resource Name')` |
| Individual test case | `test('scenario description')` |
| Precondition / auth setup | `test.beforeAll` or `test.beforeEach` |
| Request | `request.get/post/put/patch/delete` |
| Expected status code | `expect(response.status()).toBe(200)` |
| Expected body field | `expect(body.field).toBe(value)` |
| Reusable data | `fixtures.ts` constants |

---

## Core API Test Patterns

### GET — Retrieve Resource

```typescript
import { test, expect } from '@playwright/test'

test.describe('GET /api/v1/users', () => {
  test('returns list of users with status 200', async ({ request }) => {
    const response = await request.get('/api/v1/users')
    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(Array.isArray(body)).toBeTruthy()
  })

  test('returns 404 for non-existent user', async ({ request }) => {
    const response = await request.get('/api/v1/users/999999')
    expect(response.status()).toBe(404)
  })
})
```

### POST — Create Resource

```typescript
test.describe('POST /api/v1/users', () => {
  test('creates user successfully with status 201', async ({ request }) => {
    const payload = {
      name: 'Test User',
      email: `testuser_${Date.now()}@example.com`,
      password: 'SecurePass@123',
    }
    const response = await request.post('/api/v1/users', { data: payload })
    expect(response.status()).toBe(201)
    const body = await response.json()
    expect(body).toHaveProperty('id')
    expect(body.email).toBe(payload.email)
  })

  test('returns 400 when required field is missing', async ({ request }) => {
    const response = await request.post('/api/v1/users', {
      data: { name: 'No Email User' },
    })
    expect(response.status()).toBe(400)
  })
})
```

### PUT / PATCH / DELETE

```typescript
test.describe('PUT /api/v1/users/:id', () => {
  test('updates user with status 200', async ({ request }) => {
    const response = await request.put('/api/v1/users/1', {
      data: { name: 'Updated Name', email: 'updated@example.com' },
    })
    expect(response.status()).toBe(200)
  })
})

test.describe('DELETE /api/v1/users/:id', () => {
  test('deletes user with status 200 or 204', async ({ request }) => {
    const response = await request.delete('/api/v1/users/1')
    expect([200, 204]).toContain(response.status())
  })
})
```

---

## Authentication Patterns

### Bearer Token — Login Once, Reuse

```typescript
let authToken: string

test.describe('Authenticated Endpoints', () => {
  test.beforeAll(async ({ request }) => {
    const response = await request.post('/api/v1/auth/login', {
      data: { email: 'admin@example.com', password: 'Admin@123' },
    })
    expect(response.status()).toBe(200)
    authToken = (await response.json()).token
  })

  test('returns 401 with invalid token', async ({ request }) => {
    const response = await request.get('/api/v1/profile', {
      headers: { Authorization: 'Bearer invalid_token_xyz' },
    })
    expect(response.status()).toBe(401)
  })
})
```

### Global Auth via `playwright.config.ts`

```typescript
use: {
  baseURL: 'https://api.example.com',
  extraHTTPHeaders: {
    Authorization: `Bearer ${process.env.AUTH_TOKEN}`,
    'Content-Type': 'application/json',
  },
},
```

---

## Negative & Boundary Test Patterns

```typescript
const invalidPayloads = [
  { case: 'missing email',   data: { name: 'User', password: 'Pass@1' } },
  { case: 'invalid email',  data: { name: 'User', email: 'not-an-email', password: 'Pass@1' } },
  { case: 'short password', data: { name: 'User', email: 'u@e.com', password: '123' } },
]

for (const { case: label, data } of invalidPayloads) {
  test(`returns 400 — ${label}`, async ({ request }) => {
    const response = await request.post('/api/v1/users', { data })
    expect(response.status()).toBe(400)
  })
}
```

---

## Response Schema Validation

```typescript
test('user response matches expected schema', async ({ request }) => {
  const response = await request.get('/api/v1/users/1')
  expect(response.status()).toBe(200)
  const body = await response.json()
  expect(body).toHaveProperty('id')
  expect(body).toHaveProperty('name')
  expect(body).toHaveProperty('email')
  expect(typeof body.id).toBe('number')
  expect(body.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
})
```

---

## Reusable API Helpers

```typescript
// utils/api-helpers.ts
import { APIRequestContext, expect } from '@playwright/test'

export async function getAuthToken(request: APIRequestContext, email: string, password: string): Promise<string> {
  const response = await request.post('/api/v1/auth/login', { data: { email, password } })
  expect(response.status()).toBe(200)
  return (await response.json()).token
}

export async function createUser(request: APIRequestContext, overrides = {}) {
  const payload = {
    name: 'Auto User',
    email: `auto_${Date.now()}@example.com`,
    password: 'Pass@123',
    ...overrides,
  }
  const response = await request.post('/api/v1/users', { data: payload })
  expect(response.status()).toBe(201)
  return response.json()
}
```

---

## Running Tests

```bash
npx playwright test tests/api/
npx playwright test tests/api/ --reporter=html && npx playwright show-report
BASE_URL=https://staging.api.com AUTH_TOKEN=xyz npx playwright test tests/api/
npx playwright test tests/api/ --grep "401"
```

---

## Best Practices

- One `test.describe` per endpoint group — mirrors the Swagger controller/tag structure
- One spec file per resource — keeps files small and focused
- Use `Date.now()` for unique test data — avoids conflicts between parallel runs
- Always assert status code first — fail fast before parsing the body
- Use `process.env` for credentials and base URLs — never hardcode secrets
- Run auth once in `beforeAll` — do not repeat login in every test
- Clean up created data — use `afterAll` or `afterEach` to delete resources created during tests
- Assert both status and body — status alone does not confirm correct behavior
