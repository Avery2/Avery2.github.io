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
import sys
import requests
import yaml
from datetime import datetime, timezone
from typing import List, Dict, Any
from pathlib import Path

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


def fetch_traffic_stats(repo_name: str) -> Dict[str, int]:
    """
    Fetch traffic statistics for a repository.
    Requires admin/push access - will gracefully fail for forks.
    """
    try:
        url = f'https://api.github.com/repos/{REPO_OWNER}/{repo_name}/traffic/views'
        response = requests.get(url, headers=HEADERS)

        if response.status_code == 403:
            # Insufficient permissions (expected for forks)
            return {}

        if response.status_code == 200:
            data = response.json()
            return {
                'views_14d': data.get('count', 0),
                'unique_visitors_14d': data.get('uniques', 0)
            }

        return {}

    except Exception as e:
        return {}


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


def transform_repo_to_tile(repo: Dict[str, Any]) -> Dict[str, Any]:
    """Transform GitHub API response to tile data structure."""
    repo_name = repo['name']

    print(f"Processing: {repo_name}")

    # Fetch traffic stats (may fail for forks)
    traffic = fetch_traffic_stats(repo_name)

    # Calculate priority
    priority = calculate_priority(repo)

    # Get topics
    topics = repo.get('topics', [])

    # Featured if stars > 5
    featured = repo.get('stargazers_count', 0) > 5

    # Get image if exists
    image = get_image_for_repo(repo_name)

    # Build tags from language + topics
    tags = []
    if repo.get('language'):
        tags.append(repo['language'].lower())
    tags.extend(topics)

    # Convert repo name to title (e.g., "steam-hours" -> "Steam Hours")
    title = repo_name.replace('-', ' ').replace('_', ' ').title()

    tile = {
        'id': repo_name,
        'type': 'project',
        'name': repo_name,
        'title': title,
        'description': repo.get('description') or '',
        'url': repo['html_url'],
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

        # Traffic stats
        'traffic': traffic if traffic else None,

        # Display config
        'priority': priority,
        'tags': tags,
        'featured': featured,
        'span_columns': 1,
        'span_rows': 1
    }

    # Remove None values for cleaner YAML
    return {k: v for k, v in tile.items() if v is not None}


def generate_yaml_output(repos: List[Dict[str, Any]]) -> str:
    """Generate YAML output file."""
    tiles = [transform_repo_to_tile(repo) for repo in repos]

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

    # Generate YAML
    print(f"\nGenerating YAML...")
    yaml_content = generate_yaml_output(repos)

    # Write to file (relative to repository root)
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
    output_path = os.path.join(repo_root, 'data', 'github-projects.yml')

    # Ensure data directory exists
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(yaml_content)

    print(f"\n✅ Generated: {output_path}")
    print(f"   Total projects: {len(repos)}")

    if IS_GITHUB_ACTIONS:
        print(f"\nRunning in GitHub Actions - changes will be committed automatically")
    else:
        print(f"\nRunning locally - commit changes manually:")
        print(f"   git add data/github-projects.yml")
        print(f"   git commit -m 'Update GitHub projects data'")

    print(f"{'='*50}")


if __name__ == '__main__':
    main()
