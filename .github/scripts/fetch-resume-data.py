#!/usr/bin/env python3
"""
Fetch Resume Data Script

This script fetches resume HTML from a public repository and extracts
education and experience sections into YAML files.

Features:
- Defensive coding: doesn't overwrite on failure
- Configurable resume URL
- Graceful degradation

Usage:
    Local: python fetch-resume-data.py
    GitHub Actions: Runs automatically
"""

import os
import sys
import requests
import yaml
from datetime import datetime, timezone
from pathlib import Path
from bs4 import BeautifulSoup
from typing import List, Dict, Any, Optional

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

print(f"{'='*50}")
print(f"Resume Data Fetcher")
print(f"{'='*50}\n")


def load_config() -> Optional[str]:
    """Load resume source URL from site config."""
    try:
        repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
        config_path = os.path.join(repo_root, 'data', 'site-config.yml')

        with open(config_path, 'r', encoding='utf-8') as f:
            config = yaml.safe_load(f)

        resume_url = config.get('resume_source_url')

        if not resume_url:
            print("INFO: resume_source_url not configured in site-config.yml")
            print("Skipping resume data extraction.")
            return None

        if resume_url == 'DISABLED':
            print("INFO: Resume data extraction is disabled")
            return None

        print(f"Resume URL: {resume_url}")
        return resume_url

    except Exception as e:
        print(f"WARNING: Could not load config: {e}")
        return None


def fetch_resume_html(url: str) -> Optional[str]:
    """Fetch the resume HTML from the URL."""
    try:
        # Convert GitHub blob URL to raw URL if needed
        if 'github.com' in url and '/blob/' in url:
            url = url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/')

        print(f"Fetching resume from: {url}")
        response = requests.get(url, timeout=10)

        if response.status_code != 200:
            print(f"ERROR: Failed to fetch resume (status {response.status_code})")
            return None

        print("✅ Resume fetched successfully")
        return response.text

    except Exception as e:
        print(f"ERROR: Failed to fetch resume: {e}")
        return None


def parse_experience(soup: BeautifulSoup) -> List[Dict[str, Any]]:
    """Extract experience section from resume HTML."""
    try:
        experience_section = soup.find('section', class_='experience')
        if not experience_section:
            print("WARNING: No experience section found")
            return []

        jobs = []
        job_articles = experience_section.find_all('article', class_='job')

        print(f"Found {len(job_articles)} job experiences")

        for article in job_articles:
            header = article.find('header', class_='job-header')
            if not header:
                continue

            # Extract metadata
            company_elem = header.find('h3')
            location_elem = header.find('div', class_='job-location')
            title_elem = header.find('div', class_='job-title')
            dates_elem = header.find('div', class_='job-dates')

            # Extract description (everything after header)
            description_html = ''
            for elem in article.children:
                if elem.name and elem.name != 'header':
                    description_html += str(elem)

            job = {
                'company': company_elem.get_text(strip=True) if company_elem else '',
                'location': location_elem.get_text(strip=True) if location_elem else '',
                'title': title_elem.get_text(strip=True) if title_elem else '',
                'dates': dates_elem.get_text(strip=True) if dates_elem else '',
                'description_html': description_html.strip()
            }

            jobs.append(job)
            print(f"  ✓ {job['company']} - {job['title']}")

        return jobs

    except Exception as e:
        print(f"ERROR: Failed to parse experience: {e}")
        return []


def parse_education(soup: BeautifulSoup) -> List[Dict[str, Any]]:
    """Extract education section from resume HTML."""
    try:
        education_section = soup.find('section', class_='education')
        if not education_section:
            print("WARNING: No education section found")
            return []

        degrees = []
        degree_articles = education_section.find_all('article', class_='degree')

        print(f"Found {len(degree_articles)} education entries")

        for article in degree_articles:
            header = article.find('header', class_='degree-header')
            if not header:
                continue

            # Extract metadata
            school_elem = header.find('h3')
            location_elem = header.find('div', class_='degree-location')
            title_elem = header.find('div', class_='degree-title')
            dates_elem = header.find('div', class_='degree-dates')
            gpa_elem = header.find('div', class_='gpa')

            # Extract description (everything after header)
            description_html = ''
            for elem in article.children:
                if elem.name and elem.name != 'header':
                    description_html += str(elem)

            degree = {
                'school': school_elem.get_text(strip=True) if school_elem else '',
                'location': location_elem.get_text(strip=True) if location_elem else '',
                'degree': title_elem.get_text(strip=True) if title_elem else '',
                'dates': dates_elem.get_text(strip=True) if dates_elem else '',
                'gpa': gpa_elem.get_text(strip=True) if gpa_elem else '',
                'description_html': description_html.strip()
            }

            degrees.append(degree)
            print(f"  ✓ {degree['school']} - {degree['degree']}")

        return degrees

    except Exception as e:
        print(f"ERROR: Failed to parse education: {e}")
        return []


