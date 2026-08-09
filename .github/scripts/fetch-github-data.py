#!/usr/bin/env python3
"""
Fetch GitHub Repository Metadata Script

This script fetches repository data from GitHub API and generates a YAML file.
It's fork-friendly: uses GITHUB_TOKEN which is automatically scoped to fork owner.

Usage:
    Local: python fetch-github-data.py
    GitHub Actions: Runs automatically
"""

import os
import re
import sys
import requests
import yaml
from datetime import datetime, timezone
from string import Template
from typing import List, Dict, Any, Optional, Tuple
from pathlib import Path
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup

# Load .env file if it exists (for local development)
try:
    from dotenv import load_dotenv
    env_path = Path(__file__).parent.parent.parent / '.env'
    if env_path.exists():
        load_dotenv(env_path)
        print(f"Loaded environment from: {env_path}")
except ImportError:
    # python-dotenv not installed (might be in CI)
    pass

# Configuration
GITHUB_TOKEN = os.environ.get('GITHUB_TOKEN')
if not GITHUB_TOKEN:
    print("ERROR: GITHUB_TOKEN environment variable not set")
    print("Create a token at: https://github.com/settings/tokens")
    sys.exit(1)

HEADERS = {
    'Authorization': f'Bearer {GITHUB_TOKEN}',
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
}

# Get repository owner (auto-detects for forks)
REPO_OWNER = os.environ.get('GITHUB_REPOSITORY_OWNER')
if not REPO_OWNER:
    # Fallback: parse from GITHUB_REPOSITORY (format: owner/repo)
    repo_full = os.environ.get('GITHUB_REPOSITORY', '')
    REPO_OWNER = repo_full.split('/')[0] if '/' in repo_full else None

if not REPO_OWNER:
    print("ERROR: Cannot determine repository owner")
    print("Please set GITHUB_REPOSITORY_OWNER environment variable")
    sys.exit(1)

# Detect if running in GitHub Actions
IS_GITHUB_ACTIONS = os.environ.get('GITHUB_ACTIONS') == 'true'

print(f"{'='*50}")
print(f"GitHub Repository Metadata Generator")
print(f"{'='*50}")
print(f"Owner: {REPO_OWNER}")
print(f"Mode: {'GitHub Actions' if IS_GITHUB_ACTIONS else 'Local'}")
print(f"{'='*50}\n")


def fetch_repos() -> List[Dict[str, Any]]:
    """Fetch all repositories for the user."""
    url = f'https://api.github.com/users/{REPO_OWNER}/repos'
    params = {
        'per_page': 100,
        'type': 'owner',  # Only repos owned by user (not forks)
        'sort': 'updated',
        'direction': 'desc'
    }

    repos = []
    page = 1

    while True:
        params['page'] = page
        print(f"Fetching page {page}...")
        response = requests.get(url, headers=HEADERS, params=params)

        if response.status_code != 200:
            print(f"ERROR: API request failed with status {response.status_code}")
            print(f"Response: {response.text}")
            break

        page_repos = response.json()
        if not page_repos:
            break

        repos.extend(page_repos)
        page += 1

        # Rate limit check
        remaining = int(response.headers.get('X-RateLimit-Remaining', 0))
        if remaining < 10:
            print(f"WARNING: Only {remaining} API calls remaining")

    print(f"Fetched {len(repos)} repositories\n")
    return repos


def calculate_priority(repo: Dict[str, Any]) -> int:
    """
    Calculate display priority based on stars, recency, and description.
    Higher = appears earlier.
    """
    stars = repo.get('stargazers_count', 0)
    has_description = 1 if repo.get('description') else 0

    # Recency score (0-10 based on days since last push)
    pushed_at = repo.get('pushed_at')
    if pushed_at:
        try:
            pushed_date = datetime.fromisoformat(pushed_at.replace('Z', '+00:00'))
            days_since_push = (datetime.now(timezone.utc) - pushed_date).days
            recency_score = max(0, 10 - (days_since_push / 30))  # Decay over ~300 days
        except:
            recency_score = 0
    else:
        recency_score = 0

    priority = int((stars * 3) + (recency_score * 2) + has_description)
    return priority


