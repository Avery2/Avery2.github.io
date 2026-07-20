<h1 align="center">Personal Website</h1>

<div align="center">
  <a href="https://www.averychan.site"><img alt="Website" src="https://img.shields.io/website?down_color=lightgrey&down_message=offline&label=averychan.site&up_color=green&up_message=online&url=https%3A%2F%2Fwww.averychan.site"/></a>
  <a href="https://avery2.github.io"><img alt="Website" src="https://img.shields.io/website?down_color=lightgrey&down_message=offline&label=avery2.github.io&up_color=green&up_message=online&url=https%3A%2F%2Favery2.github.io"/></a>
</div><br/>

A modern, automated personal website built with vanilla HTML, CSS, and JavaScript. Features automatic GitHub project integration, resume data extraction, and a responsive masonry grid layout.

**Visit:** https://www.averychan.site

## ✨ Features

- 🎨 **No Framework** - Pure HTML/CSS/JavaScript, no build step required
- 🔄 **Auto-sync GitHub Projects** - Automatically fetches and displays your repositories
- 📄 **Resume Integration** - Extracts experience and education from your resume HTML
- 🎯 **Masonry Grid Layout** - True CSS masonry with responsive columns
- 🌓 **Dark/Light Theme** - Auto-detects system preference with manual override
- 🔍 **Search & Filter** - Filter projects by language, tags, and text search
- 🚀 **GitHub Actions** - Automated metadata generation and deployment

## 🚀 Quick Start

Visit [docs/FORKING.md](./docs/FORKING.md) for detailed setup instructions.

```bash
# 1. Fork this repository
# 2. Edit data/site-config.yml with your info
# 3. Enable GitHub Actions and Pages
# 4. Done! Your site is live
```

## 🌐 Domain & Uptime

- **Domain:** `averychan.site` is registered and DNS-managed at **[Name.com](https://www.name.com)**. If the site goes offline, check the DNS records there first — the custom domain (`www` CNAME → `avery2.github.io`, apex `A` records → `185.199.108–111.153`) can get reset to a registrar parking IP after a renewal.
- **Uptime alert:** [`.github/workflows/uptime.yml`](./.github/workflows/uptime.yml) pings `https://www.averychan.site` every 6 hours. If it's down, the job fails and GitHub automatically emails the repo owner (its built-in workflow-failure notification — no secrets or email config required).

## 📚 Documentation

- [Forking Guide](./docs/FORKING.md) - How to make this your own
- [Architecture](./docs/ARCHITECTURE.md) - How the system works
- [Tile Guide](./docs/TILE_GUIDE.md) - Creating custom tiles
- [Development](./docs/DEVELOPMENT.md) - Local development setup
