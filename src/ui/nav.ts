// Screens and hash URLs (#/lesson/pinch), so the browser/phone back button works.

export type Route =
  | { name: 'learn' }
  | { name: 'songs' }
  | { name: 'awards' }
  | { name: 'me' }
  | { name: 'lesson'; id: string }
  | { name: 'song'; id: string }
  | { name: 'tuner' }
  | { name: 'calibrate' }
  | { name: 'workout' };

export type Nav = (r: Route, replace?: boolean) => void;

export const TABS: Route['name'][] = ['learn', 'songs', 'awards', 'me'];

export function toHash(r: Route): string {
  return 'id' in r ? `#/${r.name}/${encodeURIComponent(r.id)}` : `#/${r.name}`;
}

export function fromHash(h: string): Route {
  const [, name, id] = h.replace(/^#/, '').split('/');
  switch (name) {
    case 'lesson':
    case 'song':
      return id ? { name, id: decodeURIComponent(id) } : { name: 'learn' };
    case 'songs':
    case 'awards':
    case 'me':
    case 'tuner':
    case 'calibrate':
    case 'workout':
      return { name };
    default:
      return { name: 'learn' };
  }
}