def get_image_for_repo(repo_name: str) -> str:
    """
    Check if an image exists for this repo in assets/images/projects/.
    Returns path if exists, otherwise empty string.
    """
    image_extensions = ['jpg', 'jpeg', 'png', 'gif', 'webp']

    # Get repository root (2 levels up from .github/scripts/)
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))

    for ext in image_extensions:
        image_path = f'./assets/images/projects/{repo_name}.{ext}'
        full_path = os.path.join(repo_root, 'assets', 'images', 'projects', f'{repo_name}.{ext}')

        if os.path.exists(full_path):
            print(f"  Found image: {image_path}")
            return image_path

    return ''


# Hosts that only ever serve status/version badges. Images from these are
# dropped from rendered READMEs; anything else renders untouched, so an
# unrecognized image is always kept rather than guessed at.
BADGE_HOSTS = {
    'img.shields.io',
    'shields.io',
    'badgen.net',
    'badge.fury.io',
    'travis-ci.org',
    'travis-ci.com',
    'circleci.com',
    'codecov.io',
    'coveralls.io',
    'api.codeclimate.com',
    'snyk.io',
    'app.netlify.com',
    'forthebadge.com',
    'badges.gitter.im',
    'isitmaintained.com',
    'deepsource.io',
}

PROJECT_PAGE_DIR = 'projects'
README_SEARCH_INDEX_PATH = ('data', 'readme-search-index.yml')
README_EXCERPT_MAX_CHARS = 2000


def slugify_repo(repo_name: str) -> str:
    """Convert a repo name into a lowercase, URL-safe page slug."""
    return re.sub(r'[^a-z0-9._-]+', '-', repo_name.lower()).strip('-') or repo_name.lower()


def fetch_readme(repo_name: str) -> Optional[str]:
    """Fetch a repository's README as raw markdown. Returns None if absent."""
    try:
        url = f'https://api.github.com/repos/{REPO_OWNER}/{repo_name}/readme'
        headers = {**HEADERS, 'Accept': 'application/vnd.github.raw'}
        response = requests.get(url, headers=headers, timeout=30)

        if response.status_code == 200:
            return response.text

        if response.status_code != 404:
            print(f"  WARNING: README fetch returned {response.status_code}")
        return None

    except Exception as e:
        print(f"  WARNING: README fetch failed: {e}")
        return None


def render_markdown(markdown_text: str, repo_name: str) -> Optional[str]:
    """
    Render markdown to HTML via GitHub's own markdown API, so the output
    matches what GitHub shows (tables, task lists, autolinks and all).
    """
    try:
        response = requests.post(
            'https://api.github.com/markdown',
            headers=HEADERS,
            json={
                'text': markdown_text,
                'mode': 'gfm',
                'context': f'{REPO_OWNER}/{repo_name}'
            },
            timeout=30
        )

        if response.status_code == 200:
            return response.text

        print(f"  WARNING: Markdown render returned {response.status_code}")
        return None

    except Exception as e:
        print(f"  WARNING: Markdown render failed: {e}")
        return None


def is_badge_image(src: str) -> bool:
    """
    Detect badge images by host allowlist only. Unrecognized sources are
    never treated as badges, so this can drop noise without ever eating
    real content.
    """
    if not src:
        return False

    host = (urlparse(src).hostname or '').lower()
    if host.startswith('www.'):
        host = host[4:]

    if host in BADGE_HOSTS:
        return True

    # GitHub Actions workflow status badges
    return src.rstrip('/').endswith('/badge.svg')


GITHUB_ASSET_HOSTS = (
    'private-user-images.githubusercontent.com',
    'user-images.githubusercontent.com',
)

# Resolved once per asset URL and reused across repos
_asset_url_cache: Dict[str, Optional[str]] = {}


def is_uploaded_asset(url: str) -> bool:
    """True for README attachments GitHub serves from its user-content hosts."""
    return bool(url) and urlparse(url).hostname in GITHUB_ASSET_HOSTS


