---
name: NET Lab
description: "The NET Lab's research site: near-white and near-black grounds, two-tone grotesk headlines, and live figures drawn in the logo's seven research-area colors."
colors:
  # The logo's seven trace colors, one per research area. Fills, strokes, dots and lights only.
  pink: "#ED3F95"
  cyan: "#00AEEF"
  orange: "#F89938"
  purple: "#89298E"
  lime: "#76C044"
  green: "#00A775"
  yellow: "#D8E022"
  # Text-safe area inks, and purple's stroke variant for dark grounds.
  pink-ink: "light-dark(#B8146A, #F25CA6)"
  cyan-ink: "light-dark(#006D9E, #33BFF2)"
  orange-ink: "light-dark(#9A4F00, #F89938)"
  purple-ink: "light-dark(#89298E, #C07BC6)"
  lime-ink: "light-dark(#3B7417, #8BCF5C)"
  green-ink: "light-dark(#00744F, #1FC28F)"
  yellow-ink: "light-dark(#666B00, #D8E022)"
  purple-line: "light-dark(#89298E, #B060B6)"
  # Interaction.
  focus: "light-dark(#006D9E, #33BFF2)"
  select: "light-dark(rgb(0 174 239 / .22), rgb(0 174 239 / .32))"
  # Page neutrals.
  bg: "light-dark(#FAFAFB, #08090C)"
  bg-2: "light-dark(#F2F3F5, #101217)"
  ink: "light-dark(#0A0B0F, #F3F4F6)"
  ink-2: "light-dark(#545966, #A4A9B4)"
  ink-3: "light-dark(#666B77, #868C98)"
  line: "light-dark(#E3E5E9, #1E2128)"
  line-2: "light-dark(#CFD2D8, #2E323B)"
  # Figure stage and the neutral inks animations draw with.
  fig-bg: "light-dark(#F1F2F4, #0E1015)"
  fig-ink: "light-dark(#14161C, #E9EBEF)"
  fig-ink-2: "light-dark(#5A5F6B, #9CA1AC)"
  fig-ink-3: "light-dark(#676C78, #8A909C)"
  fig-line: "light-dark(#D5D8DE, #262A33)"
  fig-grid: "light-dark(#E4E6EA, #181B22)"
  fig-surface: "light-dark(#FFFFFF, #161920)"
  scene-bg: "#05070B"
typography:
  page-title:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "clamp(44px, 6.4vw, 92px)"
    fontWeight: 720
    lineHeight: 0.98
    letterSpacing: "-0.034em"
  display:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "clamp(38px, 4.5vw, 72px)"
    fontWeight: 720
    lineHeight: 0.98
    letterSpacing: "-0.034em"
  headline:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "clamp(32px, 3.9vw, 58px)"
    fontWeight: 720
    lineHeight: 1.02
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "clamp(20px, 1.2vw + 14px, 27px)"
    fontWeight: 680
    lineHeight: 1.18
    letterSpacing: "-0.014em"
  lede:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "clamp(19px, 0.9vw + 14px, 25px)"
    fontWeight: 400
    lineHeight: 1.42
    letterSpacing: "-0.008em"
  body:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "clamp(16.5px, 15.6px + 0.25vw, 18px)"
    fontWeight: 400
    lineHeight: 1.6
  small:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "14.5px"
    fontWeight: 400
    lineHeight: 1.5
  control:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "14.5px"
    fontWeight: 580
    lineHeight: 1
  label:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "13px"
    fontWeight: 650
    letterSpacing: "0.06em"
  data:
    fontFamily: "Red Hat Mono, ui-monospace, SF Mono, Menlo, Consolas, monospace"
    fontSize: "12.5px"
    fontWeight: 500
    fontFeature: '"tnum"'
rounded:
  radius-sm: "10px"
  radius: "16px"
  pill: "999px"
spacing:
  cluster: "8px"
  stack: "12px"
  gutter: "clamp(16px, 4vw, 56px)"
  section-head: "clamp(32px, 4vw, 56px)"
  section: "clamp(72px, 9vw, 144px)"
  header-h: "64px"
