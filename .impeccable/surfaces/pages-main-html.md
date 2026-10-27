---
version: 1
slug: "pages-main-html"
primary_target: "pages/main.html"
related_targets: ["pages/papers.html","pages/projects.html","pages/people.html","pages/subprotocols.html"]
---

# NET Lab site: surface brief

Scope: the whole site (Home, Papers, Projects, People, Mission, Articles, Sub-protocols, 404). Visitor mode: Experience (the research leads from the first viewport). Build path: code-led (no image generation available).

Audience and job: prospective students, researchers and sponsors, industry, lab members and alumni; all of them should understand what the lab builds and be impressed by it. No join CTA, no sponsor section.

Constraints: Jekyll + YAML; Papers and Projects are single long pages; one bespoke animation per paper (23, technical diagrams) and per project (7, cinematic scenes), each marked "Suggested animation · replace me" until its author replaces it; light and dark; reduced motion honored.

## Direction contract

THESIS: The research-lab category standard played straight at MIT Media Lab and Google DeepMind polish: a neutral, motion-led site where the work itself leads. It refuses the incumbent Bootstrap card stack and the plexus/mesh background every networking lab ships.

OWN-WORLD: Near-white and near-black grounds; two-tone headlines (ink, then gray) in a self-hosted grotesk; the logo's seven colors appear only as research-area colors (figures, area dots, filter chips, hero traces); rounded media stages; hairline rules; mono only for figure data and readouts.

STORY: Visitors watch the lab's hidden-channel idea work in the first screen, scan seven projects and 23 papers each explained by a live animation, meet the people and where they went, and leave believing this lab builds clever, real systems.

FIRST VIEWPORT: Full-height hero. The unaltered hex logo sits centered in the upper half; its seven traces run out to the viewport edges carrying pulses; the cursor or a tap acts as a receiver that decodes a hidden tagline into a mono readout under the logo (modifier-click decodes HACK THE PLANET). A large two-tone headline sits bottom-left, the lab description bottom-right, the nav on top. No CTA button.

FORM: Category standard (canon), chosen by the user after two rolled hands; craft bar MIT Media Lab + Google DeepMind. seed:675c267ec3aca517

Signature interaction: the hero decode. Motion grammar: exponential ease-out (cubic-bezier(.16,1,.3,1)); each figure powers on with a clip-path wipe in its area color the first time it enters view, then animates only while visible; view transitions between pages; no generic scroll reveals.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved

- Current sub-protocols personnel are inferred from authorship (Montierth, Sorensen, Young) and need Ethan's confirmation.
- Photos from Ethan are pending; layouts must look complete without them.
