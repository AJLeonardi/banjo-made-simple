import { AWARDS } from '../../content/awards';
import { useStore } from '../../state/store';
import { Medal } from '../bits';

export function Awards() {
  const { progress } = useStore();
  const earned = AWARDS.filter((a) => progress.awards[a.id]).length;
  return (
    <div className="page">
      <header className="topbar">
        <h1 className="display grow">Awards</h1>
        <span className="pill">{earned}/{AWARDS.length}</span>
      </header>
      <div className="award-grid">
        {AWARDS.map((a) => {
          const at = progress.awards[a.id];
          return (
            <div key={a.id} className={`card award${at ? '' : ' locked'}`}>
              <Medal award={a} locked={!at} />
              <div className="title">{a.title}</div>
              <div className="small muted">{a.description}</div>
              {at && <div className="tiny muted">{new Date(at).toLocaleDateString()}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