components:
  button:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    rounded: "{rounded.pill}"
    padding: "0 15px"
    height: "36px"
  button-hover:
    backgroundColor: "{colors.bg-2}"
    textColor: "{colors.ink}"
  icon-button:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    size: "38px"
  icon-button-hover:
    backgroundColor: "{colors.bg-2}"
  chip:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    rounded: "{rounded.pill}"
    padding: "0 14px"
    height: "36px"
  chip-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.bg}"
  search-input:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.ink}"
    typography: "{typography.small}"
    rounded: "{rounded.pill}"
    padding: "0 14px 0 36px"
    height: "36px"
  nav-link:
    textColor: "{colors.ink-2}"
  nav-link-current:
    textColor: "{colors.ink}"
  figure-stage:
    backgroundColor: "{colors.fig-bg}"
    rounded: "{rounded.radius}"
  figure-stage-scene:
    backgroundColor: "{colors.scene-bg}"
    rounded: "{rounded.radius}"
  placeholder-tag:
    backgroundColor: "{colors.fig-bg}"
    textColor: "{colors.fig-ink}"
    typography: "{typography.data}"
    rounded: "7px"
    padding: "5px 9px 5px 7px"
  media:
    backgroundColor: "{colors.bg-2}"
    rounded: "{rounded.radius}"
  toast:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.bg}"
    typography: "{typography.control}"
    rounded: "{rounded.pill}"
    padding: "11px 18px"
---

# Design System: NET Lab

## Overview

**Creative North Star: "The Living Figure"**

The NET Lab site is the research-lab category standard played straight, at the polish of MIT Media Lab and Google DeepMind. Its North Star is a great paper figure come alive: a quiet, nearly monochrome page is the gallery wall, and every paper and project hangs on it as a rounded stage running a live animation of its own mechanism. The page recedes so the work can lead. Color and motion live in the figures, not in the chrome.

The voice is precise, calm and quietly playful. One self-hosted grotesk carries every word, set heavy and tight in two-tone headlines whose gray second half does the job an eyebrow or kicker would do elsewhere. Red Hat Mono appears only where the machinery shows: counts, years, figure labels and the placeholder tag. Landing surfaces are generous and airy; the archive pages are long, orderly runs of entries between hairlines.

The logo's seven trace colors are the research areas, one color per area, everywhere. The home page opens calmly: a plain statement of what the lab does beside the logo, so a visitor who has never heard of the lab understands it first. Motion has one grammar, exponential ease-out: each figure powers on once with a wipe and a scan line in its area color, then runs only while it is visible; pages cross-fade through view transitions; visitors who prefer reduced motion, or who pause animations from the footer, get a chosen still frame of every animation. Confirmed rejections: the Bootstrap card stack the old site used, the plexus or mesh background every networking lab ships, costume worlds of any kind, a busy animated hero (the lab's PI found the first one confusing for newcomers), per-figure pause buttons, and copy that recites counts ("7 projects, 23 papers").

**Key Characteristics:**
- Near-white and near-black grounds, cool gray inks, 1px hairline rules.
- Seven logo colors, each meaning one research area and nothing else.
- Two-tone grotesk headlines (ink, then gray); no eyebrows or kickers.
- Every paper and project explained by a live figure on a 16px rounded stage.
- Neutral pill controls; a selected state inverts to ink.
- Red Hat Mono for data and machine text only.
- Flat surfaces; shadow only for what floats.
- Exponential ease-out; one power-on per figure, no scroll reveals.

## Colors

A cool, near-neutral gray system (OKLCH hue about 265, chroma at most 0.022) carrying seven saturated logo colors, each of which means exactly one research area. Every token maps to a custom property in `css/site.css` (`pink` is `--c-pink`, `pink-ink` is `--c-pink-ink`, `bg` is `--bg`). Themed tokens are `light-dark()` pairs, so the page follows the system theme without script; the header toggle pins a theme by setting `data-theme` on the root element.

### Primary

The seven research-area colors, taken unchanged from the logo's traces (`_config.yml` lists them). Base values are for fills, strokes, dots and lights, never for text. `_data/areas.yaml` names the areas and the `[data-area]` rules in `css/site.css` bind each to its color.

