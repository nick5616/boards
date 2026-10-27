# Module UI rules

> How a module should look and behave so a board with 30 of them still reads at a
> glance. The kit lives in `src/components/modules/kit.jsx` and `src/styles/kit.css`,
> next to the older shared classes in `boards.css` (`.mini-btn`, `.line-input`,
> `.x-btn`, `.pile-toggle`).

The best modules already do this: Tally is a chalkboard, Punch card is a punch card,
Jar is a jar. One object, a number, one or two things to tap.

## 1. One object, one title
- The frame's label strip already names the module ("BAROMETER"). **Don't draw the name
  again** inside it as a header or title bar.
- The object's own printed face is fine when it *is* the object, like a newspaper
  masthead. Keep it small.
- **One surface.** The object fills the module body, or sits straight on it.
  - No bordered, shadowed box inside the white frame.
  - No cards inside cards.
  - At most one inner panel.

## 2. Small on the board, everything when opened big
- **On the board** (`expanded === false`), the card shows:
  - its glanceable face: today's word, the next tide, the next episode
  - **at most two** primary actions
  - It must be useful at about 300 × 300.
- **Everything else** goes in the big sheet (`expanded === true`), or behind a
  `<Fold>` "more ▾": search, settings, filters, history, long lists, more than three
  tabs, units, place.
- On the board, a list shows its first few rows and a "+ N more" that opens big
  (`openBig`).

## 3. Keep it narrow (borrowed from phone design)
- **Tabs:** a `<Seg>` segmented control, not a row of separate buttons.
- **Chips:** many chips go in a `<ChipRow>` that scrolls sideways. Never a wall of
  wrapped pills.
- **Rows:** one input and one button per row.
- **Secondary actions:** icon buttons with an `aria-label` (↻ ✕ ⋯ ♡).
- **Long text:** truncate it with an ellipsis instead of wrapping onto three lines.
  The full text can be in `title` or in the big view.
- **Under about 360 px:** stack label over value rather than side by side. Tables
  become lists.
- **Widths:** no fixed width over 260 px in the board view. Nothing may be wider than
  its frame.

## 4. Type
| Face | For |
|---|---|
| **DM Sans** (`--ui`) | everything that's interface: buttons, labels, meta, body text |
| **Caveat** (`--hand`) | handwriting: what a person typed (notes, entries) and line-input placeholders |
| **Cormorant Garamond** (`--serif`) | names of things: a book, a poem, a show, an album |

- A special display face only for the object's printed face, and only once.
- Sizes: body 13 to 15 px, meta 11 px, nothing under 10.5 px.

## 5. Controls and colour
- **Buttons:** `.mini-btn` for the primary action, `.mini-btn.ghost` for secondary,
  `.x-btn` to remove, `.line-input` for text.
  - **One primary action per view.**
  - No module-specific button styles, except the object's own physical controls
    (a buzzer, a dial, a reel).
- **Colour:**
  - **UI:** ink `--ink` on paper, accent `--hi` (yellow) for "on" or "primary", and
    `--red` for marks and warnings. Don't invent new pill colours.
  - **The object** may have its own palette (a red radio, a green chalkboard).

## 6. Empty, loading, error
- **Empty:** `<Empty action={…}>` with one sentence and one action, centred. No
  paragraphs of instructions.
- **Setup:**
  - **Place:** `<PlaceAsk>` (shared home place: see §7).
  - **Key:** a missing key is one line, "needs a free X key", linking to Settings →
    API keys.
- **Loading and error:** they show in the `<Credit>` line, with a ↻ retry. The card
  never goes blank. Keep the last good data on screen (`cachedJSON` returns stale
  copies offline).

## 7. Place
- Use `usePlace(state.place)` from `src/lib/place.js` and `<PlaceAsk>`.
- "Where you are" is asked once for every module and lives in the browser.
- A module keeps its own `state.place` only when someone picks a different one for it.
  Changing it ("📍 Portland · change") lives in the big view or a Fold.

## 8. Credits
- One `<Credit>` line at the very bottom: source, "updated 3:02pm" and ↻.
- Not a multi-line list of links. The full attribution can sit in the big view.

## 9. Size
- `desk` and `mobile` default sizes fit a filled-in card without scrolling.
- An empty card shouldn't leave a big blank below.
- `.mod-body` scrolls if content overruns, but content never forces the frame wider
  or taller.

## Checking
1. Run the dev server (`npx vite --port 5288`).
2. Screenshot your modules at desktop and phone size, closed and opened big:
   `node shootmod.cjs <outdir> <type,type> --open`. It's in the session scratchpad.
3. Look at the pictures. Fix, and shoot again.
4. Check Settings → Diagnostics for failing APIs and crashes.
