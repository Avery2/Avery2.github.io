# Forking Guide

Want to create your own portfolio using this template? Great! This guide will walk you through the process.

## Quick Start (5 minutes)

1. **Fork this repository**
   - Click "Fork" at the top right of this page
   - Choose your GitHub account as the destination

2. **Update your information**
   - Edit `data/site-config.yml` with your details (name, email, GitHub username, etc.)
   - Update `data/manual-tiles.yml` with your custom tiles (resume link, etc.)

3. **Add your images**
   - Replace `assets/images/profile/face.jpg` with your photo
   - Add project screenshots to `assets/images/projects/` (named `{repo-name}.jpg`)

4. **Enable GitHub Actions**
   - Go to Settings → Actions → General
   - Enable "Read and write permissions" for workflows

5. **Enable GitHub Pages**
   - Go to Settings → Pages
   - Source: Deploy from a branch
   - Branch: `main` (root)
   - Click Save

6. **Done!**
   - Your site will be live at `https://{your-username}.github.io/`
   - GitHub Actions will auto-update your projects weekly

## Detailed Setup

### 1. Fork the Repository

```bash
# Via GitHub UI (recommended)
# Click "Fork" button at top right

# Or via GitHub CLI
gh repo fork Avery2/Avery2.github.io --clone=true
```

### 2. Configure Your Site

Edit `data/site-config.yml`:

```yaml
site:
  title: "YourName"
  description: "Your tagline here!"
  domain: "your-username.github.io"
  repository: "your-username/your-username.github.io"

author:
  name: "Your Full Name"
  email: "your.email@example.com"
  profile_image: "./assets/images/profile/face.jpg"
  resume_url: "https://your-site.com/resume.pdf"
  github: "your-username"
  linkedin: "your-linkedin"

# List only the repos you want to showcase
curated_repos:
  - your-username.github.io
  - awesome-project-1
  - awesome-project-2
  # Add more repos here

# Manually mark repos as featured (orange border)
featured_repos:
  - your-username.github.io
  - awesome-project-1

# Optional: Auto-extract experience/education from resume HTML
# Set to 'DISABLED' or remove to disable this feature
resume_source_url: "https://github.com/your-username/your-resume-repo/blob/main/resume.html"
```

**Resume Integration (Optional):**

The `resume_source_url` field enables automatic extraction of experience and education from a public resume HTML file:

- Script fetches the HTML and parses `<section class="experience">` and `<section class="education">`
- Generates tiles for each job and degree that appear on your main page
- Creates individual detail pages at `/writing/experience/{company}.html` and `/writing/education/{school}.html`
- To disable: set `resume_source_url: 'DISABLED'` or remove the field entirely
- See `.github/scripts/fetch-resume-data.py` for parsing details

### 3. Add Your Images

**Profile Photo:**
```bash
# Replace this file with your photo
assets/images/profile/face.jpg
```

**Project Screenshots:**
```bash
# Add images named after your repos
assets/images/projects/awesome-project-1.jpg
assets/images/projects/awesome-project-2.png
assets/images/projects/another-project.gif
```

**Supported formats:** `.jpg`, `.jpeg`, `.png`, `.gif`

**Image naming:**
- Filename must match repo name exactly (case-insensitive)
- Example: Repo `Steam-Hours` → `steam-hours.jpg` or `Steam-Hours.png`

### 4. Customize Manual Tiles

Edit `data/manual-tiles.yml`:

```yaml
tiles:
  # Resume link
  - id: "resume-tile"
    type: "link"
    title: "View My Resume"
    description: "Full resume with experience and education"
    url: "https://your-site.com/resume.pdf"
    open_new_tab: true
    priority: 1000
    tags: ["resume", "professional"]
    style:
      background_color: "#007bff"
      text_color: "#ffffff"

  # Add more custom tiles here
  # See docs/TILE_GUIDE.md for examples
```

### 5. Enable GitHub Actions

**Option A: Via GitHub UI**
1. Go to Settings → Actions → General
2. Workflow permissions: Select "Read and write permissions"
3. Check "Allow GitHub Actions to create and approve pull requests"
4. Click Save

**Option B: First Push Will Prompt**
- Push your changes
- GitHub will ask to enable Actions
- Click "I understand, enable Actions"

### 6. Enable GitHub Pages

1. Go to Settings → Pages
2. Source: "Deploy from a branch"
3. Branch: `main` / `(root)`
4. Click "Save"
5. Your site will be live in ~1 minute

### 7. Set Up Custom Domain (Optional)

If you want to use a custom domain like `yourname.com`:

1. **Update CNAME file:**
   ```bash
   echo "yourname.com" > CNAME
   git add CNAME
   git commit -m "Add custom domain"
   git push
   ```

