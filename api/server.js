import http from 'k6/http';
import { check, sleep } from 'k6';

// Define the traffic simulation profile
export const options = {
  stages: [
    { duration: '10s', target: 10 }, // Ramp up to 10 virtual users
    { duration: '30s', target: 10 }, // Hold load for 30 seconds
    { duration: '10s', target: 0 },  // Ramp down to 0 users
  ],
};

export default function () {
  // Simulate a user searching the API
  const url = 'https://video-ad-blocker-api.vercel.app/api/search?q=test';
  const response = http.get(url);

  // Assert that the server responds with HTTP 200 OK
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  // Pause between requests to simulate user reading time
  sleep(1);
}
