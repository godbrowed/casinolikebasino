# PugGift character refresh

Created with the built-in image generation tool, not a commissioned human drawing.
The same reference character is used for avatar, rocket and bot banner. Original
sources are retained beside optimized images. In-app WebP sprites preserve alpha;
the Telegram profile PNG uses a cobalt background. No game probabilities changed.

## Prompt set

Avatar: Original PugGift Telegram mascot; expressive fawn pug with folded black
ears, warm cream fur, one raised eyebrow, intelligent eyes and a confident smile.
Clean flat 2D sticker illustration, dark outlines, cream/caramel/charcoal/cobalt,
simple silhouette readable at 32px. No text, coins, halo, 3D, realistic fur or headset.

Banner: Preserve the avatar character identity. Wide 16:9 welcome banner; pug on
the right peeking over a cobalt gift with cream ribbon. Text on the left exactly
“PugGift” and “Play. Collect. Repeat.” Charcoal background, cobalt oval, strong
negative space. No sci-fi grid, coins, stars, glow or extraneous text.

Rocket: Preserve the avatar character identity. Transparent isolated game sprite;
pug visibly sitting in a cobalt/cream rocket flying diagonally up-right, short
orange flame. Large recognizable head, bold outlines and flat shadows. Whole
rocket in frame. No text, moon, stars, background, realistic texture or 3D.

## Runtime assets

- `public/images/puggift-mark-v7.webp`
- `public/images/puggift-bot-avatar-v7.png`
- `public/images/puggift-start-banner-v7.jpg`
- `public/images/puggift-rocket-v7.webp`

Export: `node scripts/export-brand-v7.cjs`.
Bot avatar is updated separately with the cosmetic-only script; do not invoke
the broad setup endpoint merely to change an avatar.
