// Split the existing Twemoji crossed-swords vector into independently animated
// layers without redrawing it. Original artwork: CC-BY 4.0, see menu attribution.
const fs = require('node:fs')
const path = require('node:path')
const dir = path.join(__dirname, '../public/images/menu')
const original = fs.readFileSync(path.join(dir, 'swords.svg'), 'utf8')
const body = original.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')
const split = body.indexOf('<path fill="#CCD6DD" d="M12 29')
if (split < 0) throw new Error('Expected second sword not found')
for (const [name, content] of [['sword-left', body.slice(0, split)], ['sword-right', body.slice(split)]]) {
  fs.writeFileSync(path.join(dir, `${name}.svg`), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36">${content}</svg>\n`)
}
