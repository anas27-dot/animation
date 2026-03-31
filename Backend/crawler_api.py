#!/usr/bin/env python3
"""
Headless Crawler API - Complete Text Extractor
Extracts ALL visible text content from web pages for RAG systems.
Ignores Images, PDFs, and Binary files completely.
"""

import os
import json
import time
import re
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
from typing import List, Dict, Optional
import sys

# Company information will be passed as command line arguments

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
]

IGNORED_EXTENSIONS = (
    '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.webp', '.ico',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.zip', '.tar', '.gz', '.rar', '.7z',
    '.mp3', '.mp4', '.avi', '.mov', '.wmv',
    '.css', '.js', '.xml', '.json'
)

def is_blog_post(url):
    """
    Returns True if the URL looks like a blog post (dates, 'blog', 'category').
    Troika Tech specific: Blogs often have dates /2024/01/ or years in slugs
    """
    u = url.lower()

    # 1. Date Patterns (e.g., /2023/12/10/)
    if re.search(r'/\d{4}/\d{2}/', u): return True

    # 2. Year patterns in URL slugs (e.g., -2023-, -2024-)
    if re.search(r'-\d{4}-', u): return True

    # 3. Blog Keywords
    if '/blog' in u or '/news' in u or '/category' in u or '/tag' in u or '/author' in u: return True

    # 4. Specific Exclusion for "Insights" or "Case Studies" if you don't want them
    if '/insight' in u: return True

    return False

def get_page(url: str, session: requests.Session) -> Optional[BeautifulSoup]:
    """Fetch webpage"""
    try:
        time.sleep(0.2)  # Even shorter delay for faster testing
        session.headers['User-Agent'] = USER_AGENTS[0]
        response = session.get(url, timeout=10, allow_redirects=True)  # Reduced timeout
        response.raise_for_status()
        return BeautifulSoup(response.content, 'html.parser')
    except Exception as e:
        print(f"Error fetching {url}: {str(e)}", file=sys.stderr)
        return None

def extract_page_content(soup: BeautifulSoup, url: str) -> Dict:
    """
    Extracts meaningful text.
    Crucial Step: Removes Nav/Footer BEFORE getting text.
    """

    # 1. Clean Garbage Elements
    # We remove these tags entirely so their text doesn't pollute the output
    for element in soup.find_all(['script', 'style', 'nav', 'header', 'footer', 'aside', 'noscript', 'iframe', 'svg', 'img', 'form', 'button', 'input']):
        element.decompose()

    # 2. Clean by Class Name (Common garbage containers)
    # Removes elements with class names like 'sidebar', 'cookie', 'popup'
    garbage_patterns = re.compile(r'sidebar|cookie|popup|modal|social-share|related-posts|comment', re.I)
    for div in soup.find_all('div', class_=garbage_patterns):
        div.decompose()

    # 3. Extract Title
    title = soup.title.get_text(strip=True) if soup.title else "Untitled"
    h1 = soup.find('h1')
    if h1:
        title = h1.get_text(strip=True)

    # 4. Extract Text from the "Cleaned" Body
    # We use a newline separator to keep paragraphs distinct
    if soup.body:
        raw_text = soup.body.get_text(separator='\n', strip=True)
    else:
        raw_text = ""

    # 5. Post-Processing: Clean up whitespace and short lines
    clean_lines = []
    for line in raw_text.split('\n'):
        line = line.strip()
        # Keep lines that look like sentences or headers (more than 30 chars, or ends with punctuation)
        if len(line) > 30 or (len(line) > 5 and line[0].isupper()):
            clean_lines.append(line)

    final_description = "\n\n".join(clean_lines)

    return {
        'title': title,
        'description': final_description,
        'url': url,
        'is_product_page': True, # Keep True so it saves
        'images': []
    }

