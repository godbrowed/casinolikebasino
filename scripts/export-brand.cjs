// Resize/encode the selected illustration sources; never redraw the assets.
const path = require('node:path')
const sharp = require(require.resolve('sharp', { paths: [require.resolve('next')] }))
const assets = path.resolve(__dirname, '../public/images')
Promise.all([
  sharp(path.join(assets, 'puggift-avatar-v5-source.png')).resize(800, 800).png().toFile(path.join(assets, 'puggift-bot-avatar-v5.png')),
  sharp(path.join(assets, 'puggift-avatar-v5-source.png')).resize(192, 192).webp({ quality: 88 }).toFile(path.join(assets, 'puggift-mark-v5.webp')),
  sharp(path.join(assets, 'puggift-start-banner-v5-source.png')).resize(1280, 720).jpeg({ quality: 90, mozjpeg: true }).toFile(path.join(assets, 'puggift-start-banner-v5.jpg')),
  sharp(path.join(assets, 'puggift-rocket-v5-source.png')).resize(512, 512).webp({ quality: 90 }).toFile(path.join(assets, 'puggift-rocket-v5.webp')),
  ...['plush-pepe', 'heart-locket'].map(name => sharp(path.join(assets, 'menu', name + '.png')).resize(192, 192).webp({ quality: 88 }).toFile(path.join(assets, 'menu', name + '.webp'))),
]).then(() => console.log('Exported PugGift avatar and start banner v5.')).catch(error => { console.error(error); process.exitCode = 1 })
