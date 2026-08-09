import { readdir, readFile, writeFile } from 'node:fs/promises';

const root = new URL('./', import.meta.url);
const contentDirectory = new URL('./content/', import.meta.url);

function parseValue(value) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;
  if (value.startsWith('"')) return JSON.parse(value);
  return value;
}

function parseNote(source, filename) {
  const match = source.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error(`${filename} is missing YAML frontmatter`);
  const metadata = Object.fromEntries(match[1].split('\n').filter(Boolean).map((line) => {
    const separator = line.indexOf(':');
    return [line.slice(0, separator).trim(), parseValue(line.slice(separator + 1).trim())];
  }));
  return { ...metadata, body: markdownToHTML(match[2].trim()) };
}

function escapeHTML(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function inlineMarkdown(value) {
  return escapeHTML(value)
    .replace(/\[\[([a-z0-9-]+)\|([^\]]+)\]\]/g, '[[$1|$2]]')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

function markdownToHTML(markdown) {
  if (!markdown) return '';
  return markdown.split(/\n\s*\n/).map((block) => {
    const text = block.split('\n').map((line) => line.trim()).join(' ');
    if (text.startsWith('> ')) return `<blockquote>${inlineMarkdown(text.slice(2))}</blockquote>`;
    return `<p>${inlineMarkdown(text)}</p>`;
  }).join('\n');
}

const files = (await readdir(contentDirectory)).filter((file) => file.endsWith('.md')).sort();
const notes = await Promise.all(files.map(async (file) => parseNote(await readFile(new URL(file, contentDirectory), 'utf8'), file)));
notes.sort((a, b) => Number(Boolean(b.root_note)) - Number(Boolean(a.root_note)) || a.title.localeCompare(b.title));
const noteBySlug = new Map(notes.map((note) => [note.slug, note]));

function linkify(body = '') {
  return body.replace(/\[\[([a-z0-9-]+)\|([^\]]+)\]\]/g, (_, slug, label) => {
    const target = noteBySlug.get(slug);
    if (!target) throw new Error(`Broken note link: ${slug}`);
    const unavailable = target.unavailable ? ' data-unavailable="true"' : '';
    return `<a href="./${slug}.html" data-note-link="${slug}"${unavailable}>${label}</a>`;
  });
}

function article(note) {
  const status = note.status === 'published' ? '' : `<span class="note-status note-status--${note.status}">${note.status}</span>`;
  const warning = note.ai_generated ? `<aside class="generated-note-notice" role="note"><strong>AI-generated example</strong><span>This is substantive prototype content written to test the linked-reading interface, not Avery’s published writing.</span></aside>` : '';
  const body = note.unavailable
    ? `<div class="unavailable-note"><p>This concept exists in the public graph, but its writing is not public.</p><p>No private note content is included in this site.</p></div>`
    : linkify(note.body);
  return `<article class="note-article" data-note="${note.slug}">
    <header class="note-header">
      <div class="note-kicker">${note.root_note ? 'About these notes' : 'Note'} ${status}</div>
      <h1 tabindex="-1">${note.title}</h1>
      <p class="note-summary">${note.summary}</p>
      ${warning}
    </header>
    <div class="note-body">${body}</div>
  </article>`;
}

function page(note) {
  return `<!doctype html>
<html lang="en" data-theme="light">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${note.summary.replaceAll('"', '&quot;')}">
  <title>${note.title} — Notes — Avery</title>
  <link rel="stylesheet" href="../../css/main.css">
  <link rel="stylesheet" href="./notes.css">
  <script type="module" src="./notes.js"></script>
</head>
<body class="notes-page">
  <header class="notes-site-header">
    <a class="notes-brand" href="../../">Avery</a>
    <a class="notes-home" href="./notes.html">Notes</a>
    <button id="theme-toggle" class="notes-theme" type="button" aria-label="Toggle color theme">◐</button>
  </header>
  <main id="notes-app" class="notes-app" data-initial-note="${note.slug}">
    <div class="baseline-note">${article(note)}</div>
  </main>
  <noscript><p class="notes-noscript">The note remains readable without JavaScript; linked notes open as ordinary pages.</p></noscript>
</body>
</html>`;
}

await Promise.all(notes.map((note) => writeFile(new URL(`./${note.slug}.html`, root), page(note))));

const publicNotes = notes.filter((note) => !note.unavailable && !note.root_note);
const cards = publicNotes.map((note) => `<li><a href="./${note.slug}.html"><strong>${note.title}</strong><span>${note.summary}</span><small>${note.ai_generated ? 'AI example · ' : ''}${note.status}</small></a></li>`).join('\n');
await writeFile(new URL('./index.html', root), `<!doctype html><html lang="en" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Example notes — Avery</title><link rel="stylesheet" href="../../css/main.css"><link rel="stylesheet" href="./notes.css"><script type="module" src="./notes-index.js"></script></head><body class="notes-page notes-index-page"><header class="notes-site-header"><a class="notes-brand" href="../../">Avery</a><a class="notes-home" href="./notes.html">Notes</a><button id="theme-toggle" class="notes-theme" type="button" aria-label="Toggle color theme">◐</button></header><main class="notes-index"><header><p class="note-kicker">AI-generated prototype corpus</p><h1>Seeing and navigating information</h1><p>Substantive example writing created to test the linked-notes interaction. This is not presented as Avery’s published writing.</p></header><ul>${cards}</ul></main></body></html>`);

await writeFile(new URL('./corpus.generated.mjs', root), `// Generated by generate-pages.mjs from content/*.md. Do not edit directly.\nexport const notes = ${JSON.stringify(notes, null, 2)};\nexport const noteBySlug = new Map(notes.map((note) => [note.slug, note]));\n`);
