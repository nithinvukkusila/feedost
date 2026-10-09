# FeeDost design system — "Bahi-khata"

The red-cloth account book: a cloth cover, yellow pages, ink-blue figures, hard stamp shadows, a green PAID stamp.

**Source of truth for layout:** the design canvas, https://claude.ai/artifact/Hw29EoVQpkcfqCKL7xTq3H (working files in `design/project/`). This file is the source of truth for tokens and rules. When the two disagree, ask.

## Colour tokens

| Token | Hex | Use |
| --- | --- | --- |
| `cloth` | `#A81C22` | Cover surfaces (hero, headers on public pages), overdue text and tags, destructive text |
| `cloth-deep` | `#5E0D11` | Shadow under elements that sit on cloth |
| `stitch` | `#E9C95A` | Dashed border on cloth surfaces |
| `on-cloth` | `#F7E7A0` | Text on cloth |
| `on-cloth-soft` | `#FBF1C8` | Secondary text on cloth |
| `page` | `#FAF3D3` | App background |
| `page-ruled` | `#F8ECB8` | Website background (with faint rules `#F0E2A6`) |
| `slip` | `#FDF6D8` | Cards, sheets, list surfaces |
| `rule` | `#C9B56A` | Row dividers |
| `tab-idle` | `#E6D38A` | Unselected index tabs, loading blocks |
| `ink` | `#1A1410` | Text, 2px borders, "record" buttons |
| `ink-soft` | `#4A3F1E` | Secondary text |
| `ink-label` | `#6B5B2A` | Small labels |
| `blue` | `#1B2B8F` | Amounts, "send" and "pay" buttons, links, field values |
| `stamp` | `#1F6B3C` | Paid, confirmed, success |
| `highlight` | `#F4C430` | Due tag, selected option, callouts |
| `bubble` | `#E4F0D2` | WhatsApp message previews |

All text pairs in use pass WCAG AA. Red and green are close in lightness, so never rely on them alone: pair with a word, a shape or a size.

## What each colour means on a control

- **Blue button:** sends a message or pays. Remind, Open WhatsApp, Pay with UPI, Share.
- **Black button:** records or saves. Mark paid, Add, Save, Next, Confirm.
- **Outline button:** secondary.
- **Red:** never a button. Cloth surfaces, overdue, and the "Delete my account" text link.

## Type

| Role | Face | Settings |
| --- | --- | --- |
| Headlines, amounts | Bricolage Grotesque 800 | letter-spacing -0.04em, line-height 0.9–0.95 |
| Reading text | Bricolage Grotesque 400–700 | 15–18px, line-height 1.4 |
| Labels, dates, receipt numbers | DM Mono 400–500 | 14px, uppercase, letter-spacing 0.04em |
| Hindi, Kannada, Telugu | Anek Devanagari / Kannada / Telugu | headline weight 700, line-height ≥1.25, letter-spacing 0, reading text 17px at 1.6, labels 15px weight 600, no uppercase |

- Minimum size 14px anywhere.
- Amounts never use Anek and always use 0–9 digits and Indian grouping, in every language: Bricolage for headline amounts, DM Mono for amounts in rows (decided 2026-10-09).
- Font stacks end in `'Anek Latin', system-ui` so a missing ₹ glyph falls back cleanly.

## Shape and depth

- Borders: 2px `ink`. Dividers inside a slip: 1px `rule`.
- Corners: 4px on buttons, 0 on slips, 6px on the top of index tabs. Stamps and the round remind button are circles.
- Shadow: solid, offset, no blur. Buttons `5px 5px 0 ink` (black buttons use `ink-label` as the shadow colour); slips `6px 6px 0 ink`.
- Cloth surfaces carry a 2px dashed `stitch` outline inset 8–14px.
- Rotation is for stamps only (about -12°). In code the stamp's ring stays unrotated and only its words tilt, so a large stamp cannot cause sideways scroll.

## Components (build these in slice F2: F2a builds the first eight in the build plan, F2b the other five)

| Component | Notes |
| --- | --- |
| `Button` | variants `send` (blue), `record` (black), `outline`; height ≥48px; press moves it 5px into its shadow in 80ms; focus ring 3px blue offset 4px (yellow on dark grounds); `busy` keeps it pressed and changes the label |
| `Field` | label above, value written on a 2px line; states empty, typing (4px blue), correct (green + tick), needs fixing (3px red + message that says how to fix) |
| `Slip` | `slip` surface, 2px border, hard shadow |
| `Row` | ledger row, min-height 64px, name + meta left, mono amount right, optional action |
| `StatusTag` | Overdue (red solid outline), Due (highlight fill), Part paid (blue dashed outline), Paid (green double outline) |
| `Stamp` | double-ring circle, sizes sm/md/lg, text PAID / SENT / ALL PAID plus optional date |
| `IndexTabs` | folder tabs joined to the slip below; selected tab is taller and `slip` coloured |
| `Segmented` | 2px bordered group; selected segment is black |
| `Sheet` | bottom sheet on a dark ground `#2A0709` |
| `StudentStrip` | one block per student: paid short and filled, due short and hollow, overdue tall and red; always with a text legend |
| `Switch` | square, 76×44, ON in green |
| `BottomNav` | Home, Students, Attendance, More; selected item has a 5px red bar on top |
| `Banner` | offline (black), error (red outline, says what happened and what is safe), undo (black, two actions) |

## Writing

- Plain words. "Mark as paid", not "Stamp it". The metaphor is visual; labels are literal.
- Errors say what is wrong and how to fix it. Never a code.
- Say "WhatsApp" on anything that opens WhatsApp.
- No emoji.

## Motion

- Button press: 80ms translate, no easing curve needed.
- Stamp appearing after a payment: one 200ms scale from 1.15 to 1 with a slight rotation settle. This is the only celebratory motion in the app.
- Respect `prefers-reduced-motion`: no marquee, no stamp animation.