def slugify(text: str) -> str:
    """Convert text to URL-friendly slug."""
    import re
    text = text.lower()
    text = re.sub(r'[^a-z0-9]+', '-', text)
    text = text.strip('-')
    return text


def generate_tiles(experience: List[Dict], education: List[Dict]) -> bool:
    """Generate tiles and detail data for experience and education."""
    try:
        repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
        data_dir = os.path.join(repo_root, 'data')
        os.makedirs(data_dir, exist_ok=True)

        tiles = []

        # Generate experience tiles
        for idx, exp in enumerate(experience):
            slug = slugify(exp['company'])

            # Custom priority: Keep Amplitude high, lower others significantly
            if 'amplitude' in exp['company'].lower():
                priority = 100
            elif 'halo' in exp['company'].lower():
                priority = 10  # Much lower priority
            elif 'mast' in exp['company'].lower() or 'material' in exp['company'].lower():
                priority = 5  # Much lower priority
            else:
                priority = 100 - idx

            tile = {
                'id': f"experience-{slug}",
                'type': 'experience',
                'name': exp['company'],
                'title': exp['company'],
                'description': exp['title'],  # Just the job title, no dates
                'url': f'./writing/experience/{slug}.html',
                'tags': ['experience', 'professional'],
                'meta': {
                    'company': exp['company'],
                    'title': exp['title'],
                    'location': exp['location'],
                    'dates': exp['dates']
                },
                'priority': priority,
                'featured': True,  # Mark as featured for border styling
                'span_columns': 1,
                'span_rows': 1
            }
            tiles.append(tile)

        # Generate education tiles
        for idx, edu in enumerate(education):
            slug = slugify(edu['school'])

            # Custom priority: Keep UW-Madison high
            if 'wisconsin' in edu['school'].lower():
                priority = 95  # High priority, just below Amplitude
            else:
                priority = 90 - idx

            tile = {
                'id': f"education-{slug}",
                'type': 'education',
                'name': edu['school'],
                'title': edu['school'],
                'description': edu['degree'],  # Just the degree, no dates
                'url': f'./writing/education/{slug}.html',
                'tags': ['education', 'academic'],
                'meta': {
                    'school': edu['school'],
                    'degree': edu['degree'],
                    'location': edu['location'],
                    'dates': edu['dates'],
                    'gpa': edu.get('gpa', '')
                },
                'priority': priority,
                'featured': True,  # Mark as featured for border styling
                'span_columns': 1,
                'span_rows': 1
            }
            tiles.append(tile)

        # Generate tiles YAML
        tiles_output = {
            'metadata': {
                'generated_at': datetime.now(timezone.utc).isoformat(),
                'source': 'resume',
                'total_tiles': len(tiles)
            },
            'tiles': tiles
        }

        tiles_path = os.path.join(data_dir, 'resume-tiles.yml')
        with open(tiles_path, 'w', encoding='utf-8') as f:
            yaml.dump(tiles_output, f, default_flow_style=False, sort_keys=False, allow_unicode=True)

        print(f"✅ Generated: {tiles_path} ({len(tiles)} tiles)")

        # Generate detail data (for detail pages to load)
        detail_data = {
            'metadata': {
                'generated_at': datetime.now(timezone.utc).isoformat()
            },
            'experiences': experience,
            'education': education
        }

        detail_path = os.path.join(data_dir, 'resume-details.yml')
        with open(detail_path, 'w', encoding='utf-8') as f:
            yaml.dump(detail_data, f, default_flow_style=False, sort_keys=False, allow_unicode=True)

        print(f"✅ Generated: {detail_path}")

        # Generate individual HTML files for each experience and education
        generate_detail_pages(experience, education, repo_root)

        return True

    except Exception as e:
        print(f"ERROR: Failed to generate tiles: {e}")
        return False


