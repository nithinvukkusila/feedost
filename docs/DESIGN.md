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

- Headline amounts that may be wider than their box shrink to fit it (`amount-box` with `amount-size-*`, never under 14px): 72px and 60px for the board and receipts, and 36px (`amount-size-4xl`) for the amount in the Remind card (R1-8). The canvas draws that amount at 40px; 36px is the nearest token.
- Minimum size 14px anywhere.
- Amounts never use Anek and always use 0–9 digits and Indian grouping, in every language: Bricolage for headline amounts, DM Mono for amounts in rows (decided 2026-10-09).
- Font stacks end in `'Anek Latin', system-ui` so a missing ₹ glyph falls back cleanly.

## Shape and depth

- Borders: 2px `ink`. Dividers inside a slip: 1px `rule`.
- Corners: 4px on buttons, 0 on slips, 6px on the top of index tabs. Stamps and the round remind button are circles.
- The WhatsApp message preview bubble has 18px corners, 4px at its top-left. This is the one recorded exception to "corners 4px at most", for the message bubble only (token `--radius-bubble`, slice R0-2).
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
| `Check` | (R1-8) one tick box in a list for choosing several rows: a real `<input type="checkbox">` in its `<label>`, 28px box with a 2px border, black fill and a tick when selected; the row says the state in a word beside it ("Selected" / "Not selected"), so colour never carries it; the whole row is the target, min-height 44px, and grows with its words; focus ring 3px blue offset 4px |
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

## Wide screens (slice D1)

The phone is the primary screen and does not change. Wider windows get the same screens with more room; nothing is added to a screen that the phone does not show. All of it is CSS on one page: no script reads the window width, and a window resized across a breakpoint changes layout live without losing what was typed.

- **Breakpoints** are Tailwind's own, in rem: `md:` 48rem (768px) and `lg:` 64rem (1024px). They follow the browser's text size and zoom, so a browser at 200% shows the phone layout on a wide window. Never write a pixel media query.
- **Below 768:** the phone column, at most 28rem (448px), bottom navigation, bottom sheets.
- **768 to 1023 (tablet):** the same single column, 42rem wide and centred, with the bottom navigation. Sheets are centred dialogs.
- **1024 and up (laptop):** the cloth is the page ground, with its dashed `stitch` outline inset 8px. On it sits the "book": the page colour, a 2px `ink` border and the `slip` offset shadow in `cloth-deep`, at most 80rem wide and centred. The navigation stands down its left side, 15rem wide (`--spacing-sidenav`), with the product name from `brand.ts` above it. The same four links, the same labels, at least 44px high; the current one has its 5px red bar on the left edge (the mark moves from the top to the left). The screen's content is a column of at most 42rem beside it until a screen has two things to show (D1b: the board, D1c: the lists).
- **One shell owns the width.** `AppScreen` (`src/components/app/app-screen.tsx`) is the only place that sets a signed-in page's width; a screen never writes its own `max-w-*` (`layout-rules.test.ts` fails if it does). Screens before the book (sign-in, the way back from Google, setup) use `ClothGround`: the page colour on a phone, the cloth with one centred slip from 768 up (28rem; 36rem for the setup forms).
- **One navigation.** There is a single `<nav>`: first in the page (so the keyboard reaches it first on a laptop), drawn last and pinned to the foot of the window below 1024. Its wrapper has `lg:contents`, so the Undo banner (`above`) leaves it and sits at the foot of the content column, as wide as the content.
- **Sheets** are a native `<dialog>`: a bottom sheet below 768; from 768 a centred modal at most 32rem wide and never taller than the window minus 4rem (`--spacing-modal`), scrolling inside itself. The dark sheet ground is the backdrop. Focus, Escape, focus return and the inert page are the browser's.
- **Targets** stay 44px and text stays 14px at every width. A desktop is not a licence to shrink them: a touch laptop and a tablet in landscape are both 1024 and up.
- **Public pages** (landing, free tools) cap at 80rem from 1024 and use two columns where the canvas does (hero, the tool's form and message); 42rem from 768 to 1023; as today below 768. `/p/` and `/r/` pages (parents) stay a single centred column at most 28rem at every width and never use `AppScreen`.
