import { useNavigate } from 'react-router-dom';
import { IconBack } from '../../app/icons';
import { PronunciationLesson } from './PronunciationLesson';

export function PronunciationScreen() {
  const navigate = useNavigate();
  return (
    <>
      <div className="page-head">
        <button className="icon-btn" onClick={() => navigate('/learn')} aria-label="Zurück">
          <IconBack />
        </button>
        <div>
          <div className="muted">Lektion 0</div>
          <h1 className="page-title">Aussprache</h1>
        </div>
      </div>
      <PronunciationLesson onFinish={() => navigate('/learn')} />
    </>
  );
}

/** Full-screen overlay version – used during a learning session so the session is not lost. */
export function PronunciationOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Aussprache">
      <div className="overlay-inner">
        <div className="page-head">
          <button className="icon-btn" onClick={onClose} aria-label="Schließen">
            <IconBack />
          </button>
          <h1 className="page-title">Aussprache</h1>
        </div>
        <PronunciationLesson onFinish={onClose} />
      </div>
    </div>
  );
}
