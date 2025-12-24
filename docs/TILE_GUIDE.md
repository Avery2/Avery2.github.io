# Tile Guide

Complete guide to creating and customizing tiles for your portfolio.

## Tile Types

There are 4 types of tiles:

1. **Project** - Auto-generated from GitHub repos
2. **Link** - External links (resume, social media, etc.)
3. **Content** - Markdown content tiles (about me, announcements)
4. **Widget** - Interactive components (future: analytics, charts)

## Project Tiles (Auto-Generated)

Project tiles are automatically created from your GitHub repositories.

### Configuration

Edit `data/site-config.yml`:

```yaml
curated_repos:
  - awesome-project
  - another-project
  - third-project
```

### Auto-Generated Data

The GitHub Actions workflow fetches:

```yaml
- id: "awesome-project"
  type: "project"
  name: "awesome-project"
  title: "Awesome Project"
  description: "An awesome description"
  url: "https://github.com/username/awesome-project"
  image: "./assets/images/projects/awesome-project.jpg"
  language: "Python"
  stars: 42
  topics: ["python", "web", "automation"]
  priority: 150
  tags: ["python", "web", "automation"]
  traffic:
    views_14d: 234
    unique_visitors_14d: 89
```

### Adding Images

Add project screenshots:

```bash
assets/images/projects/awesome-project.jpg
```

**Naming rules:**
- Filename must match repo name (case-insensitive)
- Supported: `.jpg`, `.jpeg`, `.png`, `.gif`
- If no image: tile shows only content (no placeholder)

### Priority Calculation

```python
priority = (stars * 3) + (recency * 2) + has_description
```

Higher priority = appears near the top.

## Link Tiles (Manual)

Link tiles are external links you create manually.

### Basic Link Tile

```yaml
# data/manual-tiles.yml
tiles:
  - id: "resume-tile"
    type: "link"
    title: "View My Resume"
    description: "Full resume with experience and education"
    url: "https://example.com/resume.pdf"
    open_new_tab: true
    priority: 1000
    tags: ["resume", "professional"]
```

### Link Tile with Image

```yaml
tiles:
  - id: "blog-link"
    type: "link"
    title: "Visit My Blog"
    description: "Technical articles and tutorials"
    image: "./assets/images/tiles/blog-thumbnail.jpg"
    url: "https://blog.example.com"
    open_new_tab: true
    priority: 900
    tags: ["blog", "writing"]
```

### Link Tile with Icon

```yaml
tiles:
  - id: "linkedin-profile"
    type: "link"
    title: "LinkedIn Profile"
    description: "Connect with me professionally"
    icon: "fab fa-linkedin"  # Font Awesome icon
    url: "https://linkedin.com/in/username"
    open_new_tab: true
    priority: 800
    tags: ["social"]
```

### Styled Link Tile

```yaml
tiles:
  - id: "resume-tile"
    type: "link"
    title: "View My Resume"
    description: "Full resume with experience and education"
    url: "https://example.com/resume.pdf"
    open_new_tab: true
    priority: 1000
    tags: ["resume"]
    style:
      background_color: "#007bff"
      text_color: "#ffffff"
```

## Content Tiles (Manual)

Content tiles display rich markdown content.

### Basic Content Tile

```yaml
tiles:
  - id: "about-me"
    type: "content"
    title: "About Me"
    content_markdown: |
      I'm a software engineer passionate about:
      - Data visualization
      - Productivity tools
      - Web development
    priority: 950
    tags: ["about"]
```

### Content Tile with Image

```yaml
tiles:
  - id: "announcement"
    type: "content"
    title: "Latest Updates"
    image: "./assets/images/tiles/announcement.jpg"
    content_markdown: |
      ## New Projects

      I recently launched:
      - **Project A** - Description here
      - **Project B** - Another description

      [Learn more](https://example.com)
    priority: 920
    tags: ["updates"]
```

### Content Tile with Description

```yaml
tiles:
  - id: "skills"
    type: "content"
    title: "Technical Skills"
    description: "Languages, frameworks, and tools I use"
    content_markdown: |
      ### Languages
      Python, JavaScript, TypeScript, Go

      ### Frameworks
      React, Vue, Django, Flask

      ### Tools
      Git, Docker, AWS, GitHub Actions
    priority: 850
    tags: ["skills"]
    span_columns: 2  # Make it wider
```

