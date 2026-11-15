// Prints every narration clip as JSON lines {"id","text"} for the voice generator.
// Usage: npx vite-node scripts/voice/export.ts > narration.jsonl
import { allNarration } from '../../src/content/narration';

for (const [id, text] of allNarration()) console.log(JSON.stringify({ id, text }));
