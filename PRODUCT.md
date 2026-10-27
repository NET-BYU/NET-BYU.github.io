# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Four audiences, all confirmed as primary (none ranked above the others):

- **Prospective students** (undergraduates, graduate applicants) deciding whether this is a lab worth joining. The work itself has to make the case; there is deliberately no "join the lab" call to action.
- **Researchers, reviewers and sponsors** (peers, program committees, NSF/DoD program managers) judging the lab's output: papers, results, credibility.
- **Industry and collaborators** looking for expertise, partners, or alumni to hire.
- **Lab members and alumni** showing off their work and their people: who is here, who went where.

## Product Purpose

The public website of the Network Enhanced Technologies (NET) Lab at Brigham Young University, led by Prof. Philip Lundrigan (Electrical and Computer Engineering), served at https://netlab.byu.edu. It presents the lab's papers, research projects, people (faculty, current students, alumni and where they went), mission, and student-written technical articles.

Success: a visitor from any of the four audiences understands what the lab builds and why it matters, and leaves impressed by the ingenuity of the work. Every paper and project is explained by a live animation of its mechanism rather than by prose alone.

## Positioning

"Building real systems that enhance and extend wireless networks, Internet of Things, security, privacy, and reliability."

What a neighboring lab could not truthfully copy:

- **Wireless sub-protocols**: new communication channels hidden inside the behavior of existing protocols, in software only, with no hardware changes. On-off noise power communication (ONPC), Wireless Latency Shift Keying, Ghost Modulation timing watermarks, Spectra, Frequency Lock Encoding (carrier-frequency-offset shifts), UnderTone (FLE on ESP32-C5 Wi-Fi chips), and SAFEC (data in the positions of deliberate, correctable FEC errors). An NSF-funded project (#2153317) builds a framework for them.
- **Real deployments in the field**: air-quality sensors in Mongolian gers, radon monitoring and HVAC-scheduled mitigation in a Utah school, a 6 GHz Wi-Fi measurement study in LaVell Edwards Stadium, underwater acoustic networks for under-ice robot swarms, commercial V2X roadside-unit testing, spectrum sharing with radio astronomy, and in-home health sensing (EpiFi, MAAV, PRISMS).

## Operating Context

- All content lives in `_data/*.yaml` (`papers`, `projects`, `students`, `past_students`, `faculty`, `articles`). Rotating students maintain the site by editing YAML ("Bryson graduated", "summer papers"); they are not web developers.
- Deploy: a push to `master` runs GitHub Actions (Ruby 3.2, `make build`) and copies `_site` to BYU's web server, live at netlab.byu.edu. The redesign is built on the `redesign` branch and reaches `master` only when Ethan merges it.
- Paper authors will replace each placeholder animation with their own before launch, so replacing one must be easy for a student.

## Capabilities and Constraints

- Stack stays Jekyll + YAML data, built by the existing CI (bundler, so custom `_plugins` are allowed). Bootstrap and jQuery are removed; styling is custom CSS and behavior is vanilla JavaScript modules.
- Pages: Home, Papers, Projects, People, Mission, Articles. The Papers page and the Projects page each remain a single long page: every entry shows its animation inline and expands for its abstract or full description.
- The Wireless Sub-Protocols NSF project site (currently a separate page, `/subprotocols/`, with its own theme and navigation) must be folded into the main site so it reads as one unified website: same navigation, same design, all of its content (about, personnel, publications, code, education and outreach, NSF #2153317 acknowledgment) preserved.
- Every paper (22) and project (7) gets a bespoke animation acting out its actual mechanism on sample data, built from one shared toolkit so they read as a family. Until its author replaces it, each is visibly marked as a suggested placeholder ("suggested animation, replace me").
- Light and dark mode. Highly animated, while honoring `prefers-reduced-motion`.
- No "join the lab" call to action. No sponsor section; funding is acknowledged inside individual project write-ups (for example the sub-protocols NSF award).
- Incumbent easter egg to preserve: the faint π on the home page opens IMDb's *Hackers* (1995) on a modifier+Shift click.

## Brand Commitments

- The NET Lab hexagon logo is used as-is, from the vector original (`images/netlab-logo.svg`).
- The site palette is built from the logo's seven trace colors, already listed in `_config.yml`: `#ED3F95` pink, `#F89938` orange, `#D8E022` yellow-green, `#00A775` green, `#89298E` purple, `#76C044` light green, `#00AEEF` cyan.
- joshuamontierth.github.io is a bar for craft, creativity and live per-topic figures, not a look to borrow.
- Standing visual preference (chosen 2026-10-27 over two rounds of themed directions): the research-lab category standard, played straight, at the craft level of MIT Media Lab (media.mit.edu) and Google DeepMind (deepmind.google). No costume worlds.
- The hero's hidden message decodes the lab tagline; a modifier-click decodes "HACK THE PLANET" (a nod to the π *Hackers* easter egg).
- Copy: factual text (abstracts, bios, project descriptions, mission principles, the Steve Jobs quote) stays word for word. New framing copy (a hero line, a plain-English one-liner per paper and project, section intros, animation captions) is allowed and gets listed for review.

## Evidence on Hand

- 22 papers with abstracts and PDFs or DOIs (`_data/papers.yaml`, `assets/*.pdf`).
- 7 projects (`_data/projects.yaml`), some with photos in `images/` (ONPC field test, Mongolian gers, under-ice stock photo, sub-protocol testbed, EpiFi architecture, Dylos sensor, spectrum plot).
- ONPC press coverage: BYU News, Engadget (with video), Ars Technica, Network World, Tom's Hardware.
- People: 1 faculty member, 9 current students, 11 past graduate students with their destinations, 18 past undergraduates; headshots in `images/`.
- 9 student-written articles (external links, `_data/articles.yaml`).
- Sub-protocols project content: description, testbed photo, personnel, 3 publications, WLSK code repository (github.com/NET-BYU/wireless-latency-shift-keying), lecture slides, IMMERSE outreach.
- Coming from Ethan: more photos (group, lab, testbeds, field deployments). Not on hand yet.
- Absent, and not to be fabricated: real data behind the animations (all of it is synthetic and marked as placeholder), a sponsor list, news items.

## Product Principles

1. Show the mechanism, don't just describe it: each paper and project is explained by its own animation.
2. Real systems in the real world: the lab builds, deploys and measures; the site should feel like evidence of that.
3. Students maintain it: adding a paper, a person or an animation stays a YAML edit plus at most one file.
4. Honest demonstrations: synthetic animations are marked as placeholders until real ones replace them.
5. Delight is on brand: the lab already hides easter eggs; play is welcome as long as the research stays legible.

## Accessibility & Inclusion

- Honor `prefers-reduced-motion`; animations pause when offscreen; all content is readable without JavaScript.
- WCAG AA text contrast in both themes. Several logo colors (`#D8E022`, `#76C044`, `#00AEEF`) fail as text on light backgrounds and need darker text variants there.
