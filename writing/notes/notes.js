import { initTheme } from '../../js/theme.js';
import { noteBySlug } from './corpus.generated.mjs';

const app = document.querySelector('#notes-app');
const initialSlug = app?.dataset.initialNote;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
let panes = [];
let resizeFrame;

initTheme();

if (app && noteBySlug.has(initialSlug)) enhance();

function enhance() {
  const statePath = validPath(history.state?.notePath) || [initialSlug];
  panes = statePath.map(makePane);
  app.classList.add('is-enhanced');
  app.innerHTML = `<div class="stack-viewport" aria-label="Reading path"><div class="stack-track"></div></div>`;
  render({ focus: false, announce: false });
  history.replaceState({ ...(history.state || {}), notePath: slugs() }, '', location.href);
  addEventListener('popstate', onPopState);
  addEventListener('resize', () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => render({ focus: false, announce: false }));
  });
}

function validPath(path) {
  return Array.isArray(path) && path.length && path.every((slug) => noteBySlug.has(slug)) ? path : null;
}

function slugs() { return panes.map((pane) => pane.noteId); }

function makePane(noteId, depth = 0) {
  return { noteId, depth, active: false, presentationMode: 'full', width: 0 };
}

function computePresentation() {
  const history = panes.slice(0, -1);
  const viewport = app.clientWidth || innerWidth;
  const mobile = viewport < 640;
  const currentMin = mobile ? Math.max(260, viewport - 46) : Math.min(760, Math.max(540, viewport * 0.52));
  const historyBudget = Math.max(mobile ? 38 : 140, viewport - currentMin);
  const compact = mobile ? 38 : 54;
  const desired = history.map((_, index) => {
    const recency = history.length - index;
    if (mobile) return compact;
    if (recency === 1) return Math.min(520, viewport * .38);
    if (recency === 2) return 240;
    if (recency === 3) return 120;
    return compact;
  });
  const totalDesired = desired.reduce((sum, width) => sum + width, 0);
  if (totalDesired > historyBudget) {
    let excess = totalDesired - historyBudget;
    for (let i = 0; i < desired.length && excess > 0; i++) {
      const reducible = Math.max(0, desired[i] - compact);
      const reduction = Math.min(reducible, excess);
      desired[i] -= reduction;
      excess -= reduction;
    }
  }
  history.forEach((pane, index) => {
    pane.width = desired[index];
    pane.active = false;
    pane.presentationMode = desired[index] <= compact + 4 ? 'compact' : desired[index] < 260 ? 'partial' : 'full';
  });
  const current = panes.at(-1);
  current.active = true;
  current.presentationMode = 'full';
  current.width = 0;
  let offset = 0;
  history.forEach((pane) => {
    pane.offset = offset;
    offset += pane.width;
  });
  current.offset = offset;
  return { trackWidth: Math.max(viewport, offset + currentMin), mobile };
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
  viewportEl.scrollLeft = Math.max(0, active.offset + (trackWidth - active.offset) - viewportEl.clientWidth);
  document.title = `${noteBySlug.get(active.noteId).title} — Notes — Avery`;
  if (focus) trackEl.querySelector('.stack-pane--active h1')?.focus({ preventScroll: true });
  if (announce) announcePath();
}

function paneHTML(pane) {
  const note = noteBySlug.get(pane.noteId);
  const activeClass = pane.active ? ' stack-pane--active' : '';
  const paneContent = pane.active || pane.presentationMode === 'full'
    ? articleHTML(note)
    : `<div class="pane-label"><span class="history-depth">${String(pane.depth + 1).padStart(2, '0')}</span><strong>${note.title}</strong>${pane.presentationMode === 'partial' ? `<span>${note.summary}</span>` : ''}</div>`;
  const content = pane.active ? paneContent : `<div class="pane-inactive-content" aria-hidden="true">${paneContent}</div>`;
  const returnControl = pane.active ? '' : `<button class="pane-return" data-depth="${pane.depth}" aria-label="Return to ${note.title}, step ${pane.depth + 1} of ${panes.length}"></button>`;
  return `<section class="stack-pane stack-pane--${pane.presentationMode}${activeClass}" style="--pane-left:${pane.offset}px;--pane-exposure:${pane.width}px;--pane-z:${pane.depth + 1}" ${pane.active ? 'aria-current="page"' : ''}>${content}${returnControl}</section>`;
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
  app.querySelectorAll('.pane-return[data-depth]').forEach((button) => button.addEventListener('click', () => navigateBack(Number(button.dataset.depth))));
  app.querySelectorAll('[data-note-link]').forEach((link) => link.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    openNote(link.dataset.noteLink);
  }));
  app.querySelector('.stack-pane--active')?.addEventListener('keydown', (event) => {
    if (event.altKey && event.key === 'ArrowLeft' && panes.length > 1) {
      event.preventDefault();
      navigateBack(panes.length - 2);
    }
  });
}

function openNote(slug) {
  if (!noteBySlug.has(slug)) return;
  panes.push(makePane(slug, panes.length));
  commit(slug, 'forward');
}

function navigateBack(depth) {
  const target = panes[depth];
  if (!target) return;
  panes = panes.slice(0, depth + 1);
  commit(target.noteId, 'back');
}

function commit(slug, direction) {
  history.pushState({ notePath: slugs() }, '', `./${slug}.html`);
  app.dataset.direction = direction;
  render({ focus: true });
  if (!reduceMotion.matches) setTimeout(() => delete app.dataset.direction, 380);
}

function onPopState(event) {
  const path = validPath(event.state?.notePath);
  const slug = location.pathname.split('/').pop().replace('.html', '') || initialSlug;
  panes = (path || [noteBySlug.has(slug) ? slug : initialSlug]).map(makePane);
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
