import "dotenv/config";

import { env } from "../env.js";

const headers = {
  Authorization: `Bearer ${env.DEV_AUTH_TOKEN}`
};

async function fetchJson(path: string) {
  const response = await fetch(`http://localhost:${env.PORT}/api/v1${path}`, { headers });
  const raw = await response.text();
  let payload: unknown = raw;

  try {
    payload = JSON.parse(raw);
  } catch {
    payload = raw;
  }

  return {
    status: response.status,
    payload
  };
}

const health = await fetch(`http://localhost:${env.PORT}/api/v1/health`).then((response) => response.json());
const family = await fetchJson("/families/00000000-0000-4000-8000-000000000201");
const events = await fetchJson("/families/00000000-0000-4000-8000-000000000201/events");
const chores = await fetchJson("/families/00000000-0000-4000-8000-000000000201/chores/today");
const lists = await fetchJson("/families/00000000-0000-4000-8000-000000000201/lists");

console.log(JSON.stringify({ health, family, events, chores, lists }, null, 2));