def crawl_url(url: str, search_keyword: str = None) -> Dict:
    """Crawl a single URL and extract product data"""
    session = requests.Session()

    soup = get_page(url, session)
    if not soup:
        return {
            'success': False,
            'error': 'Could not fetch page',
            'url': url
        }

    # Extract product data
    product_data = extract_page_content(soup, url)

    # If search keyword provided, filter by relevance
    if search_keyword and product_data['is_product_page']:
        keyword_lower = search_keyword.lower()
        title_lower = product_data['title'].lower()
        desc_lower = product_data.get('description', '').lower()

        # Check if keyword matches
        if keyword_lower not in title_lower and keyword_lower not in desc_lower:
            # Not relevant to search
            return {
                'success': False,
                'error': 'Product does not match search keyword',
                'url': url
            }

    return {
        'success': True,
        'product': product_data,
        'url': url
    }

def search_and_crawl(base_url: str, search_keyword: str, max_pages: int = 5) -> List[Dict]:
    """Search for products matching keyword and crawl them"""
    session = requests.Session()
    results = []
    visited = set()

    # Ensure base_url ends with /
    if not base_url.endswith('/'):
        base_url = base_url + '/'

    # For IndiaMART, try different search URL formats
    if 'indiamart.com' in base_url:
        # Try IndiaMART search URLs
        search_urls = [
            f"{base_url}search.php?q={search_keyword}",
            f"{base_url}dir/{search_keyword}/",
            f"{base_url}search/{search_keyword}/",
            base_url  # Fallback to homepage
        ]
        queue = search_urls
    else:
        # For other sites, start with base URL
        queue = [base_url]

    while queue and len(results) < max_pages:
        current_url = queue.pop(0)

        if current_url in visited:
            continue

        visited.add(current_url)

        soup = get_page(current_url, session)
        if not soup:
            continue

        # Extract product data
        product_data = extract_page_content(soup, current_url)

        # Check if it matches search keyword (skip filtering if None)
        if product_data['is_product_page']:
            if search_keyword is None:
                # No keyword filtering - include all pages
                results.append({
                    'success': True,
                    'product': product_data
                })
            else:
                # Apply keyword filtering
                keyword_lower = search_keyword.lower()
                title_lower = product_data['title'].lower()
                desc_lower = product_data.get('description', '').lower()

                if keyword_lower in title_lower or keyword_lower in desc_lower:
                    results.append({
                        'success': True,
                        'product': product_data
                    })

        # Extract links for further crawling (especially product links)
        if len(results) < max_pages:
            links = soup.find_all('a', href=True)

            for link in links[:20]:  # Check more links for product pages
                href = link.get('href', '')
                if not href or href.startswith('#') or href.startswith('javascript:'):
                    continue

                full_url = urljoin(current_url, href)
                parsed = urlparse(full_url)

                # Same domain only
                if parsed.netloc == urlparse(base_url).netloc:
                    # Prioritize product pages (check URL path and link text)
                    link_text = link.get_text(strip=True).lower()
                    url_path = parsed.path.lower()

                    # Check if link looks like a product page
                    is_product_link = False
                    if search_keyword:
                        keyword_lower = search_keyword.lower()
                        is_product_link = (
                            'product' in url_path or
                            'item' in url_path or
                            keyword_lower in link_text or
                            keyword_lower in url_path
                        )

                    if full_url not in visited and full_url not in queue:
                        if is_product_link:
                            # Add product links to front of queue
                            queue.insert(0, full_url)
                        else:
                            queue.append(full_url)

    return results

