# PugGift visual assets — v5

Generated with the built-in image_gen tool. The UI remains native React/CSS. Original outputs are retained as versioned source PNGs; export-brand.cjs only resizes and encodes them. No generated artwork is used to represent another user's profile photo.

## Avatar

Output: public/images/puggift-avatar-v5-source.png; web: public/images/puggift-mark-v5.webp; bot: public/images/puggift-bot-avatar-v5.png.

Initial prompt:

Use case: illustration-story. Asset type: production Telegram bot avatar for PugGift, square 1024x1024. Primary request: a beautifully drawn original pug dog head, with the visual craft of a polished 2D Telegram collectible sticker. Background is entirely solid Telegram royal blue #2b6eff. One large centered fawn pug head in slight three-quarter view, occupying 78 percent of canvas and staying within a circular-safe crop. Short folded black ears, believable broad wrinkled forehead, cream and tan face, dark charcoal muzzle, large expressive dark brown eyes with one restrained highlight, mildly unimpressed confident expression with a hint of charm. Hand-inked smooth tapered outlines and carefully designed few flat cel-shaded areas, clean silhouette, excellent small-size readability. It must be clearly a PUG, not a gorilla or bulldog. This is sophisticated cartoon character illustration, NOT a simplified geometric emoji and NOT an esports badge. No text, letters, coins, stars, accessories, border circle, background pattern, neon lighting, rim glow, 3D rendering, shiny plastic, photorealistic fur, generic AI painterly texture, excessive tiny detail or gradients. Matte warm colors, bold dark outline, purposeful natural drawing.

Final style refinement:

Use case: style-transfer. Edit target: the provided pug avatar. Keep the same pug identity, head angle, blue background and square composition. Change only the rendering style: turn the furry portrait into a crisp polished Telegram collectible sticker illustration, with smooth bold black outlines and 5 to 7 broad clean flat cel-shaded color regions. Remove ALL individual fur strokes, whiskers, nose speckles and painterly texture. Retain only 3 or 4 deliberate curved forehead wrinkles. Eyes slightly more confident and unimpressed with a defined upper eyelid. Keep warm fawn face and charcoal folded ears and muzzle. No 3D, no gradient, no glow, no circle border, no text, no extra elements. The final drawing should have the graphic clarity of a hand-drawn cartoon animation character, not a traced photo, minimal emoji or esports logo. Leave more blue padding: the head occupies 78 percent of square, circular-crop safe.

## Start banner

Output: public/images/puggift-start-banner-v5-source.png and public/images/puggift-start-banner-v5.jpg.

Use case: ads-marketing. Asset type: 16:9 Telegram bot /start banner for PugGift. Reference image: preserve this exact warm fawn pug identity, dark ears and muzzle and confident face. Composition: a polished restrained editorial graphic on an entirely solid royal blue #2b6eff background. Oversized white wordmark 'PugGift' clearly typeset on the left half, one line, bold clean rounded geometric sans-serif, with small line 'Telegram gifts' below it in white. The same beautifully drawn pug head occupies the right half, slight tilt for personality, with generous outer margin and no rectangular photo border. Flat cel-shaded 2D sticker character style, strong dark outline. Text verbatim: 'PugGift' and 'Telegram gifts' only. No additional objects, coins, diamonds, stars, grids, neon, gradients, 3D, slogan, buttons, banner frame, glow, plastic rendering, texture or tiny fur details. Make the layout look considered and professionally art-directed, very clean, not a busy casino ad.

## Rocket

Output: public/images/puggift-rocket-v5-source.png; web: public/images/puggift-rocket-v5.webp.

Use case: illustration-story. Asset type: transparent-background 2D game sprite for PugGift rocket and game menu. Reference: preserve this exact fawn pug identity, dark ears and muzzle and unimpressed confident face. Draw that pug sitting visibly in the open round cockpit of a small bright royal-blue and cyan cartoon rocket, entire rocket points diagonally up-right about45 degrees, polished collectible Telegram sticker illustration. Big simple face, rounded metallic-white cockpit rim, two blue fins, compact orange flame trailing bottom-left. One coherent clean silhouette, bold dark tapered outlines and a few flat cel-shading areas, transparent background with real alpha. Entire rocket and flame visible with generous margin. No text, letters, numbers, badges, stars, currency, moon, border, square background, neon glow, photorealism, fur texture, gradients, 3D or glossy plastic. It must feel like an attractive drawn 2D animation character sprite, with the dog's face actually inside the cockpit, not a pasted avatar medallion.

The first rocket output had a baked checkerboard, not an alpha channel, and was rejected for UI use. Final background correction:

Change ONLY the background of this rocket sprite. Remove the checkerboard completely and replace it with one absolutely uniform flat solid dark navy color HEX #081122 edge to edge. Keep the entire pug, face, rocket, flames, outlines, shape, angle, margins and all details exactly unchanged. There must be NO checkerboard, no transparency simulation, no vignette, no stars, no texture or gradient in the background. The image will sit on a #081122 game canvas, so the uniform background color must match exactly. Do not add any text or new elements.

## Other assets

- Manrope variable: https://github.com/google/fonts/tree/main/ofl/manrope — SIL OFL; license in public/fonts/manrope-OFL.txt.
- Gift, swords, bomb, dice symbols: https://github.com/jdecked/twemoji — CC BY 4.0; license in public/images/menu/LICENSE-TWEMOJI.txt. Unmodified SVG artwork by Twitter/Twemoji contributors.
- Plush Pepe, Heart Locket, Bunny Muffin: original Telegram gift catalogue images already used by this application, cached from storage.portal-market.com. These are menu illustrations, not fabricated live drops.
