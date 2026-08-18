import http from 'k6/http'
import { check } from 'k6'
import { Counter } from 'k6/metrics'

const collisions = new Counter('slug_collisions')

const BASE_URL = __ENV.BASE_URL ?? 'http://localhost:3000'
const TOTAL_SLUGS = 500

export const options = {
  scenarios: {
    create_slugs: {
      executor: 'shared-iterations',
      vus: 50,
      iterations: TOTAL_SLUGS,
    },
  },
  thresholds: {
    http_req_duration: ['p95<200'],
    http_req_failed: ['rate<0.01'],
    slug_collisions: ['count<1'],
  },
}

let token = ''
const createdSlugs = new Set()

export function setup() {
  const res = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email: 'admin@lynx.dev', password: __ENV.ADMIN_PASSWORD ?? 'admin123' }),
    { headers: { 'Content-Type': 'application/json' } },
  )

  token = res.json('accessToken')
  return { token }
}

export default function (data) {
  const idempotencyKey = `create-${__VU}-${__ITER}-${Date.now()}`
  const url = `https://example.com/test-${idempotencyKey}`

  const res = http.post(
    `${BASE_URL}/links`,
    JSON.stringify({ originalUrl: url }),
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${data.token}`,
        'Idempotency-Key': idempotencyKey,
      },
      tags: { phase: 'create' },
    },
  )

  check(res, {
    'created status is 201': (r) => r.status === 201,
    'slug is unique': (r) => {
      if (r.status === 201) {
        const slug = r.json('slug')
        if (createdSlugs.has(slug)) {
          collisions.add(1)
          return false
        }
        createdSlugs.add(slug)
        return true
      }
      return false
    },
  })
}
