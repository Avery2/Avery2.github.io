import { initTheme } from '../../js/theme.js';
import { noteBySlug } from './corpus.generated.mjs';

const app = document.querySelector('#notes-app');
const initialSlug = app?.dataset.initialNote;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
let panes = [];
let expandedDepth = 0;
let resizeFrame;

initTheme();

if (app && noteBySlug.has(initialSlug)) enhance();

function enhance() {
  const statePath = validPath(history.state?.notePath) || [initialSlug];
  panes = statePath.map(makePane);
  expandedDepth = validExpandedDepth(history.state?.expandedDepth, panes.length);
  app.classList.add('is-enhanced');
  app.innerHTML = `<div class="stack-viewport" aria-label="Reading path"><div class="stack-track"></div></div>`;
  render({ focus: false, announce: false });
  history.replaceState({ ...(history.state || {}), notePath: slugs(), expandedDepth }, '', location.href);
  addEventListener('popstate', onPopState);
  addEventListener('resize', () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => render({ focus: false, announce: false }));
  });
}

function validPath(path) {
  return Array.isArray(path) && path.length && path.every((slug) => noteBySlug.has(slug)) ? path : null;
}

function validExpandedDepth(depth, length) {
  if (length < 2) return 0;
  return Number.isInteger(depth) && depth >= 0 && depth < length - 1 ? depth : length - 2;
}

function slugs() { return panes.map((pane) => pane.noteId); }

function makePane(noteId, depth = 0) {
  return { noteId, depth, active: false, expanded: false, presentationMode: 'compact', width: 0, offset: 0 };
}

function computePresentation() {
  const viewport = app.clientWidth || innerWidth;
  const mobile = viewport < 640;
  const compact = mobile ? 34 : 40;
  const currentIndex = panes.length - 1;
  expandedDepth = validExpandedDepth(expandedDepth, panes.length);
  const hasPair = panes.length > 1 && !mobile;
  const compactCount = hasPair ? Math.max(0, panes.length - 2) : Math.max(0, panes.length - 1);
  const minimumReader = mobile ? Math.max(280, viewport - compact) : 440;
  const availableForReaders = viewport - compactCount * compact;
  const readerWidth = hasPair ? Math.max(minimumReader, availableForReaders / 2) : Math.max(minimumReader, viewport - compactCount * compact);

  panes.forEach((pane, index) => {
    pane.active = index === currentIndex;
    pane.expanded = pane.active || (hasPair && index === expandedDepth);
    pane.presentationMode = pane.expanded ? 'full' : 'compact';
    pane.width = pane.expanded ? readerWidth : compact;
  });
  let offset = 0;
  panes.forEach((pane) => {
    pane.offset = offset;
    offset += pane.width;
  });
  return { trackWidth: Math.max(viewport, offset), mobile };
}

function render({ focus = false, announce = true } = {}) {
  panes.forEach((pane, index) => { pane.depth = index; });
  const { trackWidth } = computePresentation();
  const viewportEl = app.querySelector('.stack-viewport');
  const trackEl = app.querySelector('.stack-track');
  trackEl.style.width = `${trackWidth}px`;
  trackEl.innerHTML = panes.map(paneHTML).join('');
  bindInteractions();
  const active = panes.at(-1);
  viewportEl.scrollLeft = Math.max(0, active.offset + active.width - viewportEl.clientWidth);
  document.title = `${noteBySlug.get(active.noteId).title} — Notes — Avery`;
  if (focus) trackEl.querySelector('.stack-pane--active h1')?.focus({ preventScroll: true });
  if (announce) announcePath();
}

function paneHTML(pane) {
  const note = noteBySlug.get(pane.noteId);
  const activeClass = pane.active ? ' stack-pane--active' : '';
  const paneContent = pane.expanded
    ? articleHTML(note)
    : `<div class="pane-label"><span class="history-depth">${String(pane.depth + 1).padStart(2, '0')}</span><strong>${note.title}</strong></div>`;
  const content = pane.expanded ? paneContent : `<div class="pane-inactive-content" aria-hidden="true">${paneContent}</div>`;
  const returnControl = pane.expanded ? '' : `<button class="pane-return" data-depth="${pane.depth}" aria-label="Open ${note.title} beside the current note, step ${pane.depth + 1} of ${panes.length}"></button>`;
  const branchControl = pane.expanded && !pane.active ? `<button class="pane-make-current" data-truncate-depth="${pane.depth}">Continue from here</button>` : '';
  return `<section class="stack-pane stack-pane--${pane.presentationMode}${activeClass}${pane.expanded ? ' stack-pane--expanded' : ''}" style="--pane-left:${pane.offset}px;--pane-exposure:${pane.width}px;--pane-width:${pane.width}px;--pane-z:${pane.depth + 1}" ${pane.active ? 'aria-current="page"' : ''}>${content}${returnControl}${branchControl}</section>`;
}

