import type { ReactNode } from 'react'
import { Link } from 'react-router'

const CodeBlock = ({ children }: { children: string }) => (
    <pre
        className='
            font-mono text-[11px] leading-relaxed text-[#9be8ab] whitespace-pre-wrap wrap-break-word
            rounded-xl p-3 overflow-x-auto styled-scrollbar-dark
            bg-[linear-gradient(180deg,#1e2b23_0%,#0f1811_100%)]
            border border-[#1f3a28]
            shadow-[inset_0_1px_3px_rgba(0,0,0,0.8),0_1px_0_rgba(255,255,255,0.15)]
        '
    >
        {children.trim()}
    </pre>
)

const Section = ({ id, title, children }: { id: string; title: string; children: ReactNode }) => (
    <section id={id} className='scroll-mt-6 flex flex-col gap-3'>
        <h2 className='font-sans font-extrabold text-lg tracking-tight text-[#3a3d42]'>{title}</h2>
        <div className='flex flex-col gap-3 text-sm leading-relaxed text-[#54575e]'>{children}</div>
    </section>
)

const NAV = [
    ['quick-start', 'Quick start'],
    ['bs4-concepts', 'Learn BeautifulSoup'],
    ['github-actions', 'Automate on GitHub Actions'],
    ['cloud-hosting', 'Deploy to a cloud VM'],
] as const

const Docs = () => (
    <div className='min-h-screen w-full bg-[linear-gradient(180deg,#eef2ef_0%,#dde4de_100%)]'>
        <div className='w-full max-w-5xl mx-auto py-8 px-6 flex flex-col gap-8'>
            <div
                className='
                    flex items-center justify-between px-6 py-3.5 rounded-xl
                    bg-[linear-gradient(180deg,#d8dbe0_0%,#b6bac1_45%,#9a9ea6_46%,#babdc4_100%)]
                    border border-[#a5a9b0]
                    shadow-[inset_0_1px_0_rgba(255,255,255,0.6),inset_0_-3px_6px_rgba(0,0,0,0.15),0_2px_4px_rgba(0,0,0,0.25)]
                '
            >
                <Link to='/' className='flex items-center gap-2.5'>
                    <span className='w-1.5 h-1.5 rounded-full bg-[radial-gradient(circle_at_35%_30%,#8be8ab,#2f9e5c_60%,#14532d_100%)] shadow-[0_0_3px_1px_rgba(74,222,128,0.7),0_1px_1px_rgba(0,0,0,0.4)]' />
                    <span className='font-sans font-extrabold text-[15px] tracking-[0.14em] uppercase text-[#3a3d42] [text-shadow:0_1px_0_rgba(255,255,255,0.7),0_-1px_0_rgba(0,0,0,0.15)]'>
                        Site Inspector
                    </span>
                </Link>
                <Link
                    to='/search'
                    className='
                        px-4 py-2 rounded-lg font-sans font-bold text-xs tracking-[0.08em] uppercase text-white
                        bg-[linear-gradient(180deg,#4ade80_0%,#22a55e_50%,#15803d_51%,#22a55e_100%)]
                        border border-[#14532d] hover:brightness-110
                    '
                >
                    Open the app
                </Link>
            </div>

            <div className='flex flex-col gap-1'>
                <span className='font-mono text-[10px] tracking-[0.12em] uppercase text-[#5a5d64]'>Documentation</span>
                <h1 className='font-sans font-extrabold text-3xl tracking-tight text-[#3a3d42]'>
                    How this works, and why
                </h1>
                <p className='text-sm text-[#54575e] max-w-2xl'>
                    This tool doesn't just spit out a selector — every function it builds is real, readable
                    BeautifulSoup code. This page explains what that code is actually doing, so picking elements
                    visually here doubles as learning the library itself, plus how to run the result unattended
                    once you're happy with it.
                </p>
            </div>

            <div className='flex gap-8 items-start'>
                <nav className='hidden md:flex flex-col gap-1 sticky top-6 w-48 shrink-0'>
                    {NAV.map(([id, label]) => (
                        <a key={id} href={`#${id}`} className='text-xs font-semibold text-[#54575e] hover:text-[#166534] px-2 py-1.5 rounded-lg hover:bg-[#dcf3e4]'>
                            {label}
                        </a>
                    ))}
                </nav>

                <div className='flex flex-col gap-10 flex-1 min-w-0'>
                    <Section id='quick-start' title='Quick start'>
                        <ol className='list-decimal list-inside flex flex-col gap-1.5'>
                            <li>Paste a URL and click <b>Get Website content</b> — it renders in the preview on the left.</li>
                            <li>Pick a function <b>Type</b> (Header, Text, Links, List, Table, or Pagination), then click <b>Pick element</b>.</li>
                            <li>Click the element you want in the preview. A <b>Refine element</b> panel opens: use the breadcrumb to move to an ancestor, the "Contains" chips to descend into a child, and the Extract row to choose text, inner HTML, or a specific attribute.</li>
                            <li>Click <b>Use this</b>, name the function, and click <b>Create function</b>.</li>
                            <li>Repeat for anything else you need. Drag functions to reorder them, or click <b>edit</b> on any of them to fix a mistake.</li>
                            <li>Copy or download the generated Python — it's a complete, runnable script on its own.</li>
                        </ol>
                    </Section>

                    <Section id='bs4-concepts' title='Learn BeautifulSoup as you go'>
                        <p>Every pick in this app maps directly to a small, standard piece of BeautifulSoup. Here's the mapping.</p>

                        <p><b>CSS selectors are the whole targeting language.</b> <code>soup.select_one(sel)</code> returns the first match, <code>soup.select(sel)</code> returns all of them — exactly like <code>document.querySelector</code>/<code>querySelectorAll</code> in a browser. The selector this app writes for you (e.g. <code>#grid &gt; div.card &gt; span.name</code>) is nothing more than a CSS selector; you can hand-write your own instead of picking one, and BeautifulSoup will treat it identically.</p>
                        <CodeBlock>{`title = soup.select_one("h1.title")
rows = soup.select("table.results tr")`}</CodeBlock>

                        <p><b>Text vs. attributes.</b> Once you have an element, <code>.get_text(strip=True)</code> gets its visible text, <code>.decode_contents()</code> gets its inner HTML, and <code>.get("name")</code> gets any attribute — an image's <code>src</code>, a link's <code>href</code>, a <code>data-*</code> attribute, anything. This is exactly what the layer picker's Extract row is choosing between.</p>
                        <CodeBlock>{`img = soup.select_one("img.thumb")
src = img.get("src") if img else None`}</CodeBlock>

                        <p><b>A List function is just a loop.</b> Picking a repeating card/row and some fields inside it compiles to selecting every match and pulling each field out of each one — the standard "list of dicts" scraping pattern.</p>
                        <CodeBlock>{`items = soup.select("li.card")
results = []
for item in items:
    name = item.select_one("span.name")
    results.append({"name": name.get_text(strip=True) if name else None})`}</CodeBlock>

                        <p><b>Pagination is one of two loops.</b> "Next-page link" mode follows a picked link's <code>href</code>, resolved against the current URL with <code>urljoin</code>, until there isn't one. "URL pattern" mode is simpler when the site's pagination is just a page number in the URL — a plain <code>range()</code> loop with <code>.format(page=n)</code>.</p>
                        <CodeBlock>{`# next-page link
url = start_url
while url:
    soup = fetch_soup(url)
    ...
    next_href = get_next(soup)
    url = urljoin(url, next_href) if next_href else None

# URL pattern
for page in range(1, 11):
    soup = fetch_soup(URL_TEMPLATE.format(page=page))
    ...`}</CodeBlock>

                        <p><b>Parser choice and encoding matter.</b> The generated code uses <code>BeautifulSoup(response.content, "html5lib")</code> — raw bytes, not <code>response.text</code>, and the <code>html5lib</code> parser rather than the built-in <code>html.parser</code>. Both are deliberate: <code>html5lib</code> parses the way a browser does (e.g. it inserts the <code>&lt;tbody&gt;</code> a browser always adds to a table, which is why selectors picked from a live-rendered preview need it to match), and raw bytes let BeautifulSoup detect the real character encoding instead of <code>requests</code> silently guessing wrong when a server's <code>Content-Type</code> header omits a charset — the difference between <code>£10</code> and <code>Â£10</code>.</p>
                    </Section>

                    <Section id='github-actions' title='Automate on GitHub Actions'>
                        <p>To run a generated script on a schedule without keeping a machine on yourself, commit it to a GitHub repo and add a workflow like this. It installs dependencies, runs the script, and commits whatever it wrote (e.g. <code>results.json</code> if you enabled JSON export) back to the repo.</p>
                        <CodeBlock>{`# .github/workflows/scrape.yml
name: Scrape on a schedule

on:
  schedule:
    - cron: "0 6 * * *"   # once a day, 06:00 UTC — adjust as needed
  workflow_dispatch: {}    # lets you also trigger it manually from the Actions tab

jobs:
  scrape:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - run: pip install -r requirements.txt

      - run: python scraper.py

      - name: Commit results
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add results.json
          git diff --staged --quiet || git commit -m "Update scraped data"
          git push`}</CodeBlock>
                        <p>If the script writes a <code>requirements.txt</code>, generate one from the "pip install" comment at the top of the generated code. For the REST API service instead of a plain script, point a similarly scheduled workflow at <code>crawl_db.py</code> — see its own README (included in the downloaded zip) for the persistence details.</p>
                    </Section>

                    <Section id='cloud-hosting' title='Deploy to a cloud VM'>
                        <p>The generated REST API service ships with a Dockerfile, so any VM that can run Docker works — a small instance on any provider (a $5-6/month tier is plenty to start). These steps are provider-agnostic; the only provider-specific part is how you create the VM and open its firewall.</p>
                        <ol className='list-decimal list-inside flex flex-col gap-1.5'>
                            <li>Provision a small Ubuntu VM and SSH in.</li>
                            <li>Install Docker (<a className='underline' href='https://docs.docker.com/engine/install/' target='_blank' rel='noreferrer'>docs.docker.com/engine/install</a> has the current one-liner for Ubuntu).</li>
                            <li>Copy the unzipped API service onto the VM (<code>scp -r</code>, or push it to a git repo and <code>git clone</code> it there).</li>
                            <li>Build and run it:</li>
                        </ol>
                        <CodeBlock>{`docker build -t scraper-api .
docker run -d --restart unless-stopped \\
  -p 5001:5001 \\
  -v "$(pwd)/data:/app/data" \\
  scraper-api

# schedule crawl_db.py to keep data fresh — a plain crontab entry works:
crontab -e
# 0 * * * * docker exec <container-name> python crawl_db.py`}</CodeBlock>
                        <ol className='list-decimal list-inside flex flex-col gap-1.5' start={5}>
                            <li>Open port 5001 (or whatever you mapped) in the VM's firewall/security group.</li>
                            <li>For a real domain and HTTPS, put nginx in front of it as a reverse proxy and get a certificate with <a className='underline' href='https://certbot.eff.org/' target='_blank' rel='noreferrer'>certbot</a> — the Flask dev server the container runs should never be exposed directly to the internet on its own for anything beyond quick testing.</li>
                        </ol>
                        <p>The generated <code>app.py</code> has no authentication on any endpoint — add some (an API key header check is enough for most cases) before exposing this beyond your own network.</p>
                    </Section>
                </div>
            </div>
        </div>
    </div>
)

export default Docs