def get_menu_links(soup, base_url):
    """
    WordPress-First Strategy:
    Look for standard WP Menu IDs first. Fallback to smart detection only if failed.
    """
    menu_links = set()
    found_menu = None

    # 1. PRIORITY: Standard WordPress Menu Selectors
    wp_selectors = [
        {'id': 'primary-menu'},           # Most common WP
        {'id': 'menu-primary'},
        {'class_': 'main-navigation'},    # Twenty-Twenty themes
        {'class_': 'primary-navigation'},
        {'class_': 'elementor-nav-menu'}, # Elementor (Troika likely uses this)
        {'id': 'top-menu'},               # Divi
        {'class_': 'fusion-main-menu'},   # Avada
        {'class_': 'astra-menu'},         # Astra
        {'id': 'main-nav'},
        {'class_': 'nav-menu'}
    ]

    print("[WP] Scanning for WordPress Primary Menu...")

    for selector in wp_selectors:
        if 'id' in selector: found_menu = soup.find(id=selector['id'])
        elif 'class_' in selector: found_menu = soup.find(class_=selector['class_'])

        if found_menu:
            print(f"[WP] Found Standard Menu: {selector}")
            break
        else:
            print(f"[WP] Tried selector {selector} - not found")

    # 2. Smart Detection: Find main navigation by context and content
    if not found_menu:
        print("[WP] Standard WP menu not found. Using smart detection...")

        # Look for elements that are likely to contain main navigation
        candidates = []

        # Check all potential containers
        containers = soup.find_all(['nav', 'header', 'div', 'section'])
        print(f"[WP] Analyzing {len(containers)} potential containers...")

        for i, container in enumerate(containers):
            # Skip obvious non-menu areas
            classes = container.get('class', [])
            class_str = ' '.join(classes).lower() if classes else ''

            # Skip footers, sidebars, widgets
            if any(skip in class_str for skip in ['footer', 'sidebar', 'widget', 'social', 'share', 'recent', 'archive', 'tag', 'category']):
                continue

            # Get links in this container
            links = container.find_all('a', href=True)
            if not links or len(links) < 3 or len(links) > 20:
                continue

            # Score this container
            score = 0

            # Position bonuses - prioritize headers strongly
            if container.name == 'header':
                score += 50  # Headers are most likely to contain main navigation
            if container.name == 'nav':
                score += 40  # Strong semantic signal
            if 'nav' in class_str or 'menu' in class_str:
                score += 30  # Class name indicates navigation
            if 'main' in class_str or 'primary' in class_str:
                score += 20  # Primary/main indicators
            if 'elementor' in class_str or 'nm-header' in class_str:
                score += 15  # WordPress/Elementor specific

            # Content analysis - prioritize classic navigation keywords
            link_texts = [link.get_text().strip().lower() for link in links[:12]]  # First 12 links
            main_nav_keywords = ['home', 'about', 'services', 'contact', 'products', 'portfolio', 'company']
            secondary_keywords = ['ai', 'agent', 'blog', 'news', 'work', 'projects']

            main_matches = sum(1 for text in link_texts if any(keyword in text for keyword in main_nav_keywords))
            secondary_matches = sum(1 for text in link_texts if any(keyword in text for keyword in secondary_keywords))

            score += main_matches * 10  # 10 points for main nav keywords
            score += secondary_matches * 3  # 3 points for secondary keywords

            # Length analysis - main menus typically have 5-15 links
            if 5 <= len(links) <= 15:
                score += 10  # Perfect menu size
            elif len(links) > 20:
                score -= 15  # Too many links (probably not main menu)

            if score > 10:  # Only consider reasonable candidates
                candidates.append({
                    'container': container,
                    'score': score,
                    'links': len(links),
                    'tag': container.name,
                    'classes': class_str[:50]  # Truncate for display
                })
                print(f"[WP] Container {i+1}: {container.name} score={score}, {len(links)} links, classes='{class_str[:50]}'")

        # Pick the highest scoring container
        if candidates:
            best = max(candidates, key=lambda x: x['score'])
            found_menu = best['container']
            print(f"[WP] Selected best container: {best['tag']} (score={best['score']}, {best['links']} links)")

    # 3. Extract & Filter Links
    # If still nothing, do NOT crawl the whole page (prevents blog crawling)
    source_links = found_menu.find_all('a', href=True) if found_menu else []

    print(f"[WP] Analyzing {len(source_links)} links found in menu...")

    for link in source_links:
        href = link['href'].strip()
        if not href or href.startswith(('#', 'javascript:', 'mailto:', 'tel:')): continue

        full_url = urljoin(base_url, href)
        parsed = urlparse(full_url)

        # Strict Domain Check
        if parsed.netloc == urlparse(base_url).netloc:
            # BLOCK BLOG POSTS
            if is_blog_post(full_url):
                print(f"[WP] Skipping Blog: {full_url}")
                continue

            # Block Files
            if not parsed.path.lower().endswith(IGNORED_EXTENSIONS):
                menu_links.add(full_url)

    # 4. Emergency Fallback: If 0 links found (broken menu), add just the homepage
    if not menu_links:
        print("[WP] No menu links found. Crawling only Homepage.")
        menu_links.add(base_url)

    return list(menu_links)

