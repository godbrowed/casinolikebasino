import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/session"
import { isAdminId } from "@/lib/admin"

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ user: null }, { status: 200 })
  return NextResponse.json({
    user: {
      id: user.id,
      username: user.username,
      firstName: user.firstName,
      photoUrl: user.photoUrl,
      balance: Number(user.balance),
      isDemo: user.isDemo,
      isAdmin: isAdminId(user.id),
    },
  })
}
