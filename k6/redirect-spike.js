import http from 'k6/http'
import { check, sleep } from 'k6'
import { Counter } from 'k6/metrics'

const errors = new Counter('redirect_errors')

const BASE_URL = __ENV.BASE_URL ?? 'http://localhost:3000'
const SLUG_COUNT = 20

export const options = {
  scenarios: {
    redirect_spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 100 },
        { duration: '1m', target: 200 },
        { duration: '2m', target: 200 },
        { duration: '30s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p95<5000'],
    http_req_failed: ['rate<0.01'],
    redirect_errors: ['count<10'],
  },
}

let slugs = []

export function setup() {
  const tokenRes = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email: 'admin@lynx.dev', password: __ENV.ADMIN_PASSWORD ?? 'admin123' }),
    { headers: { 'Content-Type': 'application/json' } },
  )

  const token = tokenRes.json('accessToken')

  for (let i = 0; i < SLUG_COUNT; i++) {
    const res = http.post(
      `${BASE_URL}/links`,
      JSON.stringify({ originalUrl: `https://example.com/spike-test-${i}` }),
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'Idempotency-Key': `spike-setup-${i}-${Date.now()}`,
        },
      },
    )

    if (res.status === 201) {
      const body = res.json()
      slugs.push(body.slug)
    }
  }

  for (const slug of slugs) {
    http.get(`${BASE_URL}/${slug}`)
  }

  return { slugs }
}

export default function (data) {
  const slug = data.slugs[Math.floor(Math.random() * data.slugs.length)]
  const res = http.get(`${BASE_URL}/${slug}`, { tags: { phase: 'redirect' } })

  check(res, {
    'redirect status is 308': (r) => r.status === 308,
    'location header present': (r) => r.headers['Location'] !== undefined,
  }) || errors.add(1)

  sleep(0.05)
}
