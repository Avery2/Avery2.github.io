# Writing

Add writing pieces that appear as tiles on your site.

## Quick Start

**1. Create a markdown file:** `writing/your-piece.md`
```markdown
Your content here. Use **bold**, *italic*, [links](https://example.com), etc.
```

**2. Copy the HTML template:**
```bash
cp writing/harm-reduction.html writing/your-piece.html
```

Edit the new file and update:
- `<title>` tag
- `.writing-title`
- `.writing-description`
- `.writing-meta` tags
- `fetch('./your-piece.md')` reference

**3. Add to `data/manual-tiles.yml`:**
```yaml
- id: "your-piece"
  type: "link"
  title: "Your Title"
  description: "Preview text... → Read more"
  url: "./writing/your-piece.html"
  open_new_tab: false
  priority: 110
  tags: ["writing", "philosophy"]
```

Done! The tile appears in your grid.

## Priority Guide

Adjust `priority` to control tile position:
- **450+**: Top of grid (e.g., resume)
- **100-200**: Mixed with high-starred projects
- **50-100**: Mixed with medium projects
- **<50**: Bottom of grid

## Example

See `harm-reduction.md` and `harm-reduction.html` for a working example.

## Linked notes prototype

The concept-note system lives in `writing/notes/`:

- `corpus.mjs` is the editable public content model. Links use `[[slug|label]]` syntax.
- `generate-pages.mjs` creates real HTML routes so every note works without the enhanced interface.
- `notes.js` progressively enhances those routes into a spatial reading stack.
- Private concepts include public title/status metadata only. Do not add private prose to `corpus.mjs`.

After changing the corpus, run:

```bash
node writing/notes/generate-pages.mjs
```
