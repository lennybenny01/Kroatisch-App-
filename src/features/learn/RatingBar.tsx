import { formatInterval, type Preview } from '../../domain/scheduler';
import { Rating } from '../../domain/types';

const BUTTONS = [
  { rating: Rating.Again, label: 'Nochmal', cls: 'again' },
  { rating: Rating.Hard, label: 'Schwer', cls: 'hard' },
  { rating: Rating.Good, label: 'Gut', cls: 'good' },
  { rating: Rating.Easy, label: 'Leicht', cls: 'easy' },
] as const;

export function RatingBar({
  preview,
  now,
  suggested,
  onRate,
}: {
  preview: Preview;
  now: number;
  suggested: Rating;
  onRate: (r: Rating) => void;
}) {
  return (
    <div className="rating-bar" role="group" aria-label="Wie gut wusstest du es?">
      {BUTTONS.map(({ rating, label, cls }) => (
        <button
          key={rating}
          type="button"
          className={`rate-btn ${cls}${rating === suggested ? ' suggested' : ''}`}
          onClick={() => onRate(rating)}
        >
          {label}
          <small>{formatInterval(preview[rating].due - now)}</small>
        </button>
      ))}
    </div>
  );
}