def resolve_uploaded_asset(url: str) -> Optional[str]:
    """
    GitHub renders uploaded README attachments behind URLs signed for a few
    minutes, which would already be dead by the time anyone loads a static
    page. Rewrite them to their stable public form and confirm that actually
    serves before using it; None means the asset isn't publicly reachable.
    """
    canonical = f'https://user-images.githubusercontent.com{urlparse(url).path}'

    if canonical in _asset_url_cache:
        return _asset_url_cache[canonical]

    try:
        response = requests.get(
            canonical,
            timeout=20,
            allow_redirects=True,
            headers={'Range': 'bytes=0-0'}
        )
        reachable = response.status_code in (200, 206)
    except Exception:
        reachable = False

    if not reachable:
        print(f"    Dropped unreachable README asset: {canonical}")

    _asset_url_cache[canonical] = canonical if reachable else None
    return _asset_url_cache[canonical]


def clean_readme_html(html: str, repo_name: str, default_branch: str, title: str) -> str:
    """
    Post-process GitHub-rendered README HTML for hosting on this site:
    resolve relative links against the source repo, drop badge images, and
    remove the duplicated top-level heading.
    """
    soup = BeautifulSoup(html, 'html.parser')

    raw_base = f'https://raw.githubusercontent.com/{REPO_OWNER}/{repo_name}/{default_branch}/'
    blob_base = f'https://github.com/{REPO_OWNER}/{repo_name}/blob/{default_branch}/'

    for img in soup.find_all('img'):
        src = img.get('src', '')

        # GitHub's renderer proxies external images through camo and keeps the
        # original URL in data-canonical-src, so badges must be matched there.
        if is_badge_image(img.get('data-canonical-src', '')) or is_badge_image(src):
            link = img.find_parent('a')
            img.decompose()
            if link and not link.get_text(strip=True) and not link.find('img'):
                link.decompose()
            continue

        if src and not urlparse(src).scheme and not src.startswith('//'):
            img['src'] = urljoin(raw_base, src.lstrip('/'))
        img['loading'] = 'lazy'

    # Swap signed attachment URLs for their stable public form. Anything
    # GitHub won't serve publicly becomes a link out rather than a dead embed.
    readme_url = f'https://github.com/{REPO_OWNER}/{repo_name}#readme'
    unresolved_containers = []

    for media in soup.find_all(['img', 'video', 'source']):
        src = media.get('src') or media.get('data-canonical-src') or ''
        if not is_uploaded_asset(src):
            continue

        resolved = resolve_uploaded_asset(src)
        if resolved:
            media['src'] = resolved
            if media.has_attr('data-canonical-src'):
                del media['data-canonical-src']
            continue

        container = media.find_parent('details') or media
        if not any(existing is container for existing in unresolved_containers):
            unresolved_containers.append(container)

    for container in unresolved_containers:
        link = soup.new_tag('a', href=readme_url, target='_blank', rel='noopener noreferrer')
        link.string = 'View this media on GitHub'
        container.replace_with(link)

    for anchor in soup.find_all('a'):
        href = anchor.get('href', '')
        if not href or href.startswith('#'):
            continue
        if is_uploaded_asset(href):
            anchor['href'] = resolve_uploaded_asset(href) or readme_url
            continue
        if not urlparse(href).scheme and not href.startswith('//'):
            anchor['href'] = urljoin(blob_base, href.lstrip('/'))
            anchor['rel'] = 'noopener noreferrer'

    # The page header already shows the project name; a README that opens
    # with the same heading would render it twice.
    first_heading = soup.find(['h1', 'h2', 'h3'])
    if first_heading and first_heading.name == 'h1':
        heading_text = re.sub(r'[^a-z0-9]+', '', first_heading.get_text().lower())
        for candidate in (repo_name, title):
            if heading_text == re.sub(r'[^a-z0-9]+', '', candidate.lower()):
                first_heading.decompose()
                break

    # GitHub's autolinker can emit empty duplicate anchors around text that
    # already sits inside a hand-written link. Anchors carrying an id/name are
    # left alone — those are heading targets for in-page links.
    for anchor in soup.find_all('a'):
        if anchor.get('id') or anchor.get('name'):
            continue
        if not anchor.get_text(strip=True) and not anchor.find(['img', 'svg', 'picture']):
            anchor.decompose()

    for paragraph in soup.find_all('p'):
        if not paragraph.get_text(strip=True) and not paragraph.find(['img', 'br', 'iframe']):
            paragraph.decompose()

    return str(soup)


