import { mkdir, writeFile } from 'node:fs/promises';
import { notes, noteBySlug } from './corpus.mjs';

const root = new URL('./', import.meta.url);

function linkify(body = '') {
  return body.replace(/\[\[([a-z0-9-]+)\|([^\]]+)\]\]/g, (_, slug, label) => {
    const target = noteBySlug.get(slug);
    const unavailable = target?.unavailable ? ' data-unavailable="true"' : '';
    return `<a href="./${slug}.html" data-note-link="${slug}"${unavailable}>${label}</a>`;
  });
}

function article(note) {
  const status = note.status === 'published' ? '' : `<span class="note-status note-status--${note.status}">${note.status}</span>`;
  const body = note.unavailable
    ? `<div class="unavailable-note"><p>This concept exists in the public graph, but its writing is not public.</p><p>No private note content is included in this site.</p></div>`
    : linkify(note.body);
  return `<article class="note-article" data-note="${note.slug}">
    <header class="note-header">
      <div class="note-kicker">Note ${status}</div>
      <h1 tabindex="-1">${note.title}</h1>
      <p class="note-summary">${note.summary}</p>
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
    <a class="notes-home" href="./">Notes</a>
    <button id="theme-toggle" class="notes-theme" type="button" aria-label="Toggle color theme">◐</button>
  </header>
  <main id="notes-app" class="notes-app" data-initial-note="${note.slug}">
    <div class="baseline-note">${article(note)}</div>
  </main>
  <noscript><p class="notes-noscript">The note remains readable without JavaScript; linked notes open as ordinary pages.</p></noscript>
</body>
</html>`;
}

await Promise.all(notes.map(async (note) => {
  await writeFile(new URL(`./${note.slug}.html`, root), page(note));
}));

const cards = notes.filter((note) => !note.unavailable).map((note) => `<li><a href="./${note.slug}.html"><strong>${note.title}</strong><span>${note.summary}</span><small>${note.status}</small></a></li>`).join('\n');
await writeFile(new URL('./index.html', root), `<!doctype html><html lang="en" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Notes — Avery</title><link rel="stylesheet" href="../../css/main.css"><link rel="stylesheet" href="./notes.css"><script type="module" src="./notes-index.js"></script></head><body class="notes-page notes-index-page"><header class="notes-site-header"><a class="notes-brand" href="../../">Avery</a><span class="notes-home" aria-current="page">Notes</span><button id="theme-toggle" class="notes-theme" type="button" aria-label="Toggle color theme">◐</button></header><main class="notes-index"><header><p class="note-kicker">Linked writing prototype</p><h1>Seeing and navigating information</h1><p>A small graph of concept-oriented notes. Follow links inside any note to build a spatial reading path.</p></header><ul>${cards}</ul></main></body></html>`);
