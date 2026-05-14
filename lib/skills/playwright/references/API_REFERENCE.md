# Playwright APIRequestContext — Full API Reference

Complete reference for Playwright's built-in API testing capability using `APIRequestContext`.

---

## All HTTP Methods

### `request.get(url, options?)`

```typescript
const response = await request.get('/api/users')
const response = await request.get('/api/users', {
  params: { status: 'active', page: '1', limit: '10' },
})
```

### `request.post(url, options?)`

```typescript
// JSON body
const response = await request.post('/api/users', {
  data: { name: 'Alice', email: 'alice@example.com' },
})

// Form-urlencoded body
const response = await request.post('/api/login', {
  form: { username: 'alice', password: 'pass123' },
})

// Multipart / file upload
const response = await request.post('/api/upload', {
  multipart: {
    file: { name: 'photo.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('...') },
    additionalMetadata: 'test upload',
  },
})
```

### `request.put(url, options?)`

```typescript
const response = await request.put('/api/users/1', {
  data: { name: 'Alice Updated', email: 'alice-new@example.com' },
})
```

### `request.patch(url, options?)`

```typescript
const response = await request.patch('/api/users/1', {
  data: { name: 'Patched Name' },
})
```

### `request.delete(url, options?)`

```typescript
const response = await request.delete('/api/users/1')
```

### `request.fetch(url, options?)` — Generic / non-standard methods

```typescript
const response = await request.fetch('/api/resource', {
  method: 'OPTIONS',
  headers: { Origin: 'https://app.example.com' },
})
```

---

## Request Options

| Option | Type | Description |
|---|---|---|
| `headers` | `Record<string, string>` | Per-request headers (merged with global headers) |
| `params` | `Record<string, string>` | URL query parameters |
| `data` | `object \| string \| Buffer` | JSON body (sets Content-Type: application/json) |
| `form` | `Record<string, string>` | Form body (sets Content-Type: application/x-www-form-urlencoded) |
| `multipart` | `Record<string, ...>` | Multipart body (sets Content-Type: multipart/form-data) |
| `timeout` | `number` | Request timeout in ms (overrides global) |
| `failOnStatusCode` | `boolean` | Throw on non-2xx status (default: false) |
| `ignoreHTTPSErrors` | `boolean` | Skip TLS certificate validation |
| `maxRedirects` | `number` | Max number of redirects to follow (default: 20) |

---

## Response Object

```typescript
const status = response.status()           // number: 200, 404, etc.
const statusText = response.statusText()   // string: 'OK', 'Not Found', etc.
const ok = response.ok()                   // boolean: true for 200–299

const headers = response.headers()                         // Record<string, string>
const contentType = response.headers()['content-type']

const json = await response.json()        // parsed JSON object
const text = await response.text()        // raw string body
const buffer = await response.body()      // Buffer (binary)
```

---

## Response Assertions

```typescript
expect(response.status()).toBe(200)
expect([200, 204]).toContain(response.status())
expect(response.ok()).toBeTruthy()

const body = await response.json()
expect(body).toHaveProperty('id')
expect(body.name).toBe('Doggie')
expect(Array.isArray(body)).toBeTruthy()
expect(typeof body.id).toBe('number')
expect(body.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)

expect(response.headers()['content-type']).toContain('application/json')
```

---

## Authentication Patterns

### Bearer Token — Login Once, Reuse

```typescript
let token: string

test.beforeAll(async ({ request }) => {
  const loginResponse = await request.post('/api/auth/login', {
    data: { username: 'admin', password: 'secret' },
  })
  token = (await loginResponse.json()).token
})

test('protected endpoint', async ({ request }) => {
  const response = await request.get('/api/protected', {
    headers: { Authorization: `Bearer ${token}` },
  })
  expect(response.status()).toBe(200)
})
```

### API Key Header

```typescript
const response = await request.get('/api/inventory', {
  headers: { 'api_key': process.env.API_KEY ?? 'test-key' },
})
```

### Basic Auth

```typescript
const credentials = Buffer.from('user:password').toString('base64')
const response = await request.get('/api/secure', {
  headers: { Authorization: `Basic ${credentials}` },
})
```

---

## Creating Standalone APIRequestContext

```typescript
import { request } from '@playwright/test'

async function globalSetup() {
  const apiContext = await request.newContext({
    baseURL: 'https://api.example.com',
    extraHTTPHeaders: { Authorization: `Bearer ${process.env.TOKEN}` },
  })
  const response = await apiContext.post('/setup/data')
  await apiContext.dispose()  // always dispose when done
}
```

---

## Timeouts and Retries

```typescript
// Per-request timeout
const response = await request.get('/api/slow-endpoint', {
  timeout: 15000,  // 15 seconds
})

// failOnStatusCode — throws on non-2xx (useful for setup calls)
const response = await request.post('/api/seed', {
  data: seedPayload,
  failOnStatusCode: true,
})
```

---

## CI/CD Environment Variables

```bash
BASE_URL=https://staging.api.com npx playwright test
AUTH_TOKEN=eyJhbGciOiJIUzI1NiJ9... npx playwright test
BASE_URL=https://staging.api.com API_KEY=abc123 npx playwright test
```

```yaml
# GitHub Actions
- name: Run API Tests
  env:
    BASE_URL: ${{ secrets.STAGING_API_URL }}
    AUTH_TOKEN: ${{ secrets.API_OAUTH_TOKEN }}
  run: npx playwright test tests/api/ --reporter=html
```

---

## Quick Reference

| Task | Code |
|---|---|
| GET with Bearer token | `request.get('/path', { headers: { Authorization: \`Bearer ${token}\` } })` |
| POST JSON body | `request.post('/path', { data: { field: 'value' } })` |
| POST form data | `request.post('/path', { form: { field: 'value' } })` |
| GET with query params | `request.get('/path', { params: { key: 'value' } })` |
| Assert 200 | `expect(response.status()).toBe(200)` |
| Assert one of many | `expect([200, 204]).toContain(response.status())` |
| Assert body field | `expect((await response.json()).field).toBe('value')` |
| Read raw body on error | `console.log(await response.text())` |
