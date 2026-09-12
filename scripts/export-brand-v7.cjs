// Encode the selected original sources; preserve alpha in the in-app sprites.
const path = require('node:path')
const sharp = require(require.resolve('sharp', { paths: [require.resolve('next')] }))
const assets = path.resolve(__dirname, '../public/images')
Promise.all([
  sharp(path.join(assets, 'puggift-avatar-v7-source.png')).resize(800, 800).flatten({ background: '#2b6eff' }).png().toFile(path.join(assets, 'puggift-bot-avatar-v7.png')),
  sharp(path.join(assets, 'puggift-avatar-v7-source.png')).resize(256, 256).webp({ quality: 90 }).toFile(path.join(assets, 'puggift-mark-v7.webp')),
  sharp(path.join(assets, 'puggift-start-banner-v7-source.png')).resize(1280, 720, { fit: 'contain', background: '#202225' }).jpeg({ quality: 90 }).toFile(path.join(assets, 'puggift-start-banner-v7.jpg')),
  sharp(path.join(assets, 'puggift-rocket-v7-source.png')).resize(512, 512).webp({ quality: 90 }).toFile(path.join(assets, 'puggift-rocket-v7.webp')),
]).then(() => console.log('Brand v7 assets exported.')).catch(error => { console.error(error.message); process.exitCode = 1 })