def build_search_excerpt(readme_html: str) -> str:
    """Flatten rendered README prose into a short blob for the site search index."""
    soup = BeautifulSoup(readme_html, 'html.parser')

    for element in soup.find_all(['pre', 'code']):
        element.decompose()

    text = re.sub(r'\s+', ' ', soup.get_text(' ')).strip()
    return text[:README_EXCERPT_MAX_CHARS]


PROJECT_PAGE_TEMPLATE = Template('''<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>$title - Avery</title>
  <meta name="description" content="$description">
  <link rel="stylesheet" href="../css/main.css">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"
        integrity="sha512-DTOQO9RWCH3ppGqcWaEA1BIZOC6xxalwEsw9c2QQeAIftl+Vegovlnee1c9QX4TctnWMn13TZye+giMm8e2LwA=="
        crossorigin="anonymous" referrerpolicy="no-referrer">
  <style>
    .project-container { max-width: 900px; margin: 0 auto; padding: 2rem; }
    .project-header { margin-bottom: 2rem; padding-bottom: 2rem; border-bottom: 1px solid var(--border-color); }
    .project-title { font-size: 2.5rem; margin-bottom: 0.5rem; color: var(--text-primary); }
    .project-tagline { font-size: 1.1rem; color: var(--text-secondary); margin-bottom: 1.25rem; }
    .project-stats { display: flex; flex-wrap: wrap; gap: 1.25rem; margin-bottom: 1.5rem; font-size: 0.9rem; color: var(--text-secondary); }
    .project-stats span { display: inline-flex; align-items: center; gap: 0.4rem; }
    .project-stats i { color: var(--text-tertiary); }
    .project-links { display: flex; flex-wrap: wrap; gap: 0.75rem; }
    .project-link-btn { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.55rem 1rem; border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary); text-decoration: none; font-size: 0.95rem; transition: border-color 0.2s ease; }
    .project-link-btn:hover { border-color: var(--accent-primary); color: var(--accent-primary); }
    .back-link { display: inline-flex; align-items: center; gap: 0.5rem; color: var(--accent-primary); text-decoration: none; margin-bottom: 2rem; font-size: 1rem; }
    .back-link:hover { text-decoration: underline; }
    .readme-content { color: var(--text-primary); line-height: 1.7; font-size: 1rem; overflow-wrap: break-word; }
    .readme-content h1, .readme-content h2 { margin-top: 2.5rem; margin-bottom: 1rem; padding-bottom: 0.4rem; border-bottom: 1px solid var(--border-color); color: var(--text-primary); }
    .readme-content h3, .readme-content h4, .readme-content h5, .readme-content h6 { margin-top: 2rem; margin-bottom: 0.75rem; color: var(--text-primary); }
    .readme-content p { margin-bottom: 1.25rem; }
    .readme-content ul, .readme-content ol { margin-left: 2rem; margin-bottom: 1.25rem; }
    .readme-content li { margin-bottom: 0.5rem; }
    .readme-content a { color: var(--accent-primary); }
    .readme-content img { max-width: 100%; height: auto; border-radius: 6px; }
    .readme-content video { max-width: 100%; height: auto; border-radius: 6px; margin-bottom: 1.25rem; }
    .readme-content details { margin-bottom: 1.25rem; }
    .readme-content summary { cursor: pointer; padding: 0.4rem 0; color: var(--text-secondary); }
    .readme-content summary svg { vertical-align: middle; fill: currentColor; }
    .readme-content .dropdown-caret { display: none; }
    .readme-content code { background: var(--bg-secondary); padding: 0.15em 0.4em; border-radius: 4px; font-size: 0.9em; }
    .readme-content pre { background: var(--bg-secondary); padding: 1rem; border-radius: 8px; overflow-x: auto; margin-bottom: 1.25rem; }
    .readme-content pre code { background: none; padding: 0; }
    .readme-content blockquote { margin: 0 0 1.25rem; padding-left: 1rem; border-left: 3px solid var(--border-color); color: var(--text-secondary); }
    .readme-content table { border-collapse: collapse; margin-bottom: 1.25rem; display: block; overflow-x: auto; }
    .readme-content th, .readme-content td { border: 1px solid var(--border-color); padding: 0.5rem 0.75rem; text-align: left; }
    .readme-content hr { border: none; border-top: 1px solid var(--border-color); margin: 2rem 0; }
    .project-footer { margin-top: 3rem; padding-top: 1.5rem; border-top: 1px solid var(--border-color); font-size: 0.85rem; color: var(--text-tertiary); }
  </style>
</head>
<body>
  <header class="site-header">
    <div class="header-content">
      <div class="header-main">
        <div class="header-left"><a href="../" class="site-title">Avery</a></div>
        <div class="header-right">
          <button id="theme-toggle" class="theme-toggle" aria-label="Toggle theme" title="Toggle theme">🌙</button>
        </div>
      </div>
    </div>
  </header>
  <main class="project-container">
    <a href="../" class="back-link"><i class="fas fa-arrow-left"></i> Back to Home</a>
    <div class="project-header">
      <h1 class="project-title">$title</h1>
      $tagline
      <div class="project-stats">$stats</div>
      <div class="project-links">
        <a class="project-link-btn" href="$repo_url" target="_blank" rel="noopener noreferrer"><i class="fab fa-github"></i> View on GitHub</a>
        $homepage_link
      </div>
    </div>
    <div class="readme-content">$readme</div>
    <div class="project-footer">README synced from GitHub on $synced_on.</div>
  </main>
  <script type="module">
    import { initTheme } from '../js/theme.js';
    initTheme();
  </script>
</body>
</html>''')