def menu_based_crawl(base_url: str, max_pages: int = 5) -> List[Dict]:
    """Smart crawling for business websites - extract actual menu links"""
    session = requests.Session()
    results = []

    print(f"[MENU] Fetching homepage: {base_url}")
    soup = get_page(base_url, session)
    if not soup:
        return [{'success': False, 'error': 'Could not fetch homepage', 'url': base_url}]

    # Extract menu links from a fresh copy (before cleaning)
    menu_soup = get_page(base_url, session)  # Fresh copy for menu extraction
    menu_links = get_menu_links(menu_soup, base_url) if menu_soup else []
    print(f"[MENU] Found {len(menu_links)} navigation links")


    # Extract homepage content (this will clean the soup)
    homepage_data = extract_page_content(soup, base_url)
    results.append({
        'success': True,
        'product': homepage_data
    })

    # Ensure Homepage is included
    if base_url not in menu_links: menu_links.insert(0, base_url)

    print(f"[WP] Targets locked: {len(menu_links)} pages (Blogs excluded)")

    # Crawl pages (limit applied)
    pages_to_crawl = menu_links[:max_pages]

    # Process pages
    for i, link in enumerate(pages_to_crawl):
        if link == base_url:  # Skip homepage since we already processed it
            continue

        page_soup = get_page(link, session)
        if page_soup:
            page_data = extract_page_content(page_soup, link)
            # Only add if it has meaningful content
            if page_data.get('description') and len(page_data['description']) > 100:
                results.append({
                    'success': True,
                    'product': page_data
                })
                print(f"[MENU] Added page with {len(page_data['description'])} chars")
            else:
                print(f"[MENU] Skipped page - insufficient content")
        else:
            print(f"[MENU] Failed to fetch: {link}")
        time.sleep(0.5)

    return results

def ingest_to_backend(data, company_id=None, api_key=None):
    # Update with your actual endpoint
    api_url = "http://localhost:5000/api/context/embeddings"

    # Prepare content for embedding storage
    content = data.get('description', '')
    if not content or len(content.strip()) < 50:
        # Clean title for display
        display_title = data.get('title', 'No Title')
        if display_title:
            display_title = display_title.encode('ascii', 'ignore').decode('ascii')
        else:
            display_title = 'No Title'
        print(f"[SKIP] Content too short or empty for: {display_title}")
        return

    # Create embedding document
    embedding_doc = {
        "chatbotId": company_id,
        "content": content,
        "embedding": [0.0] * 1536,  # Zero vector placeholder
        "metadata": {
            "source": "Python Crawler",
            "title": data.get('title', 'No Title'),
            "url": data.get('url'),
            "crawledAt": "2026-01-20T00:00:00.000Z",
            "wordCount": len(content.split()) if content else 0
        }
    }

    payload = {
        "embeddings": [embedding_doc],
        "companyId": company_id
    }

    try:
        # Clean title for display
        display_title = data.get('title', 'No Title')
        if display_title:
            display_title = display_title.encode('ascii', 'ignore').decode('ascii')
        else:
            display_title = 'No Title'

        print(f"[EMBED] Storing crawled content directly{company_id and f' for company {company_id}' or ''}: {display_title}")

        # Include API key in headers if provided
        headers = {}
        if api_key:
            headers['x-api-key'] = api_key

        r = requests.post(api_url, json=payload, headers=headers, timeout=30)
        print(f"[EMBED] Response status: {r.status_code}")

        if r.status_code == 200:
            print(f"[SAVE] Stored crawled content in embeddings{company_id and f' for company {company_id}' or ''}: {display_title}")
        else:
            # Clean response text for display
            response_text = r.text.encode('ascii', 'ignore').decode('ascii') if r.text else 'No response'
            print(f"[ERROR] Failed to store in embeddings{company_id and f' for company {company_id}' or ''} - {display_title}: {response_text}")
    except Exception as e:
        display_title = data.get('title', 'No Title')
        if display_title:
            display_title = display_title.encode('ascii', 'ignore').decode('ascii')
        else:
            display_title = 'No Title'
        # Clean exception message for display
        error_msg = str(e).encode('ascii', 'ignore').decode('ascii')
        print(f"[ERROR] Exception storing in embeddings{company_id and f' for company {company_id}' or ''} - {display_title}: {error_msg}")