## Widget Tiles (Future)

Widget tiles are interactive components (coming soon).

### Example: Analytics Dashboard

```yaml
tiles:
  - id: "analytics-widget"
    type: "widget"
    title: "Project Analytics"
    widget_type: "analytics-dashboard"
    priority: 1100
    tags: ["analytics"]
```

### Example: GitHub Contribution Graph

```yaml
tiles:
  - id: "contributions-widget"
    type: "widget"
    title: "GitHub Contributions"
    widget_type: "contribution-graph"
    config:
      username: "your-username"
      year: 2025
    priority: 1050
    tags: ["github"]
```

## Tile Properties

### Common Properties (All Tiles)

```yaml
id: "unique-identifier"           # Required: Unique ID
type: "project|link|content|widget"  # Required: Tile type
title: "Display Title"             # Required: Shown in tile
description: "Brief description"   # Optional: Subtitle
image: "./path/to/image.jpg"       # Optional: Tile image
priority: 1000                     # Optional: Sort order (default: 0)
tags: ["tag1", "tag2"]            # Optional: For filtering
span_columns: 1                    # Optional: Width (1-4, default: 1)
span_rows: 1                       # Optional: Height (1-4, default: 1)
style:                             # Optional: Custom styling
  background_color: "#007bff"
  text_color: "#ffffff"
```

### Link Tile Specific

```yaml
url: "https://example.com"         # Required: Link destination
open_new_tab: true                 # Optional: Open in new tab (default: false)
icon: "fab fa-github"              # Optional: Font Awesome icon
```

### Content Tile Specific

```yaml
content_markdown: |                # Required: Markdown content
  Your **markdown** content here.
```

### Project Tile Specific (Auto-Generated)

```yaml
name: "repo-name"                  # Auto: Repository name
url: "https://github.com/..."      # Auto: Repo URL
language: "Python"                 # Auto: Primary language
stars: 42                          # Auto: Star count
topics: ["topic1", "topic2"]       # Auto: GitHub topics
traffic:                           # Auto: Traffic stats (if available)
  views_14d: 234
  unique_visitors_14d: 89
```

## Tile Sizing

Control tile size with `span_columns` and `span_rows`:

```yaml
# Small tile (1x1) - default
span_columns: 1
span_rows: 1

# Wide tile (2x1)
span_columns: 2
span_rows: 1

# Tall tile (1x2)
span_columns: 1
span_rows: 2

# Large tile (2x2)
span_columns: 2
span_rows: 2
```

**Note:** In the current masonry layout, `span_rows` is not fully supported. Use `span_columns` for width.

## Styling Tiles

### Custom Background Color

```yaml
style:
  background_color: "#ff5733"
  text_color: "#ffffff"
```

### Use CSS Variables

```yaml
style:
  background_color: "var(--accent-primary)"
  text_color: "var(--text-primary)"
```

### Advanced Styling (CSS)

For more advanced styling, edit `css/tiles.css`:

```css
/* Style specific tile by ID */
.tile[data-id="resume-tile"] {
  border: 2px solid var(--accent-primary);
  box-shadow: 0 4px 8px var(--shadow-color);
}

/* Style by tag */
.tile[data-tags*="featured"] {
  border: 2px solid gold;
}
```

## Examples

### Resume Link

```yaml
- id: "resume-tile"
  type: "link"
  title: "View My Resume"
  description: "Full resume with experience and education"
  url: "https://example.com/resume.pdf"
  open_new_tab: true
  priority: 1000
  tags: ["resume", "professional"]
  style:
    background_color: "#007bff"
    text_color: "#ffffff"
```

### About Me Content

```yaml
- id: "about-me"
  type: "content"
  title: "About Me"
  description: "Software engineer and open source contributor"
  content_markdown: |
    I'm a **Product Engineer** at [Amplitude](https://amplitude.com)
    working on frontend systems.

    ### Interests
    - Data visualization
    - Productivity software
    - Web development

    ### Currently Learning
    - Rust
    - WebAssembly
    - 3D graphics
  priority: 950
  tags: ["about"]
  span_columns: 2
```

### Social Media Links

