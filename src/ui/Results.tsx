// End-of-run summary: stars, accuracy, what to work on.
import { ReactNode } from 'react';
import type { PlayResult } from './Player';
import { Stars } from './bits';

export function Results({ r, children, title }: { r: PlayResult; children?: ReactNode; title?: string }) {
  const s = r.summary;
  const pct = Math.round(r.accuracy * 100);
  const headline = r.stars >= 3 ? 'Outstanding!' : r.stars === 2 ? 'Great playing!' : r.stars === 1 ? 'Nice work!' : 'Keep at it!';
  let tip = '';
  if (r.mode === 'tempo' && s.timing !== null && s.timing > 0.07) tip = 'Your timing drifted a little — try a slower tempo and lock in with the bass.';
  else if (s.misses > s.wrong && s.misses > 0) tip = 'You skipped some notes. Keep your right hand rolling even if one goes wrong.';
  else if (s.wrong > 0 || s.wrongTries > 0) tip = 'A few wrong notes — watch the fretboard: it shows where your fingers go.';
  if (r.stars === 0) tip ||= 'You need 60% to pass. Try it in Learn mode first — the music waits for you.';
  return (
    <div className="results card">
      <h2 className="display">{title ?? headline}</h2>
      <Stars n={r.stars} big />
      <div className="big">{pct}%</div>
      <div className="statgrid small">
        <div><b>{s.hits}</b>right</div>
        <div><b>{r.mode === 'wait' ? s.wrongTries : s.wrong + s.partials}</b>{r.mode === 'wait' ? 'wrong tries' : 'wrong'}</div>
        <div><b>{s.misses}</b>missed</div>
      </div>
      {r.mode === 'wait' && <p className="small muted">Learn mode counts first tries. Play it in time (with the band) for up to 3 stars.</p>}
      {tip && <p className="small">{tip}</p>}
      <div className="row" style={{ justifyContent: 'center' }}>{children}</div>
    </div>
  );
}
