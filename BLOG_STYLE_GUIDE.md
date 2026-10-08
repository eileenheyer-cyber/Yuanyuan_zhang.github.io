# Blog post style guide (Statistics section)

Use this when creating or editing any post that lives under `statistics.html`
(for example `discrete-distributions.html`, `bayes-theorem.html`, `normal-distribution.html`).
Reference posts: **Four Common Discrete Distributions** (cleanest layout) and **Normal Distribution** (diagrams).
Follow the existing design system in `style.css`. Do not add a framework, new fonts or new page-wide styles.

## 1. Principles
- **One layout for every post.** White page, 760px reading column, Inter, italic section headings. No cream backgrounds, big numerals, full-width colored panels or dark cards.
- **Visual first, but small.** Explain a concept with a small diagram where one helps. Diagrams sit inside the column at figure size, never as hero-sized graphics.
- **Plain language, short paragraphs.** Written in English, first define the idea, then give one concrete example, then say why it matters in business.
- **Left-aligned text.** No justified text (`post-justify` is not used).
- **Keep it quiet.** Few note boxes, no decorative elements, no emojis.

## 2. Page skeleton
Copy the head, header and footer from an existing post and change only title, description and content.

```html
<main id="top">
<article class="post post-italic-h2 post-small-figs">
  <a class="cs-back" href="statistics.html">← Statistics</a>
  <p class="overline">Probability</p>              <!-- group: Describing data / Probability / Inference & experiments -->
  <h1 class="post-title">Post title</h1>
  <figure class="post-cover">
    <img src="images/<slug>-cover.webp" alt="..." width="2342" height="1554">
  </figure>
  <p>Intro: what the reader will learn, link to the previous related post.</p>
  <h2>Section</h2> ... 
  <div class="post-note post-takeaway"><p class="post-note-l">Key takeaway</p><p>...</p></div>
</article>
</main>
```
- `<title>` is `Post title – Yuanyuan Zhang`; add a one-sentence `<meta name="description">`.
- Stylesheet link: `style.css?v=<version>`. When `style.css` changes, bump the version in **every** page that links it that you touched, and in `statistics.html`.
- Nav is the same on every page (`Statistics` links to `statistics.html`).

## 3. Section order
1. Intro paragraph (no heading)
2. 3 to 6 `h2` sections, in teaching order: concept → example → diagram → how to use it
3. Optional `h2` **"How to explain it to stakeholders"** (see section 5)
4. Last: the **Key takeaway** box (`post-note post-takeaway`), 2 to 3 sentences, always the final element

## 4. Components (use only these)
| Need | Markup |
|---|---|
| Normal paragraph | `<p>` |
| Bullets | `<ul class="post-points"><li><strong>Term.</strong> Explanation.</li></ul>` |
| Small table (max 3 columns, short cells) | `<div class="post-table-wrap"><table class="post-table">...` |
| Tip or warning | `<div class="post-note"><p class="post-note-l">Label</p><p>Text</p></div>` |
| Formula | `<p class="post-formula"><strong>z = (x − μ) / σ</strong><span>Legend.</span></p>` |
| Figure | `<figure class="post-fig">image or inline SVG<figcaption><span>Chart 1</span> One sentence.</figcaption></figure>` |
| Sub-heading | `<h3 class="post-h3-small">` |
| Stakeholder quote | `<div class="post-callout post-callout-s"><p class="post-callout-q">...</p></div>` |
- Number figures "Chart 1, 2, ..." in order.
- Do not put a formula inside `post-note` (its warning icon looks wrong); use `post-formula`.
- Do not add "Instead of / Say" translation tables.
- Do not add code blocks or Python snippets unless Eileen asks for them.
- Avoid long tables. If a table has more than about 4 rows or 3 columns, turn it into a diagram or bullets.

## 5. "How to explain it to stakeholders"
- Heading text is exactly **"How to explain it to stakeholders"** (IQR post: "How to explain IQR to stakeholders").
- No bullet list of tips and no extra lead-in paragraph. Go straight to one `post-callout post-callout-s` box.
- The box holds 2 to 3 short paragraphs, as a business person would say it in a meeting, in plain language, with a real business example (delivery times, fraud alerts, campaigns, support tickets) and concrete numbers.
- Put quotation marks around each paragraph; end with the business question the data answers.

## 6. Diagrams
- Preferred: **inline SVG** (`<svg viewBox=... role="img" aria-label="...">`) inside `post-fig`. Static images go in `images/<slug>/chart-N-name.svg|webp`.
- Palette (same as the covers): red `#dc452d`, yellow `#f5c548`, blue `#1d57b5`, ink `#0a0a0a`, sand `#e9e1cd`. Flat fills only: no gradients, shadows, 3D or stock illustrations.
- Labels: at least about 12px effective size on mobile. Use fewer, shorter labels rather than shrinking text.
- A diagram has to answer "what should I see to understand this?". If it only decorates, drop it.
- Never imply that the height of a density curve is a probability. Probability is area.
- Max width follows the column (`post-small-figs` limits figures to 78% on desktop, 100% on mobile).

## 7. Cover image and Statistics card
- Cover: **3:2 landscape, about 2340×1554, WebP**, named `images/<slug>-cover.webp`. Flat geometric Bauhaus style on a cream background (red, yellow, blue, black), matching the other covers. Use a native 3:2 image; other ratios get cropped on the card.
- Add a card to `statistics.html` inside the right group (`Describing data`, `Probability`, `Inference & experiments`):
```html
<a class="project-card" href="<slug>.html">
  <span class="project-card-img"><img src="images/<slug>-cover.webp" alt="..." width="..." height="..." loading="lazy"></span>
  <span class="project-card-body">
    <span class="project-type">Group name</span>
    <span class="project-title">Title</span>
    <p>One sentence (max about 20 words).</p>
  </span>
  <span class="project-card-foot"><span class="project-tags"><span>Tag</span><span>Tag</span><span>Tag</span></span><span class="project-arrow" aria-hidden="true">→</span></span>
</a>
```
- Exactly 3 tags per card. Add `?v=` to the image URL if an existing cover is replaced.

## 8. Checklist before publishing
1. Same skeleton, components and heading style as the reference posts; nothing new in `style.css` unless truly needed (scope any new rule to the post).
2. Facts and arithmetic checked (run the numbers; check examples add up).
3. Rendered on desktop (about 1280px) and phone (about 390px): no horizontal scroll, no cropped labels, figures readable.
4. HTML tags balanced; `title`, `description`, `alt` texts present.
5. Card added to `statistics.html`; cache-buster bumped where `style.css` changed.
6. Commit with a clear message and push to `main`.
