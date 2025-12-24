# Development Guide

This guide explains how to develop and test the portfolio website locally.

## Prerequisites

- **Python 3.11+** (for the GitHub metadata script)
- **Web browser** (Chrome, Firefox, or Safari)
- **Local web server** (Python `http.server` or `npx serve`)
- **GitHub Personal Access Token** (for local testing of the Python script)

## Quick Start

### 1. Install Python Dependencies

```bash
cd .github/scripts/
pip install -r requirements.txt
```

### 2. Set Up Environment Variables

Create a `.env` file in the repository root:

```bash
# Copy the example file
cp .env.example .env

# Edit .env with your values
# (Use your favorite editor)
```

**Edit `.env` file:**
```bash
GITHUB_TOKEN=ghp_your_actual_token_here
GITHUB_REPOSITORY_OWNER=Avery2
```

**Creating a GitHub Token:**
1. Go to https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Give it a name (e.g., "Portfolio Local Testing")
4. Select scopes: `repo` (Full control of private repositories)
5. Click "Generate token"
6. Copy the token and paste it into your `.env` file

**Note:** The `.env` file is in `.gitignore` - it will never be committed!

### 3. Generate Metadata Locally (Optional)

To test the GitHub data fetching script:

```bash
cd .github/scripts/
python fetch-github-data.py
```

This will:
- Fetch all your repositories from GitHub
- Generate `data/github-projects.yml`
- Detect images in `assets/images/projects/`
- Calculate priorities based on stars and recency

### 4. Start Local Web Server

From the repository root:

```bash
# Option 1: Python (built-in)
python -m http.server 8000

# Option 2: Node.js (if you have npx)
npx serve .

# Option 3: PHP (if you have PHP)
php -S localhost:8000
```

### 5. Open in Browser

```
http://localhost:8000
```

You should see your portfolio website with all tiles loaded!

---

## Development Workflow

### Making Changes

#### Update Site Configuration
Edit `data/site-config.yml` and refresh the browser.

#### Update Manual Tiles
Edit `data/manual-tiles.yml` to add custom tiles (resume, about, etc.), then refresh.

#### Update Styles
1. Edit CSS files in `css/`
2. Hard-refresh browser: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows/Linux)

#### Update JavaScript
1. Edit JS files in `js/`
2. Hard-refresh browser to clear cache

#### Update Filter Configuration
Edit `data/filter-groups.yml` to change filter options, then refresh.

### Testing Checklist

Before committing changes, verify:

- [ ] **Python script runs without errors**
  ```bash
  python .github/scripts/fetch-github-data.py
  ```

- [ ] **`data/github-projects.yml` generated correctly**
  ```bash
  cat data/github-projects.yml | head -50
  ```

- [ ] **All images linked properly**
  - Check browser console (F12) for 404 errors
  - Verify images in `assets/images/projects/` match repo names

- [ ] **Website loads in browser**
  - No errors in console
  - All tiles render correctly

- [ ] **Filtering works**
  - Language filters toggle correctly
  - Category filters work
  - Search finds correct projects
  - Sort options change order

- [ ] **Theme toggle works**
  - Click theme button cycles: Light → Dark → Auto
  - Preference persists after refresh

- [ ] **Responsive design works**
  - Resize browser window
  - Check mobile view (toggle device toolbar in DevTools)
  - Verify 1 column on mobile, 2-4 on desktop

---

## Deployment

### Option 1: Automatic (on main push)

Push to `main` branch → GitHub Actions runs automatically:

```bash
git add .
git commit -m "Your commit message"
git push origin main
```

GitHub Actions will:
1. Run `generate-metadata.yml` (fetches latest GitHub data)
2. Run `deploy.yml` (deploys to GitHub Pages)

### Option 2: Manual Trigger

1. Go to GitHub Actions tab: https://github.com/Avery2/Avery2.github.io/actions
2. Select "Generate Project Metadata" workflow
3. Click "Run workflow"
4. Select branch (usually `main`)
5. Click "Run workflow"

This is useful for testing on a feature branch before merging.

### Option 3: Scheduled

The workflow runs automatically **every Sunday at 00:00 UTC**.

No action needed - your GitHub projects data stays fresh!

---

## Troubleshooting

### "No GITHUB_TOKEN" Error

**Problem:** Script fails with "GITHUB_TOKEN environment variable not set"

**Solution:**
1. Make sure `.env` file exists in repository root:
   ```bash
   ls -la .env
   ```
2. Check `.env` file has your token:
   ```bash
   cat .env  # Should show GITHUB_TOKEN=ghp_...
   ```
3. If `.env` doesn't exist, copy from example:
   ```bash
   cp .env.example .env
   # Then edit .env with your token
   ```
4. Create token if you don't have one: https://github.com/settings/tokens

### Images Not Showing

**Problem:** Tiles show placeholder instead of project images