def build_project_page(repo: Dict[str, Any], title: str, repo_root: str) -> Tuple[Optional[str], Optional[str]]:
    """
    Generate a static README page for a repository.

    Returns (page_path, search_excerpt), both None when the repo has no
    README or the render failed — callers then link straight to GitHub.
    """
    repo_name = repo['name']

    markdown_text = fetch_readme(repo_name)
    if not markdown_text or not markdown_text.strip():
        print(f"  No README - tile will link to GitHub")
        return None, None

    rendered = render_markdown(markdown_text, repo_name)
    if not rendered:
        return None, None

    readme_html = clean_readme_html(
        rendered,
        repo_name,
        repo.get('default_branch') or 'main',
        title
    )

    stats = []
    if repo.get('language'):
        stats.append(f'<span><i class="fas fa-code"></i> {escape_html(repo["language"])}</span>')
    stats.append(f'<span><i class="fas fa-star"></i> {repo.get("stargazers_count", 0)}</span>')
    stats.append(f'<span><i class="fas fa-code-branch"></i> {repo.get("forks_count", 0)}</span>')

    pushed_at = repo.get('pushed_at')
    if pushed_at:
        try:
            pushed_date = datetime.fromisoformat(pushed_at.replace('Z', '+00:00'))
            stats.append(f'<span><i class="fas fa-clock"></i> Updated {pushed_date.strftime("%b %Y")}</span>')
        except ValueError:
            pass

    description = repo.get('description') or ''
    homepage = (repo.get('homepage') or '').strip()
    homepage_link = (
        f'<a class="project-link-btn" href="{escape_html(homepage)}" target="_blank" rel="noopener noreferrer">'
        f'<i class="fas fa-arrow-up-right-from-square"></i> Live site</a>'
        if homepage else ''
    )

    html = PROJECT_PAGE_TEMPLATE.safe_substitute(
        title=escape_html(title),
        description=escape_html(description),
        tagline=f'<p class="project-tagline">{escape_html(description)}</p>' if description else '',
        stats=''.join(stats),
        repo_url=escape_html(repo['html_url']),
        homepage_link=homepage_link,
        readme=readme_html,
        synced_on=datetime.now(timezone.utc).strftime('%B %d, %Y')
    )

    slug = slugify_repo(repo_name)
    pages_dir = os.path.join(repo_root, PROJECT_PAGE_DIR)
    os.makedirs(pages_dir, exist_ok=True)

    with open(os.path.join(pages_dir, f'{slug}.html'), 'w', encoding='utf-8') as f:
        f.write(html)

    print(f"  Generated: {PROJECT_PAGE_DIR}/{slug}.html")

    return f'./{PROJECT_PAGE_DIR}/{slug}.html', build_search_excerpt(readme_html)


