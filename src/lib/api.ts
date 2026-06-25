import type { WorldState } from './types';

async function jsonRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) }
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  state: () => jsonRequest<WorldState>('/api/state'),
  control: (action: 'run' | 'pause' | 'step' | 'reset' | 'speed', speed?: number) =>
    jsonRequest<{ ok: boolean; state: WorldState }>('/api/control', {
      method: 'POST',
      body: JSON.stringify({ action, speed })
    }),
  scenario: (id: string) =>
    jsonRequest<{ ok: boolean; state: WorldState }>('/api/scenario', {
      method: 'POST',
      body: JSON.stringify({ id })
    }),
  prompt: (text: string) =>
    jsonRequest<{ ok: boolean; state: WorldState }>('/api/prompt', {
      method: 'POST',
      body: JSON.stringify({ text })
    })
};
