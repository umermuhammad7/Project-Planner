const REWARD_MILESTONES = [5, 10, 20, 30, 50, 75, 100];

export function nextRewardTarget(stars: number) {
  const next = REWARD_MILESTONES.find((target) => target > stars);
  if (next) {
    return next;
  }

  return Math.ceil((stars + 1) / 25) * 25;
}

export function previousRewardTarget(stars: number) {
  const previous = [...REWARD_MILESTONES].reverse().find((target) => target <= stars);
  return previous ?? 0;
}

export function computeRewardProgress(stars: number) {
  const nextTarget = nextRewardTarget(stars);
  const previousTarget = previousRewardTarget(stars);
  const distance = nextTarget - stars;
  const span = Math.max(nextTarget - previousTarget, 1);
  const progress = Math.max(6, Math.min(100, ((stars - previousTarget) / span) * 100));

  return { nextTarget, distance, progress };
}
