import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  type Card as FsrsCard,
  type Grade,
  State as FsrsState,
} from 'ts-fsrs';
import { CardState, Rating, type SchedulingState } from './types';

export interface SchedulerOptions {
  /** Target probability of recalling a card when it is due (0.7–0.97). */
  retention?: number;
  /** Randomise intervals slightly so cards learned together drift apart. */
  fuzz?: boolean;
  maximumIntervalDays?: number;
}

const toFsrs = (s: SchedulingState): FsrsCard => ({
  due: new Date(s.due),
  stability: s.stability,
  difficulty: s.difficulty,
  elapsed_days: s.elapsedDays,
  scheduled_days: s.scheduledDays,
  learning_steps: s.learningSteps,
  reps: s.reps,
  lapses: s.lapses,
  state: s.state as unknown as FsrsState,
  last_review: s.lastReview === undefined ? undefined : new Date(s.lastReview),
});

const fromFsrs = (c: FsrsCard): SchedulingState => {
  const out: SchedulingState = {
    due: c.due.getTime(),
    stability: c.stability,
    difficulty: c.difficulty,
    elapsedDays: c.elapsed_days,
    scheduledDays: c.scheduled_days,
    learningSteps: c.learning_steps,
    reps: c.reps,
    lapses: c.lapses,
    state: c.state as unknown as CardState,
  };
  if (c.last_review) out.lastReview = c.last_review.getTime();
  return out;
};

export function newSchedulingState(now: number): SchedulingState {
  return fromFsrs(createEmptyCard(new Date(now)));
}

export type Preview = Record<Rating, SchedulingState>;

export interface Scheduler {
  /** Applies a rating and returns the new memory state. Pure – input is not mutated. */
  review(state: SchedulingState, rating: Rating, now: number): SchedulingState;
  /** The resulting state for each of the four ratings (for the button labels). */
  preview(state: SchedulingState, now: number): Preview;
  /** Probability (0–1) of recalling the card at `now`. */
  retrievability(state: SchedulingState, now: number): number;
}

export function createScheduler(opts: SchedulerOptions = {}): Scheduler {
  const f = fsrs(
    generatorParameters({
      request_retention: opts.retention ?? 0.9,
      enable_fuzz: opts.fuzz ?? true,
      maximum_interval: opts.maximumIntervalDays ?? 365 * 3,
      enable_short_term: true,
      learning_steps: ['1m', '10m'],
      relearning_steps: ['10m'],
    }),
  );
  const ratings = [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy] as const;

  return {
    review(state, rating, now) {
      return fromFsrs(f.next(toFsrs(state), new Date(now), rating as unknown as Grade).card);
    },
    preview(state, now) {
      const result = {} as Preview;
      for (const r of ratings) result[r] = this.review(state, r, now);
      return result;
    },
    retrievability(state, now) {
      if (state.state === CardState.New) return 0;
      return f.get_retrievability(toFsrs(state), new Date(now), false);
    },
  };
}

/** Human-readable interval for the rating buttons: "1 Min", "10 Min", "3 T", "2 Mon". */
export function formatInterval(ms: number): string {
  const min = Math.max(1, Math.round(ms / 60_000));
  if (min < 60) return `${min} Min`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} Std`;
  const d = Math.round(h / 24);
  if (d < 31) return `${d} T`;
  const mon = Math.round(d / 30.4);
  if (mon < 12) return `${mon} Mon`;
  return `${(d / 365).toFixed(1).replace('.', ',').replace(',0', '')} J`;
}