def main():
    if len(sys.argv) < 2:
        # Default cron behavior
        TARGET = "https://troikaplus.in/"
        print(f"[CRON] Starting Scheduled Crawl: {TARGET}")
        data = search_and_crawl(TARGET, None, max_pages=5)
        saved_count = 0
        for item in data:
            if item.get('success'):
                ingest_to_backend(item['product'], None)
                saved_count += 1
        print(f"[CRON] Completed: {saved_count} pages saved to Knowledge Base")

    elif len(sys.argv) == 4:
        # Automated crawling with company ID and API key
        target_url = sys.argv[1]
        company_id = sys.argv[2]
        api_key = sys.argv[3]
        print(f"[AUTOMATED] Starting Crawl for: {target_url} (Company: {company_id})")

        # Detect if this is a business website
        is_business_site = any(keyword in target_url.lower() for keyword in [
            'troika', 'tech', 'services', 'consulting', 'agency', 'solutions'
        ])

        if is_business_site:
            print(f"[AUTOMATED] Detected business website - using menu-based crawling")
            data = menu_based_crawl(target_url, max_pages=15)
        else:
            data = search_and_crawl(target_url, None, max_pages=5)

        saved_count = 0
        for item in data:
            if item.get('success'):
                ingest_to_backend(item['product'], company_id, api_key)
                saved_count += 1
        print(f"[AUTOMATED] Completed: {saved_count} pages saved for company {company_id}")

    else:
        # Manual CLI modes
        url = sys.argv[1]

        if len(sys.argv) >= 3 and (sys.argv[2].isdigit() or sys.argv[2] in ['any', 'all', 'menu']):
            max_pages = int(sys.argv[2]) if sys.argv[2].isdigit() else 10
            print(f"[MANUAL] Menu crawling: {url} (max {max_pages} pages)")

            # Detect if this is a business website
            is_business_site = any(keyword in url.lower() for keyword in [
                'troika', 'tech', 'services', 'consulting', 'agency', 'solutions'
            ])

            if is_business_site:
                print(f"[MANUAL] Detected business website - using menu-based crawling")
                results = menu_based_crawl(url, max_pages=max_pages)
            else:
                results = search_and_crawl(url, None, max_pages=max_pages)

            print(json.dumps({'results': results}, indent=2))
        elif len(sys.argv) >= 3:
            search_keyword = sys.argv[2]
            max_pages = int(sys.argv[3]) if len(sys.argv) > 3 else 10
            print(f"[MANUAL] Searching '{search_keyword}' on: {url}")
            results = search_and_crawl(url, search_keyword, max_pages=max_pages)
            print(json.dumps({'results': results}, indent=2))
        else:
            print(f"[MANUAL] Single page extraction: {url}")
            res = crawl_url(url)
            print(json.dumps(res, indent=2))

if __name__ == "__main__":
    main()