function articleHTML(note) {
  const status = note.status === 'published' ? '' : `<span class="note-status note-status--${note.status}">${note.status}</span>`;
  const warning = note.ai_generated ? `<aside class="generated-note-notice" role="note"><strong>AI-generated example</strong><span>This is substantive prototype content written to test the linked-reading interface, not Avery’s published writing.</span></aside>` : '';
  const body = note.unavailable
    ? `<div class="unavailable-note"><p>This concept exists in the public graph, but its writing is not public.</p><p>No private note content is included in this site.</p></div>`
    : linkify(note.body);
  return `<article class="note-article" data-note="${note.slug}"><header class="note-header"><div class="note-kicker">${note.root_note ? 'About these notes' : 'Note'} ${status}</div><h1 tabindex="-1">${note.title}</h1><p class="note-summary">${note.summary}</p>${warning}</header><div class="note-body">${body}</div></article>`;
}

function linkify(body = '') {
  return body.replace(/\[\[([a-z0-9-]+)\|([^\]]+)\]\]/g, (_, slug, label) => `<a href="./${slug}.html" data-note-link="${slug}"${noteBySlug.get(slug)?.unavailable ? ' data-unavailable="true"' : ''}>${label}</a>`);
}

function bindInteractions() {
  app.querySelectorAll('.pane-return[data-depth]').forEach((button) => button.addEventListener('click', () => expandPane(Number(button.dataset.depth))));
  app.querySelectorAll('[data-truncate-depth]').forEach((button) => button.addEventListener('click', () => navigateBack(Number(button.dataset.truncateDepth))));
  app.querySelectorAll('[data-note-link]').forEach((link) => link.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const sourceDepth = Number(link.closest('.stack-pane')?.style.getPropertyValue('--pane-z')) - 1;
    openNote(link.dataset.noteLink, sourceDepth);
  }));
  app.querySelector('.stack-pane--active')?.addEventListener('keydown', (event) => {
    if (event.altKey && event.key === 'ArrowLeft' && panes.length > 1) {
      event.preventDefault();
      navigateBack(panes.length - 2);
    }
  });
}

function openNote(slug, sourceDepth = panes.length - 1) {
  if (!noteBySlug.has(slug)) return;
  if (Number.isInteger(sourceDepth) && sourceDepth >= 0 && sourceDepth < panes.length - 1) {
    panes = panes.slice(0, sourceDepth + 1);
  }
  panes.push(makePane(slug, panes.length));
  expandedDepth = Math.max(0, panes.length - 2);
  commit(slug, 'forward');
}

function expandPane(depth) {
  if (!panes[depth] || depth === panes.length - 1) return;
  expandedDepth = depth;
  history.replaceState({ ...(history.state || {}), notePath: slugs(), expandedDepth }, '', location.href);
  render({ focus: false, announce: false });
  app.querySelector(`.stack-pane[style*="--pane-z:${depth + 1}"] h1`)?.focus({ preventScroll: true });
}

function navigateBack(depth) {
  const target = panes[depth];
  if (!target) return;
  panes = panes.slice(0, depth + 1);
  expandedDepth = Math.max(0, panes.length - 2);
  commit(target.noteId, 'back');
}

function commit(slug, direction) {
  history.pushState({ notePath: slugs(), expandedDepth }, '', `./${slug}.html`);
  app.dataset.direction = direction;
  render({ focus: true });
  if (!reduceMotion.matches) setTimeout(() => delete app.dataset.direction, 380);
}

function onPopState(event) {
  const path = validPath(event.state?.notePath);
  const slug = location.pathname.split('/').pop().replace('.html', '') || initialSlug;
  panes = (path || [noteBySlug.has(slug) ? slug : initialSlug]).map(makePane);
  expandedDepth = validExpandedDepth(event.state?.expandedDepth, panes.length);
  app.dataset.direction = 'back';
  render({ focus: true });
}

function announcePath() {
  let live = document.querySelector('#notes-live');
  if (!live) {
    live = document.createElement('p');
    live.id = 'notes-live';
    live.className = 'sr-only';
    live.setAttribute('aria-live', 'polite');
    document.body.append(live);
  }
  live.textContent = `${noteBySlug.get(panes.at(-1).noteId).title}. Reading path depth ${panes.length}.`;
}