- **Hexagon Pink** (#ED3F95): Sub-protocols.
- **Process Cyan** (#00AEEF): Underwater. Also the default area when nothing sets one.
- **Trace Orange** (#F89938): Vehicles.
- **Plum** (#89298E): Spectrum sharing. Its strokes switch to Plum Line on dark grounds.
- **Leaf Lime** (#76C044): Environmental sensing.
- **Jade** (#00A775): Health & home.
- **Chartreuse** (#D8E022): Wi-Fi & long range.

On the light figure stage five of these are faint as thin lines (Chartreuse 1.3:1, Trace Orange 2.0:1, Leaf Lime 2.0:1, Process Cyan 2.3:1, Jade 2.8:1 against the stage). Figures carry the contribution with weight (strokes of 2px and up, filled marks) plus an area-ink label, never with a thin line of hue alone.

### Secondary

- **Area Inks** (`pink-ink`, `cyan-ink`, `orange-ink`, `purple-ink`, `lime-ink`, `green-ink`, `yellow-ink`): every piece of text in an area color: area labels, decoded bits and captions inside figures, sidebar link hovers, and the underline of prose links in an area section (at 60%). Darker on light grounds and lifted on dark, each holds at least 5:1 against the page ground, Mist and the figure stage in both themes.
- **Plum Line** (`purple-line`): the stroke value for spectrum-sharing marks. Base Plum falls to 2.5:1 on the dark stage; Plum Line holds 4.7:1.

### Tertiary

- **Focus Blue** (`focus`): the 2px focus ring (3px offset) on everything interactive, and the search field's border while focused. It shares Process Cyan's ink values but appears only in response to input, so it never reads as an area.
- **Selection Tint** (`select`): selected text, Process Cyan at 22% (light) or 32% (dark). Native form controls take cyan-ink as their accent, and the text caret is pink-ink.

### Neutral

- **Paper / Night** (`bg`): the page ground, the header (at 92%, 96% once scrolled), sticky sub-bars, chips at rest; also the browser theme color.
- **Mist** (`bg-2`): the hover fill of buttons and icon buttons; the placeholder behind photos, portraits and card media; the code card.
- **Ink** (`ink`): headlines, body copy, selected chips, the current-page bar, the toast.
- **Ink 2** (`ink-2`): ledes, hooks, captions, abstracts, author lines, idle nav links.
- **Ink 3** (`ink-3`): the gray half of every two-tone headline, year numerals, venues and meta lines, list labels, counts. It holds 5.1:1 on the page ground, so it is safe for small text.
- **Hairline** (`line`): every rule and row divider, and the header's bottom edge once the page scrolls.
- **Hairline Strong** (`line-2`): the outlines of buttons, chips, the search field and icon buttons; the scrollbar; the faint footer π.
- **Stage** (`fig-bg`): figure stages.
- **Figure Inks** (`fig-ink`, `fig-ink-2`, `fig-ink-3`, `fig-line`, `fig-grid`, `fig-surface`): the neutral world inside every animation, read by the toolkit (`js/anim/kit.js`) each time a figure draws. `fig-ink` and `fig-ink-2` carry text and primary marks; `fig-ink-3` is the quietest ink, for tick labels, ghost traces and secondary marks; it still measures 4.7:1 on the light stage and 5.9:1 on the dark one, so small labels stay legible. `fig-line` draws axes and rules, `fig-grid` grids, `fig-surface` the caption pills.
- **Scene Black** (`scene-bg`): the stage behind cinematic project scenes, identical in both themes; each scene paints its own deep gradient over it.

### Named Rules

**The One Meaning Rule.** Each logo color means one research area, everywhere. Color enters a component only through its `data-area` attribute: `--area` for fills, strokes, dots and hover underlines, `--area-ink` for text. Anything without a research area stays neutral. Two exceptions only: the logo itself, and transient interaction cues (the focus ring, text selection, the caret).

**The Ink Variant Rule.** No text is ever set in a base logo color. Area text uses its -ink variant, which clears AA on every ground in both themes. Every base color fails AA as text in at least one theme: six of the seven on the light ground (Chartreuse at 1.4:1), Plum on the dark.

**The Neutral Chrome Rule.** Navigation, buttons, chips, inputs and rules are drawn in ink and gray only. A selected chip inverts to ink; it never fills with an area color. An area appears in a control only as its dot.

## Typography

**Display Font:** Schibsted Grotesk (with ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif), self-hosted, variable 400–900, roman and italic
**Body Font:** Schibsted Grotesk (same family)
**Label/Mono Font:** Red Hat Mono (with ui-monospace, SF Mono, Menlo, Consolas, monospace), self-hosted, variable 300–700

**Character:** A sturdy news grotesk set heavy (680–760) and tight (−0.014em to −0.034em) for headlines and plainly at 400 for reading, beside a mono that behaves like an instrument readout. Headlines balance their lines, prose wraps "pretty", and numerals in data are tabular.

### Hierarchy
- **Page title** (720, clamp(44px, 6.4vw, 92px), 0.98, −0.034em): the h1 on Papers, Projects, People and Articles. One or two words, so it is the largest type on the site. Longer titles step down: the Sub-protocols page (clamp(36px, 4.2vw, 60px), 1.04) and the 404 (clamp(40px, 5vw, 76px)).
- **Display** (720, clamp(40px, 5vw, 80px), 0.98, −0.034em): the home hero headline, two-tone, at most 17ch.
- **Headline** (720, clamp(32px, 3.9vw, 58px), 1.02, −0.03em): section and chapter heads, two-tone, at most 24ch (18ch in project chapters). Relatives: principle names (720, clamp(26px, 2.6vw, 38px)), and the Papers year numerals (720, clamp(32px, 3.4vw, 52px), −0.04em, ink-3, tabular).
- **Title** (680, clamp(20px, 1.2vw + 14px, 27px), 1.18, −0.014em): paper titles, project tiles, outreach items. Article cards run a step smaller (clamp(19px, 0.7vw + 15px, 23px)); names on person cards are 660 at 18px.
- **Lede** (400, clamp(19px, 0.9vw + 14px, 25px), 1.42, −0.008em, ink-2): the paragraph opposite a page title and each chapter's hook, at most 46ch. The home hero's lede is a step smaller (clamp(18px, 0.6vw + 14px, 22px)). The Mission quote sits in the lede's place at 560, clamp(19px, 0.8vw + 14px, 24px), 1.4, ink-2, at most 36ch, with hanging curly quotes and "— Steve Jobs" beneath in ink-3 at 15px; it is a quiet pull quote, never a display line.
- **Body** (400, clamp(16.5px, 15.6px + 0.25vw, 18px), 1.6): reading text. Prose runs at most 68ch, abstracts 70ch, figure captions 60ch, the Mission intro 48ch at its larger size. Paper hooks sit at 17px, 1.5, ink-2.
- **Small** (400, 14.5px, 1.5): captions, meta rows, venues, the search field; author lines at 15px.
- **Control** (580, 14.5px, 1): buttons, chips, the toast. Nav links are 560 at 15.5px; arrow links 620 at body size.
- **Label** (650, 13px, 0.06em, uppercase, ink-3): headings of lists only: the sidebar groups on Projects and the footer columns.
- **Data** (Red Hat Mono 500, 12.5px, tabular): the counts in filter chips, which keep the chip's weight. Variants: the placeholder tag (11.5px; 11px in figures under 300px wide), sidebar years (13px), bit strings (12px, 0.08em), past-undergraduate year groups (600, 14px), and labels drawn inside figures.

### Named Rules

**The Two-Tone Rule.** A headline that continues past its claim does so in gray (ink-3) in the same run, as in "We make wireless networks do more than they were built for." with "than they were built for." gray. Most section heads are just the claim ("Latest papers"). Nothing sits above a headline: no eyebrow, kicker or overline.

**The Mono Is Data Rule.** Red Hat Mono is for data and machine text: numbers, years, bit strings, figure labels and captions, the placeholder tag, shell commands. Headlines, body copy, buttons and navigation stay in the grotesk.

## Layout

Content sits in one centered column, at most 1360px wide, inside a fluid gutter (clamp(16px, 4vw, 56px)) under a 64px sticky header. Sections stack one section unit apart (clamp(72px, 9vw, 144px)); a section that follows another drops its top padding, so the rhythm never doubles. Inside entries, text stacks 12px apart and pills cluster 8px apart; a section head sits clamp(32px, 4vw, 56px) above its content.

Heads are asymmetric two-column grids aligned on their bottom edge. A page title on the left (1.25fr) faces its lede pushed to the right edge (1fr); a section head puts the two-tone headline left and its single action (an arrow link, or the rail's arrow buttons) right; project chapters repeat the pattern at 1.2fr / 1fr.

The archive pages are single long pages. Papers is a two-column ledger: a 120px year column whose numeral sticks under the filter bar, then entries split figure / text at 5fr / 6fr, one per row between hairlines. Projects is a run of chapters: head, a full-width 21:9 scene, then the description (clamped behind a fade until expanded) beside a details sidebar at 1.5fr / 1fr. On the home page the projects form a horizontal scroll-snap rail (tiles minmax(280px, 30%), 82% on phones) that bleeds to the viewport edge yet snaps to the content edge. Filters and jump chips live in sticky sub-bars directly under the header, on the ground at 96% with a hairline below.

Responsive behavior: most two-column layouts become one column at 860px (heads, the home hero, which also drops its logo because the header carries it, the latest-papers grid, paper entries and the year column, chapter heads); the main navigation becomes a full-screen menu at 780px; the faculty block, footer, mission intro and code card restack at 760px; chapter bodies, principles and two-column splits at 960px; person grids hold two columns from 560px down. Figures respond to their own width, not the viewport's: below 520px the placeholder tag drops under the stage, and below 480px animations shed secondary labels.

## Elevation & Depth

The system is flat. Depth comes from tone, not shadow: the page ground, a half-step darker Mist for hovers and placeholders, and the Stage tone every animation sits on. Structure comes from 1px hairlines. Shadow appears only under things that float above the page, and cinematic scenes build their own depth (fog, additive light, vignette) entirely inside their stage.

### Shadow Vocabulary
- **Toast** (`box-shadow: 0 12px 32px -10px rgb(0 0 0 / .35)`): the confirmation toast at the bottom of the screen.
- **Lightbox** (`box-shadow: 0 30px 80px -20px rgb(0 0 0 / .6)`): an enlarged photo over an 88% near-black scrim.

### Named Rules

**The Hairline Rule.** Structure is drawn with 1px rules in Hairline, never with boxes and shadows. Paper entries, press links, sidebar lists, publications, principles and footer rows are open rows between hairlines. Shadow is reserved for what floats: the toast and the lightbox.

## Shapes

Two radii and a pill. Anything that shows something (animations, photos, portraits, card media, the faculty photo, the code card) sits on a 16px stage that clips it; small media (gallery thumbnails, the code card's screenshot) use 10px. Anything you press or type into is a full pill: buttons, chips, the search field, icon buttons, the skip link, the toast. Circles are kept for area dots (9px; 8px on person cards) and the home page's strip of faces. The placeholder tag (7px) has its own small radius. Borders are 1px, Hairline for rules and Hairline Strong for control outlines; only the placeholder tag is dashed, because it marks something provisional. Inside figures, corners are small (3px at the reference width) and labels are pills.

### Named Rules

**The Stage Rule.** What you look at sits on a 16px rounded stage that clips it; what you press is a full pill. Media never floats on the page without its stage.

## Components

### Buttons
- **Character:** quiet outlined pills, so the figures stay the loudest thing on the page.
- **Shape:** full pill (999px), 36px tall, 15px side padding, 8px gap to a 15px stroked icon (1.8 stroke, round caps).
- **Default:** no fill, Hairline Strong outline, ink label at control weight.
- **Hover / Focus:** fills with Mist and darkens the outline to ink-3 over .2s; pressing nudges it down 1px; keyboard focus shows the 2px Focus Blue ring at 3px. A button that expands something rotates its chevron 180° with the house ease.
- **Icon button:** a 38px circle with the same outline and hover, holding an 18px icon (1.7 stroke): theme toggle, menu, rail arrows, close.
- **Arrow link (tertiary):** the action at the end of a section head: a label at 620 with a 35% underline that firms up on hover, and a 16px arrow that slides 3px right. Outbound press links use a diagonal arrow that slides up and to the right.

### Chips
- **Style:** pill, 36px, ground fill, Hairline Strong outline, ink label at control weight. Area chips lead with the area's dot and end with a mono count in ink-3.
- **State:** selected (a pressed filter, or the section in view for jump chips) inverts to ink with ground-colored text and a 70% count. Hover darkens the outline. A row that overflows scrolls sideways behind a 56px fade at its edge.

### Cards / Containers
- **Character:** open, not boxed. A card is media plus text on the page, never a bordered panel.
- **Corner Style:** 16px, on the media only.
- **Background:** none; media waits on Mist until it loads.
- **Shadow Strategy:** none (see Elevation & Depth).
- **Border:** none; lists use hairlines between rows instead.
- **Internal Padding:** none; text stacks 12px under the media.
- **Hover:** media eases in to 1.035× over .7s; the title takes a 2px underline, in the area color when the item has an area.

### Inputs / Fields
- **Style:** the search field is a pill (36px) on the ground with a Hairline Strong outline, a 15px search glyph inset 13px and placeholder text in ink-3; clamp(160px, 18vw, 260px) wide, full width and first in its bar on phones.
- **Focus:** the border turns Focus Blue and the 2px focus ring shows at 2px; no glow. The caret is pink-ink.
- **Error / Disabled:** none in the system. An empty search result is one plain sentence in ink-2.

### Navigation
- **Header:** sticky, 64px, the ground at 92% (96% plus a hairline once the page scrolls), The brand is the vector logo (`images/netlab-logo.svg`, 34px tall) and "NET Lab" at 750, 18px, −0.02em. BYU is named in the footer, never in the header.
- **Links:** 560, 15.5px, ink-2; hover and the current page turn ink, and the current page gets a 2px ink bar beneath (2px radius). A parent stays current for its children (Projects for Sub-protocols).
- **Mobile (780px and below):** a menu button opens a full-screen panel of large links (720, clamp(36px, 10vw, 56px)); the current link turns ink-3; focus stays inside and Escape closes it.
- **Footer:** a hairline, then three columns (brand, Explore, Contact) under uppercase list labels; links in ink-2 turn ink and underline on hover. The base row holds the copyright (which names BYU), then, pushed right, the "Pause animations" switch (a text button in ink-3 with a faint underline) and the faint π in Hairline Strong.

### Figure Stage (signature)
A paper figure come alive.
- **Stage:** 16px radius on the Stage tone, clipping its canvas; 16:10 by default, 21:9 for scenes in project chapters on desktop, 4:3 for scenes in the home rail and on phones. Scenes sit on Scene Black and paint their own background.
- **Power-on:** the first time 12% of a figure is visible, its drawing wipes in from left to right (1s, house ease) behind a 2px scan line in its area color. After that it runs only while visible and stops offscreen.
- **No per-figure controls.** Figures often sit inside links (the home rail's tiles), where a button would also follow the link. One switch in the footer, "Pause animations" / "Play animations", stops every figure and video on the site at its still frame; the choice is remembered per browser and applied before first paint (`data-motion="off"` on the root).
- **Placeholder tag:** "Suggested animation · replace me" with a small pulse glyph, 10px from the top-left: mono 11.5px in fig-ink on the stage tone at 82%, a 1px dashed border at 45%, 7px radius. It shows on every figure whose item is not marked `animation_status: final` while `show_placeholder_markers` is true in `_config.yml`. When a figure is narrower than 520px the tag drops below the stage as a plain line in ink-2, so it never covers the drawing.
- **Caption:** 14.5px in ink-2, 12px under the stage, at most 60ch.
- **Fallbacks:** a module that fails shows one centered sentence in fig-ink-2, and without script every page still reads in full. Visitors who prefer reduced motion, or who pause animations, see each animation's chosen `still` moment (key idea visible, captions showing) with no wipe.

### Animation House Style (signature)
- **Diagrams (papers):** a transparent canvas over the stage. Labels are mono; panel titles are small uppercase mono (10.5px at the 640px reference width) tracked 0.4px; text sits in fig-ink-2 or stronger. Data lines 1.6–2.2px, axes 1px, corners 3px, all scaled to the figure; margins at least 6% of the width. Two to four live captions per loop, as pills (fig-surface fill, mono 600) that pop in exactly when their event happens; the contribution's captions take the area ink with an area-colored border. Keep the top-left 250×46 (tag) clear, and read well at 360, 640 and 1200px wide. Loops run 10–16s and either close seamlessly or fade over their last and first half second; motion is calm and eased, and nothing flashes more than three times a second.
- **Scenes (projects):** a short film shot that also explains the project. Deep, theme-independent backgrounds built from layered gradients; pseudo-3D depth with fog, additive lights, slow camera drift and a vignette. The area color is the hero light, and everything else is natural (water, night, snow, sodium streetlight). At most two HUD blocks, in small mono at light colors (70–90% opacity). Layouts adapt between 21:9 and 4:3.

**The Contribution Rule.** In every animation the lab's contribution (the hidden channel, the new mechanism, the key result) is drawn in the area color, and everything else (the world, baseline systems, axes, infrastructure) is neutral figure ink. A diagram uses one logo color: its area's.

**The Power-On Rule.** A figure announces itself once, with the wipe and scan the first time it is seen, and then simply runs while visible. There are no other scroll-triggered reveals: no fade-ups, no staggered entrances.

**The Placeholder Honesty Rule.** A figure whose animation runs on sample data wears the dashed "Suggested animation · replace me" tag until its item is marked final. A tag comes off when its author marks the item final, and any that remain come off together at launch through the one site setting; never by restyling the tag or hiding it in CSS.

### Home Hero
Calm and text-first, so someone who has never heard of the lab knows what it does before anything moves. Left: the two-tone Display headline, the lede (the lab's one-paragraph description), then a solid ink pill ("See our projects", 44px tall) beside an arrow link ("Read our papers"). Right: the unaltered vector logo at clamp(200px, 22vw, 340px), still. Under both, across the full width after a hairline: the seven research areas as dot-and-name links (560, 15px, ink-2, turning area ink on hover), each opening Papers filtered to that area. Nothing in the hero animates; the figures further down carry the motion. At 860px and below it is one column and the logo is dropped, since the header already shows it.

### Area Marker
- **Dot:** a 9px circle in the area color; on person cards, one 8px dot per area under the role.
- **Label:** the dot, then the area's name at 600, 14px in the area ink. It appears in paper meta rows and the project sidebar; filter chips pair the dot with an ink label.
- **Hover:** paper titles and project tiles take a 2px underline in the area color.

### People
- **Person card:** a square portrait on a 16px stage (Mist behind it) that eases in to 1.03× on hover; the name (660, 18px), the role in ink-2, "Now at …" in ink for alumni, then the area dots. A person reached by a link anchor gets a 3px Focus Blue outline around the portrait.

## Do's and Don'ts

### Do:
- **Do** color by research area only, through `data-area`: `--area` for fills, strokes, dots and hover underlines, `--area-ink` for text.
- **Do** write headlines in two tones: the claim in ink, the continuation in ink-3 in the same run.
- **Do** put every animation, photo and portrait on a 16px rounded stage that clips it, and make every control a full pill (999px).
- **Do** separate list entries with 1px hairlines and leave the rows open.
- **Do** draw the lab's contribution in the area color and everything else in neutral figure ink, with weight (strokes of 2px and up, filled marks) and an area-ink label.
- **Do** keep the "Suggested animation · replace me" tag on every figure until its item is marked `animation_status: final`, and remove the rest at launch with `show_placeholder_markers: false`.
- **Do** move with the house ease, cubic-bezier(.16, 1, .3, 1): .2s for color and border changes, .3–.5s for chevrons, menus and expanding panels, .5–.7s for image zooms, 1s for a figure's power-on.
- **Do** give every animation a `still` moment and honor reduced motion everywhere: no wipe, no view transitions, no animated zooms, no blinking caret.
- **Do** set text inside figures in fig-ink-2 or stronger, and area text in its -ink variant.

### Don't:
- **Don't** use a logo color for decoration or for anything that is not a research area: not a page, a header, a button, a principle or a cover.
- **Don't** set text in a base logo color; each one fails AA as text in at least one theme.
- **Don't** put an eyebrow, kicker or overline above a headline. Small uppercase labels head lists (sidebar groups, footer columns) and panels inside figures, nothing else.
- **Don't** put shadows on cards, figures or rows. Shadow belongs to the toast and the lightbox.
- **Don't** set headlines, body copy, buttons or navigation in Red Hat Mono.
- **Don't** add a decorative plexus, mesh or node-network background, or go back to a bordered card stack; node-link drawings appear only when they plot real data.
- **Don't** add scroll reveals (fade-ups, staggered entrances); a figure's one-time power-on is the only reveal.
- **Don't** paint a background in a diagram (the stage supplies it), and don't put anything essential under the tag (top-left 250×46).
- **Don't** animate the home hero or fill it with traces, pulses or puzzles; it says what the lab does, plainly.
- **Don't** add pause or play buttons to individual figures; the footer switch covers the whole site.
- **Don't** recite counts in headlines and ledes ("7 projects", "23 papers", "9 students"); counts belong in filter chips and result lines.
- **Don't** go lighter than fig-ink-3 for any text inside a figure; it is the AA floor on both stages.
