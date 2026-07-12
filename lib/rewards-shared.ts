// Reward for each day of the 7-day streak cycle (GRAM).
// Small on purpose — a light daily nudge, not a payout.
export const DAILY_REWARDS = [0.1, 0.15, 0.25, 0.4, 0.6, 1, 2]

export type RewardState = {
  canClaim: boolean
  streak: number
  nextIndex: number
  rewards: number[]
  level: number
  xp: number
  levelPct: number
  toNext: number
}
