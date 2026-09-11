// Static visual fixture of the real lobby/header/navigation components. No
// application session, API requests, deposits or game actions are available.
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const root = path.resolve(__dirname, '..')
const cache = new Map()
const screen = process.argv[2] || 'home'
const route = screen === 'home' ? '/' : screen === 'case' || screen === 'free-case' ? '/case/preview' : '/' + screen
const mocks = {
  'next/link': ({ children, ...props }) => React.createElement('a', props, children),
  'next/navigation': { usePathname: () => route, useRouter: () => ({ refresh() {} }) },
  swr: key => ({ data: key === 'free-case-requirements' && screen === 'free-case' ? { shares: 0, requiredShares: 1, subscribed: false, tradeVisited: false, ready: false, channelCheckAvailable: true } : undefined }),
  '@/components/user-provider': { useUser: () => ({ me: { balance: 200 }, isLoading: false, refresh() {}, setBalance() {} }) },
  '@tonconnect/ui-react': { useTonWallet: () => null, useTonConnectUI: () => [{}] },
  '@/components/language-provider': { useLanguage: () => ({ t: key => ({ games: 'Games', battles: 'PvP', crash: 'Crash', upgrade: 'Upgrade', profile: 'Profile' })[key] }) },
  '@/lib/telegram-webapp': { haptic() {}, hapticNotify() {} },
  '@/lib/client-game-api': { fetchLiveDrops() {} },
}
function load(file) {
  if (cache.has(file)) return cache.get(file)
  const exports = {}
  const context = { exports, module: { exports }, React, console, process: { env: {} },
    require(name) {
      if (name in mocks) return mocks[name]
      if (name.startsWith('@/app/actions/')) return new Proxy({}, { get() { return () => { throw new Error('Actions are disabled in the static design fixture') } } })
      if (name.startsWith('@/')) {
        const base = name.slice(2)
        return load(fs.existsSync(path.join(root, base + '.tsx')) ? base + '.tsx' : base + '.ts')
      }
      return require(name)
    },
  }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, context, { filename: file })
  cache.set(file, context.module.exports)
  return context.module.exports
}
async function main() {
  const { HomeLobby } = load('components/home-lobby.tsx')
  const { AppHeader } = load('components/app-header.tsx')
  const { BottomNav } = load('components/bottom-nav.tsx')
  const fixtureGifts = [
    { id: 1, name: 'Bunny Muffin', imageUrl: '/images/menu/bunny-muffin.png', rarity: 'rare', value: 480, source: 'case', locked: false, sending: false },
    { id: 2, name: 'Heart Locket', imageUrl: '/images/menu/heart-locket.png', rarity: 'legendary', value: 920, source: 'case', locked: false, sending: false },
    { id: 3, name: 'Plush Pepe', imageUrl: '/images/menu/plush-pepe.png', rarity: 'mythic', value: 1200, source: 'case', locked: false, sending: false },
  ]
  let content = React.createElement(HomeLobby, { online: 0, paidCaseCount: 18, freeCaseSlug: 'free' })
  if (screen === 'profile') content = React.createElement('main', { className: 'mx-auto w-full max-w-[584px] px-3 pt-5' }, React.createElement(load('components/profile-view.tsx').ProfileView, {
    me: { firstName: 'Design preview', username: 'preview', balance: 200, xp: 0, photoUrl: null }, inventory: fixtureGifts, history: [], freeCaseClaim: null,
    referral: { invited: 0, earned: 0, ratePercent: 10, inviteUrl: '' },
  }))
  if (screen === 'deposit') content = React.createElement('main', { className: 'mx-auto w-full max-w-[584px] px-3 pt-5' }, React.createElement(load('components/deposit-view.tsx').DepositView, { tonRate: 100, giftCatalog: [], relayer: { username: 'pugsrelayer', url: 'https://t.me/pugsrelayer' } }))
  if (screen === 'upgrade') content = React.createElement(load('components/upgrade-game.tsx').UpgradeGame, { inventory: fixtureGifts.slice(0, 1), targets: fixtureGifts.slice(1) })
  if (screen === 'case' || screen === 'free-case') content = React.createElement(load('components/case-view.tsx').CaseView, { c: { id: 1, slug: 'preview', name: 'Pug Pocket', isFree: screen === 'free-case', price: 199, nextFreeAt: null, items: fixtureGifts.map((gift, i) => ({ ...gift, slug: 'gift-' + i, rewardType: 'gift' })) } })
  if (screen === 'cases') {
    const Card = load('components/case-card.tsx').CaseCard
    content = React.createElement('main', { className: 'mx-auto w-full max-w-[800px] px-3 pt-5' }, React.createElement('h1', { className: 'mb-6 text-center text-[28px] font-bold' }, 'Cases'), React.createElement('div', { className: 'grid grid-cols-2 gap-3 md:grid-cols-3' }, ...['Free case', 'Pug Pocket', 'Pug Club', 'Collectibles'].map((name, i) => React.createElement(Card, { key: name, c: { id: i, slug: 'preview', name, isFree: i === 0, price: [0,199,250,500][i], items: fixtureGifts } }))))
  }
  const body = renderToStaticMarkup(React.createElement(React.Fragment, null,
    React.createElement('div', { className: 'app-shell min-h-screen ' + (screen === 'deposit' || screen === 'case' || screen === 'free-case' ? '' : 'pb-24') }, screen === 'case' || screen === 'free-case' ? content : React.createElement(React.Fragment, null, React.createElement(AppHeader), React.createElement('div', { className: 'pt-3' }, content))),
    React.createElement(BottomNav)))
  const css = await require('postcss')([require('@tailwindcss/postcss')()]).process(fs.readFileSync(path.join(root, 'app/globals.css'), 'utf8'), { from: path.join(root, 'app/globals.css') })
  fs.writeFileSync(path.join(root, 'public/__design-preview.css'), css.css)
  fs.writeFileSync(path.join(root, 'public/__design-preview.html'), `<!doctype html><html lang="en" class="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>PugGift design fixture</title><link rel="stylesheet" href="/__design-preview.css"></head><body class="font-sans antialiased">${body}</body></html>`)
  console.log('Static design fixture generated; remove public/__design-preview.{html,css} before deployment.')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
