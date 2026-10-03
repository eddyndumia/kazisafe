# KaziSafe visual theme

Style reference: fundingpips.com (layout and feel only, no logo, copy or imagery). Their navy swapped for orange.

## What we take from the reference
- Light, airy page: off-white background, lots of white space.
- Thin promo bar across the very top.
- Floating white nav "pill": rounded 12px, soft shadow, sticks to the top.
- Huge hero headline: DM Sans 600, ~80px desktop, tight tracking (-0.04em), dark ink colour.
- Body and UI text: Inter.
- Buttons: 8px radius, 14px/500. Primary = solid fill, secondary = white with hairline border.
- Glossy 3D hero object with glow (theirs: blue crystal + lightning; ours: orange glass shield/lock with warm glow).
- Stat row under the hero (big number + small label with icon).
- Big soft cards, 24px radius, very light tinted fill, centred content, testimonial line at the bottom.
- Check-pill lists (white pills, green check on the right).
- Growth bar chart in shades of the brand colour.
- Segmented controls / tabs for switching views.
- Dark "money" card with big number (theirs navy; ours deep brown-black with orange shine).

## Glass layer (launch site)
The reference's signature is glass: frosted, translucent panels over a glowing backdrop, with a glossy glass 3D object in the hero.
- Hero backdrop: soft orange-to-cream radial glow with light streaks (our version of their sky + lightning).
- Glass panels: `background: rgba(255,255,255,0.55); backdrop-filter: blur(18px) saturate(140%); border: 1px solid rgba(255,255,255,0.7); box-shadow: 0 10px 40px rgba(194,65,12,0.12)`.
- Floating nav, stat row and feature cards all use the glass panel.
- Hero object: an orange glass shield / lock built in CSS/SVG with highlights, refraction gradient and glow.
- Dark glass card for the "money in escrow" display: deep ink with orange inner shine.

## Tokens
| Token | Light | Use |
|---|---|---|
| --ink | #2A1406 | headings, dark card, primary text |
| --text | #5B4636 | body copy |
| --muted | #9A8676 | labels |
| --bg | #FBF8F5 | page |
| --card | #F6EFE8 | soft cards |
| --line | rgba(42,20,6,0.08) | borders |
| --brand | #F2600C | primary buttons, highlights |
| --brand-deep | #C2410C | hover, chart top bar |
| --brand-soft | #FFE6D5 | chips, glows |
| --ok | #22C55E | checks |

Dark mode: --bg #120A05, --card #1E130B, --ink #FFF4EC, --text #D9C6B6, brand unchanged.
