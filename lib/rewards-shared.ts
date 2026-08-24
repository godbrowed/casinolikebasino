// Reward for each day of the 7-day streak cycle (Stars).
// Small on purpose — a light daily nudge, not a payout.
export const DAILY_REWARDS = [1, 2, 3, 5, 8, 12, 20]

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
