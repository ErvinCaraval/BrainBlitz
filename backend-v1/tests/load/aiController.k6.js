import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '1m', target: 5 },
    { duration: '30s', target: 50 },
    { duration: '2m', target: 20 },
    { duration: '30s', target: 100 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000', 'p(99)<2000'],
    http_req_failed: ['rate<0.01'],
    http_reqs: ['count>10']
  }
};

export default function () {
  const url = 'http://localhost:3000/api/ai/generate-questions';
  const payload = JSON.stringify({ topic: 'math', difficulty: 'medium', count: 5, useAI: true });
  const params = { headers: { 'Content-Type': 'application/json' } };
  let res = http.post(url, payload, params);
  check(res, {
    'status is 200': (r) => r.status === 200,
    'has questions': (r) => JSON.parse(r.body).questions !== undefined,
  });
  sleep(1);
}