**Solution:**
1. Check filename matches repo name exactly:
   ```
   assets/images/projects/steam-hours.jpg  ✓
   assets/images/projects/Steam-Hours.jpg  ✗ (wrong case)
   ```
2. Verify image path in `data/github-projects.yml`:
   ```yaml
   image: "./assets/images/projects/steam-hours.jpg"
   ```
3. Try hard refresh: `Cmd+Shift+R`

### YAML Parse Error

**Problem:** Website shows error or tiles don't load

**Solution:**
1. Validate YAML syntax:
   ```bash
   python -c "import yaml; yaml.safe_load(open('data/github-projects.yml'))"
   ```
2. Check for special characters in descriptions
3. Ensure consistent indentation (2 spaces)

### Tiles Not Rendering

**Problem:** Grid shows loading spinner forever or no tiles appear

**Solution:**
1. Check browser console for errors: `F12` → Console tab
2. Verify YAML files loaded correctly:
   - Open Network tab (F12)
   - Refresh page
   - Check for 404 errors on `.yml` files
3. Check YAML file syntax (see above)
4. Verify file paths are correct (relative to repo root)

### Python Script Errors

**Problem:** Script fails or produces incorrect output

**Solution:**
1. Check Python version:
   ```bash
   python --version  # Should be 3.11+
   ```
2. Reinstall dependencies:
   ```bash
   pip install -r .github/scripts/requirements.txt --upgrade
   ```
3. Verify token has `repo` scope
4. Check rate limits:
   ```bash
   curl -H "Authorization: Bearer $GITHUB_TOKEN" \
        https://api.github.com/rate_limit
   ```

### GitHub Actions Failures

**Problem:** Workflow fails in GitHub Actions

**Solution:**
1. Check workflow run logs:
   - Go to Actions tab
   - Click on failed run
   - Read error messages
2. Common issues:
   - Permissions: Ensure `contents: write` in workflow
   - Token expiration: `GITHUB_TOKEN` is auto-renewed
   - Python errors: Check script syntax
3. Test locally first before pushing

---

## Local Testing vs GitHub Actions

| Aspect | Local | GitHub Actions |
|--------|-------|----------------|
| **Token** | Personal Access Token (PAT) | `GITHUB_TOKEN` (automatic) |
| **Owner** | Manual `export` | Auto from `GITHUB_REPOSITORY_OWNER` |
| **Commit** | Manual (`git add`, `git commit`) | Automatic (bot commits) |
| **Permissions** | Your personal account | Repo/fork owner's account |
| **Speed** | Instant feedback | ~1-2 min workflow time |

**When to use local:**
- Quick testing before committing
- Debugging script issues
- Validating YAML output
- Experimenting with changes

**When to use GitHub Actions:**
- Production deployments
- Scheduled updates
- Testing fork behavior
- Automated workflows

---

## Development Tips

### Fast Iteration

1. **Use browser DevTools:**
   - `Cmd+Option+I` (Mac) or `F12` (Windows/Linux)
   - Use "Toggle Device Toolbar" for responsive testing
   - Console shows errors immediately

2. **Live Server Extension:**
   - Install VS Code "Live Server" extension
   - Right-click `index.html` → "Open with Live Server"
   - Auto-refreshes on file save

3. **Hard Refresh:**
   - Clear cache: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows/Linux)
   - Or open DevTools → right-click refresh → "Empty Cache and Hard Reload"

### Code Quality

- **JavaScript:** Use browser console for debugging
- **CSS:** Use DevTools to inspect styles in real-time
- **YAML:** Validate before committing
- **Python:** Run script locally before pushing

### Git Workflow

```bash
# Create feature branch
git checkout -b feature/my-changes

# Make changes and test locally
# ...

# Commit changes
git add .
git commit -m "Description of changes"

# Push to GitHub
git push origin feature/my-changes

# Test on GitHub Actions (manual trigger)
# Go to Actions → Run workflow on feature branch

# Merge when ready
git checkout main
git merge feature/my-changes
git push origin main
```

---

## Next Steps

Once local development is working:

1. **Customize your site:**
   - Update `data/site-config.yml` with your info
   - Add project images to `assets/images/projects/`
   - Create custom tiles in `data/manual-tiles.yml`

2. **Test thoroughly:**
   - Check all features work
   - Test responsive design
   - Verify cross-browser compatibility

3. **Deploy:**
   - Push to `main` branch
   - Verify GitHub Pages deployment
   - Check live site at your custom domain

---

## Additional Resources

- **Plan Document:** `/Users/averychan/.claude/plans/sharded-dreaming-rossum.md`
- **GitHub API Docs:** https://docs.github.com/en/rest
- **GitHub Actions Docs:** https://docs.github.com/en/actions
- **YAML Syntax:** https://yaml.org/spec/1.2/spec.html

---

**Happy coding!** 🚀
