// Explicit cosmetic operation only: no webhook, permissions or payment changes.
// Usage: node --env-file=.env scripts/update-bot-avatar.cjs
const fs = require('node:fs')
const path = require('node:path')
async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is missing')
  const bytes = fs.readFileSync(path.join(__dirname, '../public/images/puggift-bot-avatar-v7.png'))
  const form = new FormData()
  form.set('photo', JSON.stringify({ type: 'static', photo: 'attach://avatar' }))
  form.set('avatar', new Blob([bytes], { type: 'image/png' }), 'puggift-avatar-v7.png')
  const response = await fetch(`https://api.telegram.org/bot${token}/setMyProfilePhoto`, { method: 'POST', body: form })
  const result = await response.json()
  if (!result.ok) throw new Error(`Telegram rejected avatar update (${result.error_code || response.status})`)
  console.log('Telegram confirmed the PugGift avatar update.')
}
main().catch(() => { console.error('Bot avatar update failed; check connectivity and bot configuration.'); process.exitCode = 1 })
