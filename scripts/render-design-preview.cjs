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
const mocks = {
  'next/link': ({ children, ...props }) => React.createElement('a', props, children),
  'next/navigation': { usePathname: () => '/' },
  swr: () => ({ data: undefined }),
  '@/components/user-provider': { useUser: () => ({ me: { balance: 200 }, isLoading: false }) },
  '@/components/language-provider': { useLanguage: () => ({ t: key => ({ games: 'Games', battles: 'PvP', crash: 'Crash', upgrade: 'Upgrade', profile: 'Profile' })[key] }) },
  '@/lib/telegram-webapp': { haptic() {} },
  '@/lib/client-game-api': { fetchLiveDrops() {} },
}
function load(file) {
  if (cache.has(file)) return cache.get(file)
  const exports = {}
  const context = { exports, module: { exports }, React, console,
    require(name) {
      if (name in mocks) return mocks[name]
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
  const body = renderToStaticMarkup(React.createElement(React.Fragment, null,
    React.createElement('div', { className: 'app-shell min-h-screen pb-24' }, React.createElement(AppHeader), React.createElement('main', { className: 'pt-3' }, React.createElement(HomeLobby, { online: 0 }))),
    React.createElement(BottomNav)))
  const css = await require('postcss')([require('@tailwindcss/postcss')()]).process(fs.readFileSync(path.join(root, 'app/globals.css'), 'utf8'), { from: path.join(root, 'app/globals.css') })
  fs.writeFileSync(path.join(root, 'public/__design-preview.css'), css.css)
  fs.writeFileSync(path.join(root, 'public/__design-preview.html'), `<!doctype html><html lang="en" class="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>PugGift design fixture</title><link rel="stylesheet" href="/__design-preview.css"></head><body class="font-sans antialiased">${body}</body></html>`)
  console.log('Static design fixture generated; remove public/__design-preview.{html,css} before deployment.')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