def generate_detail_pages(experience: List[Dict], education: List[Dict], repo_root: str):
    """Generate individual HTML detail pages for each experience and education entry."""
    try:
        # HTML template for experience pages
        exp_template = '''<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title} - Avery</title>
  <meta name="description" content="{description}">
  <link rel="stylesheet" href="../../css/main.css">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"
        integrity="sha512-DTOQO9RWCH3ppGqcWaEA1BIZOC6xxalwEsw9c2QQeAIftl+Vegovlnee1c9QX4TctnWMn13TZye+giMm8e2LwA=="
        crossorigin="anonymous" referrerpolicy="no-referrer">
  <style>
    .writing-container {{ max-width: 900px; margin: 0 auto; padding: 2rem; }}
    .writing-header {{ margin-bottom: 2rem; padding-bottom: 2rem; border-bottom: 1px solid var(--border-color); }}
    .writing-title {{ font-size: 2.5rem; margin-bottom: 0.5rem; color: var(--text-primary); }}
    .writing-meta {{ display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem; }}
    .meta-item {{ display: flex; align-items: center; gap: 0.75rem; font-size: 1rem; color: var(--text-secondary); }}
    .meta-item i {{ color: var(--text-tertiary); width: 20px; }}
    .back-link {{ display: inline-flex; align-items: center; gap: 0.5rem; color: var(--accent-primary); text-decoration: none; margin-bottom: 2rem; font-size: 1rem; }}
    .back-link:hover {{ text-decoration: underline; }}
    .experience-content {{ color: var(--text-primary); line-height: 1.7; font-size: 1rem; }}
    .experience-content p {{ margin-bottom: 1.25rem; }}
    .experience-content ul {{ margin-left: 2rem; margin-bottom: 1.25rem; }}
    .experience-content li {{ margin-bottom: 0.75rem; }}
    .experience-content h2, .experience-content h3, .experience-content h4 {{ margin-top: 2rem; margin-bottom: 1rem; color: var(--text-primary); }}
  </style>
</head>
<body>
  <header class="site-header">
    <div class="header-content">
      <div class="header-main">
        <div class="header-left"><a href="../../" class="site-title">Avery</a></div>
        <div class="header-right">
          <button id="theme-toggle" class="theme-toggle" aria-label="Toggle theme" title="Toggle theme">🌙</button>
        </div>
      </div>
    </div>
  </header>
  <main class="writing-container">
    <a href="../../" class="back-link"><i class="fas fa-arrow-left"></i> Back to Home</a>
    <div class="writing-header">
      <h1 class="writing-title">{company}</h1>
      <div class="writing-meta">
        <div class="meta-item"><i class="fas fa-briefcase"></i><strong>{job_title}</strong></div>
        <div class="meta-item"><i class="fas fa-map-marker-alt"></i>{location}</div>
        <div class="meta-item"><i class="fas fa-calendar"></i>{dates}</div>
      </div>
    </div>
    <div class="experience-content">{content}</div>
  </main>
  <script type="module">
    import {{ initTheme }} from '../../js/theme.js';
    initTheme();
  </script>
</body>
</html>'''

        # Generate experience pages
        exp_dir = os.path.join(repo_root, 'writing', 'experience')
        os.makedirs(exp_dir, exist_ok=True)

        for exp in experience:
            slug = slugify(exp['company'])
            html = exp_template.format(
                title=exp['company'],
                description=exp['title'],
                company=exp['company'],
                job_title=exp['title'],
                location=exp['location'],
                dates=exp['dates'],
                content=exp['description_html']
            )

            filepath = os.path.join(exp_dir, f'{slug}.html')
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(html)

            print(f"  ✓ Generated: writing/experience/{slug}.html")

        # HTML template for education pages
        edu_template = '''<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title} - Avery</title>
  <meta name="description" content="{description}">
  <link rel="stylesheet" href="../../css/main.css">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"
        integrity="sha512-DTOQO9RWCH3ppGqcWaEA1BIZOC6xxalwEsw9c2QQeAIftl+Vegovlnee1c9QX4TctnWMn13TZye+giMm8e2LwA=="
        crossorigin="anonymous" referrerpolicy="no-referrer">
  <style>
    .writing-container {{ max-width: 900px; margin: 0 auto; padding: 2rem; }}
    .writing-header {{ margin-bottom: 2rem; padding-bottom: 2rem; border-bottom: 1px solid var(--border-color); }}
    .writing-title {{ font-size: 2.5rem; margin-bottom: 0.5rem; color: var(--text-primary); }}
    .writing-meta {{ display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem; }}
    .meta-item {{ display: flex; align-items: center; gap: 0.75rem; font-size: 1rem; color: var(--text-secondary); }}
    .meta-item i {{ color: var(--text-tertiary); width: 20px; }}
    .back-link {{ display: inline-flex; align-items: center; gap: 0.5rem; color: var(--accent-primary); text-decoration: none; margin-bottom: 2rem; font-size: 1rem; }}
    .back-link:hover {{ text-decoration: underline; }}
    .education-content {{ color: var(--text-primary); line-height: 1.7; font-size: 1rem; }}
    .education-content p {{ margin-bottom: 1.25rem; }}
    .education-content ul {{ margin-left: 2rem; margin-bottom: 1.25rem; }}
    .education-content li {{ margin-bottom: 0.75rem; }}
    .education-content h2, .education-content h3, .education-content h4 {{ margin-top: 2rem; margin-bottom: 1rem; color: var(--text-primary); }}
  </style>
</head>
<body>
  <header class="site-header">
    <div class="header-content">
      <div class="header-main">
        <div class="header-left"><a href="../../" class="site-title">Avery</a></div>
        <div class="header-right">
          <button id="theme-toggle" class="theme-toggle" aria-label="Toggle theme" title="Toggle theme">🌙</button>
        </div>
      </div>
    </div>
  </header>
  <main class="writing-container">
    <a href="../../" class="back-link"><i class="fas fa-arrow-left"></i> Back to Home</a>
    <div class="writing-header">
      <h1 class="writing-title">{school}</h1>
      <div class="writing-meta">
        <div class="meta-item"><i class="fas fa-graduation-cap"></i><strong>{degree}</strong></div>
        <div class="meta-item"><i class="fas fa-map-marker-alt"></i>{location}</div>
        <div class="meta-item"><i class="fas fa-calendar"></i>{dates}</div>
        {gpa_line}
      </div>
    </div>
    <div class="education-content">{content}</div>
  </main>
  <script type="module">
    import {{ initTheme }} from '../../js/theme.js';
    initTheme();
  </script>
</body>
</html>'''

        # Generate education pages
        edu_dir = os.path.join(repo_root, 'writing', 'education')
        os.makedirs(edu_dir, exist_ok=True)

        for edu in education:
            slug = slugify(edu['school'])
            gpa_line = f'<div class="meta-item"><i class="fas fa-star"></i>{edu["gpa"]}</div>' if edu.get('gpa') else ''

            html = edu_template.format(
                title=edu['school'],
                description=edu['degree'],
                school=edu['school'],
                degree=edu['degree'],
                location=edu['location'],
                dates=edu['dates'],
                gpa_line=gpa_line,
                content=edu['description_html']
            )

            filepath = os.path.join(edu_dir, f'{slug}.html')
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(html)

            print(f"  ✓ Generated: writing/education/{slug}.html")

        print(f"\n✅ Generated {len(experience)} experience and {len(education)} education detail pages")

    except Exception as e:
        print(f"WARNING: Failed to generate detail pages: {e}")
        # Don't fail the whole process if detail pages fail


