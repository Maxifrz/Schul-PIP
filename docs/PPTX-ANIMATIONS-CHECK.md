# Checking the PowerPoint transitions and animations

The exporter writes slide transitions (`p:transition`) and click-by-click animations (`p:timing`) by hand. They are
checked for being well-formed XML, unique ids and existing target shapes, and LibreOffice reads them back as the
intended effects (see below), but **nobody has played them in PowerPoint or Keynote yet**. This is how to do that.

## The file

`docs/pptx-animation-check.pptx` has six slides; each slide's speaker notes say what should happen.

| Slide | Transition | Animations |
|---|---|---|
| 1 | Zoom, 0.6 s | the title fades in by itself (no click) |
| 2 | Fade | three clicks, each fades in one card with its content |
| 3 | Push from the right | ten clicks, one effect each: appear, fade, fly in from left, right, top, bottom, zoom, wipe from left, right, top |
| 4 | Push from the right | all elements fly in one after another without a click (first delay 0, last at most 1.4 s) |
| 5 | Cover from the left, 0.8 s | none |
| 6 | none | none (control: everything is there at once) |

## Steps (PowerPoint, about 5 minutes)

1. Open the file. If PowerPoint offers to repair it, stop and note which slide: the problem is in
   `ppt/slides/slideN.xml` of that slide (rename the file to `.zip` to look inside).
2. Open the **Transitions** tab: slides 1, 2, 3, 4 and 5 should show Zoom, Fade, Push, Push and Cover; slide 6 none.
3. Open the **Animations** tab with the **Animation Pane** and select slide 3: ten entrance effects, all "On Click".
   Slide 2 shows three "On Click" groups with the card, its badge and its texts "With Previous". Slide 4 shows only
   "With Previous" effects with growing delays.
4. Play from slide 1 (F5) and go through it with clicks. Compare with the table.
5. Look at the **directions** in particular: on slide 3 the "Push" should bring the slide in from the right and on
   slide 5 "Cover" from the left. In the Transitions tab, **Effect Options** shows what PowerPoint thinks.

## What to report

The file was written with one assumption that outside checks could not settle: the meaning of `dir` in `p:push` and
`p:cover`. LibreOffice reads `dir="l"` as "from the left", `"r"` from the right, `"d"` from the top, `"u"` from the bottom,
and the file is written that way. If PowerPoint shows the opposite (say, Push "From Left" where the file means from
the right), the one table to change is the `switch` in `PptxMotion.transition(_:)`; the test
`testTransitionDirectionsAreWrittenAsMapped` documents it.

Entrance effects use PowerPoint's own preset ids (1 appear, 10 fade, 2 fly in, 22 wipe, 53 zoom). Fly-in states its start
and end positions explicitly, so its direction does not depend on any convention.

## What was checked without PowerPoint

- Every XML part of the file parses (`OfficeXML.parse`), cTn ids are unique per slide, every animation target is a shape
  on the slide (tests: `MotionTests`, `ComponentExportTests`).
- python-pptx opens the file.
- LibreOffice imports it and recognises the effects: entrance appear, fade, fly in, wipe and fade-in-and-zoom, the click and
  with-previous nodes, and the transitions zoom, fade, push (with the four directions) and cover. This shows that a
  second implementation of the format reads the file as intended; it does not show that PowerPoint does.

## Keynote and Google Slides

Keynote and Google Slides import only part of PowerPoint's animations; a difference there is not necessarily a bug in
the file.