def escape_html(text: str) -> str:
    """Escape text for interpolation into an HTML attribute or text node."""
    return (
        str(text)
        .replace('&', '&amp;')
        .replace('<', '&lt;')
        .replace('>', '&gt;')
        .replace('"', '&quot;')
    )


def transform_repo_to_tile(
    repo: Dict[str, Any],
    featured_repos: List[str] = None,
    repo_root: str = None,
    search_index: Dict[str, str] = None
) -> Dict[str, Any]:
    """Transform GitHub API response to tile data structure."""
    repo_name = repo['name']

    print(f"Processing: {repo_name}")

    # Calculate priority
    priority = calculate_priority(repo)

    # Get topics
    topics = repo.get('topics', [])

    # Featured: ONLY from manual override list
    if featured_repos and repo_name in featured_repos:
        featured = True
        print(f"  Marked as featured (manual override)")
    else:
        featured = False

    # Get image if exists
    image = get_image_for_repo(repo_name)

    # Build tags from language + topics
    tags = []
    if repo.get('language'):
        tags.append(repo['language'].lower())
    tags.extend(topics)

    # Convert repo name to title (e.g., "steam-hours" -> "Steam Hours")
    title = repo_name.replace('-', ' ').replace('_', ' ').title()

    # Generate the on-site README page. Repos without a usable README keep
    # linking straight out to GitHub.
    page_path, search_excerpt = build_project_page(repo, title, repo_root)
    if search_excerpt and search_index is not None:
        search_index[repo_name] = search_excerpt

    tile = {
        'id': repo_name,
        'type': 'project',
        'name': repo_name,
        'title': title,
        'description': repo.get('description') or '',
        'url': page_path or repo['html_url'],
        'repo_url': repo['html_url'],
        'homepage': repo.get('homepage'),
        'image': image,

        # GitHub metadata
        'language': repo.get('language'),
        'stars': repo.get('stargazers_count', 0),
        'forks': repo.get('forks_count', 0),
        'topics': topics,
        'created_at': repo.get('created_at'),
        'updated_at': repo.get('updated_at'),
        'pushed_at': repo.get('pushed_at'),

        # Display config
        'priority': priority,
        'tags': tags,
        'featured': featured,
        'span_columns': 1,
        'span_rows': 1
    }

    # Remove None values for cleaner YAML
    return {k: v for k, v in tile.items() if v is not None}


def load_featured_repos() -> List[str]:
    """Load the featured repository list from site config."""
    try:
        repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
        config_path = os.path.join(repo_root, 'data', 'site-config.yml')

        with open(config_path, 'r', encoding='utf-8') as f:
            config = yaml.safe_load(f)

        featured = config.get('featured_repos', [])
        if featured:
            print(f"Loaded {len(featured)} featured repositories from site-config.yml")
        return featured
    except Exception as e:
        print(f"WARNING: Could not load featured list: {e}")
        print("Will use automatic featured detection (stars > 5)")
        return []


def generate_yaml_output(repos: List[Dict[str, Any]], repo_root: str, search_index: Dict[str, str]) -> str:
    """Generate YAML output file."""
    # Load featured repos list from site config
    featured_repos = load_featured_repos()

    tiles = [transform_repo_to_tile(repo, featured_repos, repo_root, search_index) for repo in repos]

    # Sort by priority (descending)
    tiles.sort(key=lambda x: x['priority'], reverse=True)

    output = {
        'metadata': {
            'generated_at': datetime.now(timezone.utc).isoformat(),
            'source_api': f'https://api.github.com/users/{REPO_OWNER}/repos',
            'total_repos': len(tiles)
        },
        'projects': tiles
    }

    # Generate YAML with custom formatting
    yaml_str = yaml.dump(output, default_flow_style=False, sort_keys=False, allow_unicode=True)

    return yaml_str


