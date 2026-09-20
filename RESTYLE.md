# Restyle spec: sharpen IN-NOLA toward the Bulbancha look

Written 2026-09-20. The goal is a cleaner, sharper site that reads like the other builds,
with **zero change to how anything works**.

## The hard rules

1. **Only `global.css` is edited.** No HTML, no JavaScript, no files under `functions/`, no `wrangler.toml`.
   Forms, logins, sessions, key-value storage and the admin portal cannot break if their files are never touched.
2. Work on a branch. If a change looks wrong, throw the branch away, not a week of work.
3. Nothing is deleted from `global.css` that a page might depend on. Rules are overridden, not removed.
4. Every page-level `<style>` block stays as it is. They win over `global.css` by source order, so a page that
   looks unchanged after a task is expected, not a bug.

## Why one file is enough

78 HTML pages link `global.css` and nothing else, so the whole site can be restyled from that one file.
That is also why a new stylesheet is the wrong idea here: adding one would mean editing 78 pages.

## What "sharper" means, concretely

Bulbancha's look comes from five decisions, not from its colors:

| Decision | Bulbancha | IN-NOLA today |
|---|---|---|
| **Three type voices** | a display face for statements, a condensed sans for navigation, labels and dates, a plain sans for paragraphs | one serif for everything |
| **Text aligned left** | paragraphs left, only heroes centered | the whole `body` is centered, which is the single biggest reason it reads soft |
| **One measured column** | `--wrap: 1120px` with a `clamp()` gutter, same on every page | varies per page |
| **Flat surfaces with a hairline** | solid panels, 1px border, small radius, one restrained shadow | translucent glass, blur, 12 to 20px radius, glow |
| **A rhythm** | section padding from one scale, headings with tight leading | spacing set per page |

Adopt those five. The colors stay for now: see the two phases below.

## Phase one, this session: structure only

Keep the dark green and gold. Change type, alignment, width, surfaces and rhythm. This is safe because
every page was written assuming light text on a dark background, and that assumption is not being touched.

Type voices to adopt, keeping the site's own character:

```css
--display: 'Cormorant Garamond', Georgia, serif;   /* stays: it suits the heritage */
--ui:      'Oswald', 'Arial Narrow', Impact, sans-serif;   /* nav, buttons, labels, dates, h3 */
--body:    'Source Sans 3', -apple-system, 'Segoe UI', sans-serif;  /* paragraphs */
```

Other tokens: `--wrap: 1120px`, `--gutter: clamp(1.25rem, 4vw, 2.5rem)`, `--radius: 6px`, `--radius-lg: 10px`,
and `--gold-glow` reduced to a plain 1px border color.

## Phase two, a later session: the light version

Flipping to Bulbancha's cream and navy is a bigger job, and it is not a CSS-only job. Roughly a dozen pages
carry hardcoded white text in their own `<style>` blocks or `style=` attributes, and those go invisible on a
cream background. That phase needs an audit of every hardcoded color first. Do not start it in the same
session as phase one.

## How each task is checked

Render the page as a file with headless Chrome and look at it:

```
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --headless --disable-gpu --window-size=1280,900 --screenshot="C:\Users\seanm\AppData\Local\Temp\innola.png" "file:///C:/in-nola-demo-site/index.html"
```

The API-backed parts (events, seanchas, login state) will not load from a file, and that is fine: this pass
is about type, spacing and surfaces. Never spend more than two renders on one task.

## The pages to check at the end

`index.html`, `join.html`, `donate.html`, `contact_form.html`, `About-IN-NOLA/`, `Our-Village/`,
`Our-Village/Our_Library/seanchas.html`, `membership-tools/`. If those eight look right, the site looks right.

## Rolling back

Everything is one file on one branch:

```
git checkout main            # the old look, untouched
git checkout restyle         # the new one
git checkout -- global.css   # throw away the current task only
```