2. **Configure DNS (with your domain provider):**
   ```
   Type    Name    Value
   A       @       185.199.108.153
   A       @       185.199.109.153
   A       @       185.199.110.153
   A       @       185.199.111.153
   CNAME   www     your-username.github.io
   ```

3. **Enable HTTPS:**
   - Go to Settings → Pages
   - Check "Enforce HTTPS"

4. **Update site config:**
   ```yaml
   site:
     domain: "yourname.com"
   ```

## Customization

### Change Color Theme

Edit `css/themes.css`:

```css
:root {
  --accent-primary: #007bff;  /* Change to your brand color */
}
```

### Add More Filters

Edit `data/filter-groups.yml`:

```yaml
filters:
  - id: "tags"
    options:
      - value: "python"
        label: "Python"
        color: "#3776ab"
      - value: "your-tag"
        label: "Your Tag"
        color: "#ff0000"
```

### Modify Grid Layout

Edit `css/grid.css`:

```css
/* Change number of columns */
.grid-container {
  column-count: 4;  /* Desktop: 4 columns */
}

@media (max-width: 900px) {
  .grid-container {
    column-count: 2;  /* Tablet: 2 columns */
  }
}
```

## Maintenance

### GitHub Actions Workflow

The site auto-updates weekly (Sundays at 00:00 UTC). To manually trigger:

1. Go to Actions tab
2. Select "Generate Project Metadata"
3. Click "Run workflow"
4. Select branch: `main`
5. Click "Run workflow"

### Update Project Data

**Automatic** (recommended):
- GitHub Actions runs weekly
- Fetches latest repo data from API
- Updates `data/github-projects.yml`
- Rebuilds site automatically

**Manual:**
```bash
# Set up environment
cp .env.example .env
# Edit .env with your GitHub token

# Run script locally
cd .github/scripts/
pip install -r requirements.txt
python fetch-github-data.py

# Commit changes
git add ../../data/github-projects.yml
git commit -m "Update project metadata"
git push
```

### Add New Project

1. Create the repo on GitHub
2. Add repo name to `curated_repos` in `data/site-config.yml`
3. Add project screenshot to `assets/images/projects/{repo-name}.jpg`
4. Wait for weekly update OR manually trigger Actions workflow

## Troubleshooting

### Site not deploying?

**Check GitHub Pages settings:**
- Settings → Pages → Source should be "main" branch
- Wait 1-2 minutes after enabling

**Check Actions:**
- Go to Actions tab
- Look for failed workflows (red X)
- Click to see error details

### Projects not showing?

**Check curated_repos list:**
- Repo names must match exactly
- Case-sensitive
- Include your username if needed: `username/repo-name`

**Check GitHub Actions:**
- Workflow should run weekly
- Check Actions tab for errors
- Manually trigger workflow to force update

### Images not showing?

**Check file paths:**
- Profile: `assets/images/profile/face.jpg`
- Projects: `assets/images/projects/{repo-name}.jpg`

**Check file names:**
- Filename must match repo name exactly
- Supported: `.jpg`, `.jpeg`, `.png`, `.gif`

### Filters not working?

**Check browser console:**
- Open DevTools (F12)
- Look for JavaScript errors

**Check YAML syntax:**
- Validate files at https://www.yamllint.com/
- Common issues: incorrect indentation, missing quotes

## FAQ

### Can I use this without GitHub Pages?

Yes! This is a static site. You can host on:
- Netlify
- Vercel
- Cloudflare Pages
- Any static host

Just copy the files and deploy. You'll need to manually run the Python script or set up your own automation.

### Can I customize the design?

Absolutely! All CSS is in `css/` folder. No build system - just edit and refresh.

### Can I add a blog?

Not yet, but it's planned! Check the roadmap in `docs/ARCHITECTURE.md`.

### How do I remove a project?

Remove it from `curated_repos` in `data/site-config.yml`. It will disappear on the next metadata update.

### How do I change the theme (light/dark)?

The theme is controlled by CSS custom properties in `css/themes.css`. You can:
1. Edit the existing light/dark themes
2. Add new themes (e.g., `[data-theme="blue"]`)
3. Change the default theme in `index.html` (`data-theme="light"`)

### How often does the data update?

By default, weekly (Sundays at 00:00 UTC). You can change this in `.github/workflows/generate-metadata.yml`:

```yaml
schedule:
  - cron: '0 0 * * 0'  # Change to your preference
```

Cron syntax: https://crontab.guru/

## Getting Help

- **Issues with the template?** Open an issue on the original repo
- **Questions?** Check `docs/DEVELOPMENT.md` and `docs/ARCHITECTURE.md`
- **Found a bug?** Please report it!

## License

This template is open source. Fork it, customize it, make it yours!

---

**Happy forking!** 🚀
