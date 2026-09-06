# Menu artwork v6

The Free, Crash, PvP, Mines and Dice menu images use the Color variants from
[Microsoft Fluent Emoji](https://github.com/microsoft/fluentui-emoji), licensed
under MIT. These are existing vector illustrations, not AI-generated images.
The source licence is included in `public/images/menu/LICENSE-FLUENT.txt`.

| Local file | Original source |
| --- | --- |
| `gift-v6.svg` | `assets/Wrapped gift/Color/wrapped_gift_color.svg` |
| `rocket-v6.svg` | `assets/Rocket/Color/rocket_color.svg` |
| `swords-v6.svg` | `assets/Crossed swords/Color/crossed_swords_color.svg` |
| `bomb-v6.svg` | `assets/Bomb/Color/bomb_color.svg` |
| `dice-v6.svg` | `assets/Game die/Color/game_die_color.svg` |

All five files live in `public/images/menu/`. They use their native transparent
SVG backgrounds and do not need blend modes or CSS shadows. The Free case card,
catalogue cover and deposit gift tab share the same gift illustration. The pug
mascot and the rocket inside the Crash game are unchanged by this menu-only update.

Palette-only adaptations: the gift uses a blue box and pink ribbon to match the
supplied reference; the bomb uses charcoal/steel-blue shading instead of purple.
The original vector shapes are retained.

Case ordering is applied after effective Stars prices are computed: free first,
then ascending numeric price, then ID for stable equal-price ordering. The update
does not alter rewards, weights, odds, prices or payment actions.
