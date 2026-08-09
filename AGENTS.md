# Portfolio repository instructions

This repository owns Avery's portfolio homepage, project/resume presentation, custom domain, and final GitHub Pages deployment.

## Writing boundary

- `Avery2/writing` owns writing Markdown, YAML metadata, graph validation, templates, and the linked-note engine.
- This repository must not become the source of truth for prose or duplicate the writing compiler.
- The `Avery2/writing` GitHub Pages project site directly owns the `/writing/` URL prefix.
- The writing repository owns Markdown and generated pages for `/writing/experience/` and `/writing/education/`. This portfolio only extracts résumé metadata for homepage tiles and links to those stable routes.
- This repository owns GitHub project fetching, cleaned README HTML, `/projects/` routes, and `data/projects.generated.mjs`. Project pages use the writing repository’s shared stack runtime as a project sub-renderer; preserve complete static fallback HTML.
- Homepage writing cards in `data/manual-tiles.yml` are deliberately curated by hand. A public note is not automatically a portfolio feature.
- Preserve legacy `/writing/harm-reduction.html`; the writing build emits its redirect.

When changing the visual relationship between the sites, update the small token contract in the writing repository rather than importing the portfolio's entire CSS runtime.
