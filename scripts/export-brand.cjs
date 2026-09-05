// Raster exports for Telegram, using Sharp bundled with Next.js.
const path = require('node:path')
const sharp = require(require.resolve('sharp', { paths: [require.resolve('next')] }))
const assets = path.resolve(__dirname, '../public/images')
Promise.all([
  sharp(path.join(assets, 'puggift-mark-v4.svg')).resize(800, 800).png().toFile(path.join(assets, 'puggift-bot-avatar-v4.png')),
  sharp(path.join(assets, 'puggift-start-banner-v4.svg')).jpeg({ quality: 92, mozjpeg: true }).toFile(path.join(assets, 'puggift-start-banner-v4.jpg')),
]).then(() => console.log('Exported PugGift avatar and start banner v4.')).catch(error => { console.error(error); process.exitCode = 1 })