def main():
    """Main execution with defensive coding."""
    # Load configuration
    resume_url = load_config()

    if not resume_url:
        print("\n⏭️  Resume data extraction skipped")
        print("To enable: add 'resume_source_url' to data/site-config.yml")
        sys.exit(0)  # Exit successfully (not an error)

    # Fetch resume HTML
    html_content = fetch_resume_html(resume_url)

    if not html_content:
        print("\n⚠️  Failed to fetch resume - keeping existing data files")
        sys.exit(0)  # Don't fail the workflow, just skip

    # Parse HTML
    try:
        soup = BeautifulSoup(html_content, 'html.parser')
    except Exception as e:
        print(f"\n⚠️  Failed to parse HTML: {e}")
        print("Keeping existing data files")
        sys.exit(0)

    # Extract data
    print("\nExtracting experience...")
    experience = parse_experience(soup)

    print("\nExtracting education...")
    education = parse_education(soup)

    # Validate we got something
    if not experience and not education:
        print("\n⚠️  No data extracted - keeping existing data files")
        sys.exit(0)

    # Generate tiles
    print("\nGenerating tiles...")
    success = generate_tiles(experience, education)

    if success:
        print(f"\n{'='*50}")
        print("✅ Resume data extraction complete!")
        print(f"   Experience tiles: {len(experience)}")
        print(f"   Education tiles: {len(education)}")
        print(f"   Total tiles: {len(experience) + len(education)}")
        print(f"{'='*50}")
    else:
        print("\n⚠️  Failed to generate tiles - keeping existing data")
        sys.exit(0)


if __name__ == '__main__':
    main()
