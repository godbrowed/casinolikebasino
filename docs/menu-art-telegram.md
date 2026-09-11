# Menu artwork and case presentation

The lobby combines existing Telegram emoji artwork and gift images with the
existing PugGift rocket. No new generated illustrations were added in this pass.
Files are served locally; no Bot API credentials or remote file URLs are shipped
to the client.

| Asset | Source |
| --- | --- |
| `bomb-telegram.webp`, `rocket-telegram.webp` | 128px thumbnails from Telegram's public `AnimatedEmojies` sticker set, obtained via `getStickerSet` / `getFile` |
| `swords-telegram.png` | `https://telegram.org/img/emoji/40/E29A94.png` |
| `dice-telegram.png` | `https://telegram.org/img/emoji/40/F09F8EB2.png` |

These files retain their original artwork; no recolouring or AI regeneration was
performed. Their availability from Telegram does not make them MIT-licensed or
public domain. Existing Fluent and Twemoji notices only apply to the older files
documented in their own manifests.

The free lobby entry uses the existing Bunny Muffin Telegram gift image. Catalog
cards show one gift from the actual case pool, with no collage or generated box.
Visible NFT-chance labels have been removed; server probabilities, prices and
numeric case-price ordering have not changed.

Case screens share a plain `#19428b` canvas, unframed reels, two Settings / Prizes
controls, and the existing opening / fast-spin / sell-all behaviour.

Animated PvP swords are separate layers of the existing Twemoji `swords.svg`
(Twitter/Twemoji, CC-BY 4.0), produced by `scripts/prepare-menu-swords.cjs`.
They retain the original paths; only the grouping and CSS transforms changed.
Source: https://github.com/twitter/twemoji/blob/master/assets/svg/2694.svg
License: https://creativecommons.org/licenses/by/4.0/

Lobby sticker motion uses transforms only, pauses outside the viewport and in
hidden tabs, and is disabled with reduced-motion preferences. It does not read
or simulate game outcomes.