```yaml
- id: "twitter-profile"
  type: "link"
  title: "Follow me on Twitter"
  description: "Thoughts on tech and design"
  icon: "fab fa-twitter"
  url: "https://twitter.com/username"
  open_new_tab: true
  priority: 700
  tags: ["social"]

- id: "youtube-channel"
  type: "link"
  title: "YouTube Channel"
  description: "Coding tutorials and live streams"
  icon: "fab fa-youtube"
  url: "https://youtube.com/@username"
  open_new_tab: true
  priority: 690
  tags: ["social"]
  style:
    background_color: "#FF0000"
    text_color: "#ffffff"
```

### Project Showcase

```yaml
- id: "featured-project"
  type: "link"
  title: "Featured Project"
  description: "My most impressive work"
  image: "./assets/images/tiles/featured.jpg"
  url: "https://github.com/username/featured-project"
  open_new_tab: true
  priority: 1100
  tags: ["featured", "project"]
  span_columns: 2
```

### Announcement

```yaml
- id: "hiring"
  type: "content"
  title: "🎉 I'm Hiring!"
  content_markdown: |
    Looking for talented engineers to join my team.

    **Roles:**
    - Frontend Engineer
    - Backend Engineer
    - DevOps Engineer

    [Apply now](https://example.com/careers)
  priority: 1200
  tags: ["announcement"]
  style:
    background_color: "#28a745"
    text_color: "#ffffff"
```

## Best Practices

### Priority Ranges

- **1000+**: Featured content (resume, important links)
- **900-999**: About me, announcements
- **500-899**: Regular content tiles
- **100-499**: Auto-generated projects (based on stars)
- **0-99**: Low priority links

### Tags

Use tags for filtering:

```yaml
tags: ["python", "web", "featured"]
```

Tag naming:
- Lowercase
- Hyphenated for multi-word (e.g., `data-visualization`)
- Consistent with GitHub topics

### Images

**Optimal sizes:**
- Standard tile: 600x400px
- Wide tile: 1200x400px
- Profile photo: 500x500px

**Formats:**
- Use `.jpg` for photos
- Use `.png` for graphics/logos
- Use `.gif` for animations (keep < 2MB)

### Descriptions

Keep descriptions concise:
- **Good**: "Track and visualize Steam game hours"
- **Bad**: "This is a project I created to help me track my Steam game hours and visualize them in a beautiful chart with lots of features"

### Content Markdown

Use markdown features:

```markdown
# Heading 1
## Heading 2
### Heading 3

**Bold text**
*Italic text*

- Bullet list
- Another item

1. Numbered list
2. Another item

[Link text](https://example.com)

> Blockquote

\`\`\`python
# Code block
def hello():
    print("Hello!")
\`\`\`
```

## Troubleshooting

### Tile not showing?

Check:
- `id` is unique
- `type` is valid (`project`, `link`, `content`, `widget`)
- `title` is provided
- YAML syntax is correct (indentation, quotes)

### Image not loading?

Check:
- File path is correct (relative to `index.html`)
- File exists at specified path
- File extension matches (`.jpg`, `.png`, `.gif`)
- File size < 5MB

### Priority not working?

- Higher numbers = higher priority
- Check other tiles' priorities
- Ensure `priority` is a number, not a string

### Custom style not applied?

- Check CSS syntax
- Use valid CSS color values
- Test with `background_color` first
- Inspect element in browser DevTools

## Advanced

### Dynamic Content

For dynamic content, consider using the widget system (coming soon) or external embeds:

```yaml
- id: "github-stats"
  type: "content"
  title: "GitHub Stats"
  content_markdown: |
    ![GitHub Stats](https://github-readme-stats.vercel.app/api?username=yourusername)
  tags: ["stats"]
```

### Conditional Display

Tiles are always visible, but you can use tags to allow filtering:

```yaml
tags: ["draft"]  # Users can filter to hide/show draft tiles
```

### Linking Tiles

Create related tile groups with shared tags:

```yaml
# Tile 1
- id: "project-a"
  tags: ["project-group-1", "python"]

# Tile 2
- id: "project-b"
  tags: ["project-group-1", "python"]
```

Users can click the "python" tag to see all related tiles.

---

**Questions?** Check [ARCHITECTURE.md](./ARCHITECTURE.md) or [DEVELOPMENT.md](./DEVELOPMENT.md)