def load_curated_list() -> List[str]:
    """Load the curated repository list from site config."""
    try:
        repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
        config_path = os.path.join(repo_root, 'data', 'site-config.yml')

        with open(config_path, 'r', encoding='utf-8') as f:
            config = yaml.safe_load(f)

        curated = config.get('curated_repos', [])
        if curated:
            print(f"Loaded {len(curated)} curated repositories from site-config.yml")
        return curated
    except Exception as e:
        print(f"WARNING: Could not load curated list: {e}")
        print("Will include all repositories")
        return []


def warn_about_unmatched(curated_list: List[str], repos: List[Dict[str, Any]]):
    """
    Curated entries are matched against repo names exactly, so a repo that
    gets renamed, deleted, or made private just stops appearing. Say so
    loudly instead of dropping it on the floor.
    """
    matched = {repo['name'] for repo in repos}
    unmatched = [name for name in curated_list if name not in matched]

    if not unmatched:
        return

    summary = f"{len(unmatched)} curated repo(s) matched nothing and will not appear: {', '.join(unmatched)}"
    print(f"\nWARNING: {summary}")
    print("  Usually means the repo was renamed, deleted, or made private.")

    if IS_GITHUB_ACTIONS:
        print(f"::warning title=Unmatched curated repos::{summary}")


def prune_stale_pages(repo_root: str, generated_slugs: List[str]):
    """
    Remove project pages for repos no longer curated. Skipped entirely when
    nothing generated, so a failed run never wipes the existing pages.
    """
    if not generated_slugs:
        print("No pages generated - skipping prune")
        return

    pages_dir = os.path.join(repo_root, PROJECT_PAGE_DIR)
    if not os.path.isdir(pages_dir):
        return

    keep = {f'{slug}.html' for slug in generated_slugs}
    for filename in os.listdir(pages_dir):
        if filename.endswith('.html') and filename not in keep:
            os.remove(os.path.join(pages_dir, filename))
            print(f"  Removed stale page: {PROJECT_PAGE_DIR}/{filename}")


def write_search_index(repo_root: str, search_index: Dict[str, str]):
    """Write the README search index consumed by the homepage filter system."""
    output_path = os.path.join(repo_root, *README_SEARCH_INDEX_PATH)

    payload = {
        'metadata': {
            'generated_at': datetime.now(timezone.utc).isoformat(),
            'total_entries': len(search_index)
        },
        'readmes': dict(sorted(search_index.items()))
    }

    with open(output_path, 'w', encoding='utf-8') as f:
        yaml.dump(payload, f, default_flow_style=False, sort_keys=False, allow_unicode=True)

    print(f"✅ Generated: {output_path}")
    print(f"   Indexed READMEs: {len(search_index)}")


def main():
    """Main execution."""
    # Fetch repos
    repos = fetch_repos()

    if not repos:
        print("WARNING: No repositories found or API request failed")
        return

    # Filter by curated list if available
    curated_list = load_curated_list()
    if curated_list:
        original_count = len(repos)
        repos = [r for r in repos if r['name'] in curated_list]
        print(f"Filtered to {len(repos)} curated repos (from {original_count} total)")
        warn_about_unmatched(curated_list, repos)

    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
    search_index: Dict[str, str] = {}

    # Generate YAML
    print(f"\nGenerating YAML...")
    yaml_content = generate_yaml_output(repos, repo_root, search_index)

    output_path = os.path.join(repo_root, 'data', 'github-projects.yml')

    # Ensure data directory exists
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(yaml_content)

    print(f"\n✅ Generated: {output_path}")
    print(f"   Total projects: {len(repos)}")

    prune_stale_pages(repo_root, [slugify_repo(name) for name in search_index])
    write_search_index(repo_root, search_index)

    if IS_GITHUB_ACTIONS:
        print(f"\nRunning in GitHub Actions - changes will be committed automatically")
    else:
        print(f"\nRunning locally - commit changes manually:")
        print(f"   git add data/github-projects.yml data/readme-search-index.yml {PROJECT_PAGE_DIR}/")
        print(f"   git commit -m 'Update GitHub projects data'")

    print(f"{'='*50}")


if __name__ == '__main__':
    main()
