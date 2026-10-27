# Network Enhanced Technologies Lab

The Network Enhanced Technologies Lab (NET) at Brigham Young University is focused on building real
systems that enhance and extend wireless networks, Internet of Things, security, privacy, and
reliability.

This is our website, live at [netlab.byu.edu](https://netlab.byu.edu). It is a
[Jekyll](https://jekyllrb.com) site: almost everything you will want to change lives in plain text
files in `_data/`, so you can edit it right here on GitHub without installing anything.

## Editing the site

### The quick way: on GitHub, in your browser

1. Find the file in the table below and open it on GitHub.
2. Click the pencil icon (**Edit this file**) at the top right of the file.
3. Change the words. Keep the indentation and the names before each colon as they are.
4. Click **Commit changes…**. Committing to `master` publishes the change to netlab.byu.edu in a
   minute or two. To have someone look first, choose **Create a new branch** and open a pull request.
5. If the site doesn't update, open the repository's **Actions** tab: a red ✗ there names the file and
   line that has a typo (usually a missing quote or a wrong indent). Fix it the same way.

### Where everything is

| To change… | Edit |
| --- | --- |
| Any heading, intro paragraph or button label on a page (home, Projects, Papers, People, Articles, Mission, Sub-protocols, the not-found page, the footer headings) | `_data/text.yaml` |
| The paragraph under the home page headline (also the site's description in search results) | `description` in `_config.yml` |
| Papers | `_data/papers.yaml` ([details](#a-paper-_datapapersyaml)) |
| Projects: name, one-line hook, description, photos, order on the site | `_data/projects.yaml` ([details](#a-project-_dataprojectsyaml)) |
| The "In the news" stories on the home page | `press:` under the ONPC project in `_data/projects.yaml` |
| Current students | `_data/students.yaml` ([details](#a-person-_datastudentsyaml-_datapast_studentsyaml-_datafacultyyaml)) |
| Alumni and past undergraduates | `_data/past_students.yaml` |
| Faculty | `_data/faculty.yaml` |
| Articles | `_data/articles.yaml` |
| The Mission page's principles | `_data/principles.yaml` |
| Research area names | `_data/areas.yaml` |
| Sub-protocols page: people and publications | `_data/subprotocols.yaml` (its paragraphs are in `_data/text.yaml`) |
| Menu items | `_data/nav.yaml` |
| Contact email, GitHub link, department line, the easter egg's message | `_config.yml` |
| A page's browser-tab title and its description for search engines | the `title:` and `description:` lines at the top of that page's file in `pages/` |
| Photos and PDFs | upload to `images/` or `assets/` (**Add file → Upload files** on GitHub), then refer to them as `/images/name.jpg` |
| Animations | see [Animations](#animations) |

### Text file tips

- Text with a colon (`:`) or a `#` in it, or text starting with a quote mark, must be inside
  `"double quotes"`. To be safe, quote any text you type.
- Indentation is part of the format: use spaces (never tabs) and line things up the way the entries
  around them are.
- Longer paragraphs sit under a `|` and are indented. A blank line starts a new paragraph. They accept
  Markdown: `**bold**`, `*italic*` and `[link text](https://example.com)`.
- Lists of things (papers, people, projects) are entries that start with `- `. Copy a nearby entry
  and change its values.

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
Markdown `description`. `link` points to a page with more (the sub-protocols project has one); it
shows as a "See the full project" button under the project's hook.

### An article: `_data/articles.yaml`

`title`, `link`, `lead_text`, `author`, `date` and an optional `image`. Without an image the card gets
a generated cover; `cover:` sets its text.

### The sub-protocols project page

Its words are under `subprotocols:` in `_data/text.yaml`; its personnel and publications are in
`_data/subprotocols.yaml`. The layout is `pages/subprotocols.html`.

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
   clear (the tag sits there); pick a good `still` moment, because that frame is what everyone sees
   until they hover over the animation.

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
| `js/site.js` | Theme toggle, menu, filters, search, citations |
| `js/egg.js` | The easter egg (ctrl- or ⌘-click a NET Lab logo; the message is `easter_egg` in `_config.yml`) |
| `js/figures.js`, `js/anim/` | The animation loader and the animations |
| `images/netlab-logo.svg` | The logo, converted from the lab's vector original (`netlab-logo-1200.png` and `icon/` are renders of it) |
| `fonts/` | Self-hosted Schibsted Grotesk and Red Hat Mono (SIL Open Font License) |
| `scripts/make-thumbs.py` | Makes small WebP copies of photos in `images/thumbs/` (needs ffmpeg). Optional: the site falls back to the originals |

Light and dark mode follow the visitor's system setting, and the button in the header switches them.
Each animation shows its still frame until someone hovers over it (or tabs to it); then it wipes in
and plays, and it goes back to the still when they move away. On phones, which can't hover, the
animation nearest the middle of the screen plays. Visitors who prefer reduced motion only see the
still frames.
