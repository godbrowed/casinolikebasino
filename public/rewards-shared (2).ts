// Simple XP curve: each level needs progressively more XP.
// xp required to *reach* level L (L starts at 1) = 50 * (L-1)^2
export function levelFromXp(xp: number): number {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 50)) + 1
}

export function xpForLevel(level: number): number {
  return 50 * Math.pow(Math.max(1, level) - 1, 2)
}

export function levelProgress(xp: number) {
  const level = levelFromXp(xp)
  const curBase = xpForLevel(level)
  const nextBase = xpForLevel(level + 1)
  const span = nextBase - curBase || 1
  const into = xp - curBase
  return {
    level,
    into,
    span,
    pct: Math.max(0, Math.min(100, (into / span) * 100)),
    toNext: Math.max(0, nextBase - xp),
  }
}
