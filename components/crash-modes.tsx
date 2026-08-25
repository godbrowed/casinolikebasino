"use client"

import { CrashGame } from "@/components/crash-game"

/** Route boundary kept for compatibility. Crash now has one shared board;
 * Stars and gifts are selected inside the same wager composer. */
export function CrashModes() {
  return <CrashGame />
}
