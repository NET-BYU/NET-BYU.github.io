# Network Enhanced Technologies Lab

The Network Enhanced Technologies Lab (NET) at Brigham Young University is focused on building real
systems that enhance and extend wireless networks, Internet of Things, security, privacy, and
reliability.

This is our website, live at [netlab.byu.edu](https://netlab.byu.edu). It is a
[Jekyll](https://jekyllrb.com) site: almost everything you will want to change lives in plain YAML
files in `_data/`.

## Previewing your changes

You need Ruby 3.2 and Bundler.

```bash
bundle install
bundle exec jekyll serve        # then open http://localhost:4000
```

`make develop` does the same thing. Pushing to `master` builds the site and deploys it to
netlab.byu.edu automatically (GitHub Actions), so preview first, and use a branch for anything big.

## Adding things

### A paper: `_data/papers.yaml`

Newest first. Put the PDF in `assets/` (or link to the publisher).

```yaml
- id: my-paper              # short name: page anchor (/papers/#my-paper) and animation file name
  area: subprotocols        # research area, from _data/areas.yaml (sets the color)
  project: subprotocols     # optional: lists the paper under that project on the Projects page
  hook: "One plain-English sentence about what the paper does."
  title: "The Paper's Title"
  authors: A. Student, P. Lundrigan
  conference: "ACM International Conference on Mobile Computing and Networking (MobiCom), 2026"
  abstract: "The abstract."
  url: /assets/my-paper.pdf
```

Only `title`, `authors` and `conference` are required. The year comes from the venue line, and
authors who are lab members are linked to their entries on the People page automatically (match the
"F. Last" format).

Areas: `subprotocols`, `underwater`, `vehicles`, `spectrum`, `sensing`, `health`, `wifi`.

### A person: `_data/students.yaml`, `_data/past_students.yaml`, `_data/faculty.yaml`

Add a square headshot to `images/` (at least 480 px) and an entry:

```yaml
- first_name: Ada
  last_name: Lovelace
  degree: PhD                 # PhD, MS or Undergrad
  image: /images/lovelace.jpg
  link: https://www.linkedin.com/in/...
```

Order in the file doesn't matter: current students are shown PhD first, then master's, then
undergraduates, by last name within each. Alumni are shown newest graduation first.

When someone graduates, move their entry from `students.yaml` to `past_students.yaml`
(`graduate_students` with `graduation:` and `job:`, or `undergraduate_students` with `year:`).

### A project: `_data/projects.yaml`

Same idea, with `id`, `short` (a short name for buttons), `area`, `name`, `hook`, `images` and a
Markdown `description`. `link` points to a page with more (the sub-protocols project has one).

### An article: `_data/articles.yaml`

`title`, `link`, `lead_text`, `author`, `date` and an optional `image`. Without an image the card gets
a generated cover; `cover:` sets its text.

### The sub-protocols project page

`pages/subprotocols.html`, with its personnel and publications in `_data/subprotocols.yaml`.

## Animations

Every paper and project has an animation. The ones on the site now are **suggested placeholders** that
act out each paper with sample data, so each shows a "Suggested animation · replace me" tag. Authors:
please replace yours.

**Option 1: write your own (recommended).** Animations are small JavaScript files drawn on a canvas.

1. Your paper's animation is `js/anim/<id>.js`, where `<id>` is the paper's `id`. Edit it, or start
   over from `js/anim/_template.js`. The shared toolkit is `js/anim/kit.js` (its top comment explains
   the format).
2. Preview it on its own, in light and dark, at phone and desktop sizes:
   ```bash
   python3 -m http.server 8000      # from the repository root
   # open http://localhost:8000/dev/anim.html?id=<id>
   ```
   (Add your id to `dev/anims.json` if it is new.)
3. Keep to the house style: draw your contribution in your area's color (`api.accent`) and everything
   else in neutral ink; keep labels short; make it work at 360 px wide; leave the top-left corner
   clear (the tag sits there); pick a `still` moment for visitors who prefer reduced motion or
   pause animations.

**Option 2: use a video, image or embed** by adding one of these to the paper's YAML entry instead:

```yaml
  animation_video: /assets/anim/my-paper.mp4     # muted, looping; MP4 or WebM
  animation_image: /assets/anim/my-paper.gif     # GIF, SVG, PNG or WebP
  animation_embed: https://example.com/figure    # an iframe
```

Then, in the YAML entry:

```yaml
  animation_caption: "What the visitor is watching, in one sentence."
  animation_status: final      # removes the "replace me" tag
```

To hide every remaining tag at once (for launch), set `show_placeholder_markers: false` in
`_config.yml`.

## How the site is put together

| Path | What it is |
| --- | --- |
| `_data/` | All content (papers, projects, people, articles, areas, navigation, principles) |
| `pages/` | One file per page; `404.html` is the not-found page |
| `_layouts/`, `_includes/` | The page shell, header, footer, figure slot, paper and person entries |
| `_plugins/netlab.rb` | Build-time helper: years, anchors, citations, author links, thumbnails |
| `css/site.css` | All styles. Colors are tokens at the top (light and dark) |
| `js/site.js` | Theme toggle, animation switch, menu, filters, search, citations |
| `js/figures.js`, `js/anim/` | The animation loader and the animations |
| `images/netlab-logo.svg` | The logo, converted from the lab's vector original (`netlab-logo-1200.png` and `icon/` are renders of it) |
| `fonts/` | Self-hosted Schibsted Grotesk and Red Hat Mono (SIL Open Font License) |
| `scripts/make-thumbs.py` | Makes small WebP copies of photos in `images/thumbs/` (needs ffmpeg). Optional: the site falls back to the originals |

Light and dark mode follow the visitor's system setting, and the button in the header switches them.
Animations pause when they are off screen. Visitors who prefer reduced motion, or who click "Pause animations" in
the footer (remembered per browser), see a still frame of each one.
