import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { build } from 'esbuild';

async function mockAlerts() {
  const calls = [];
  let resolve;
  const Swal = { fire(options) { calls.push(options); return new Promise(done => { resolve = done; }); }, close() { resolve({ isConfirmed: false }); }, stopTimer() {}, resumeTimer() {} };
  let source = await readFile(new URL('../src/services/alerts.js', import.meta.url), 'utf8');
  source = source.split(/\r?\n/).filter(line => !line.startsWith('import ')).join('\n').replaceAll('export ', '');
  const context = vm.createContext({ Swal });
  vm.runInContext(source, context);
  return { context, calls, finish: confirmed => resolve({ isConfirmed: confirmed }) };
}

test('cancel and confirm return user choice; destructive actions focus Cancel', async () => {
  const { context, calls, finish } = await mockAlerts();
  const cancelled = context.confirmAction({ title: 'Delete card?', danger: true });
  assert.equal(calls[0].focusCancel, true);
  assert.equal(calls[0].showCancelButton, true);
  assert.equal(calls[0].keydownListenerCapture, true);
  finish(false); assert.equal(await cancelled, false);
  const accepted = context.confirmAction({ title: 'Import cards?' });
  finish(true); assert.equal(await accepted, true);
});

test('toasts wait for confirmations and concurrent actions cannot replace them', async () => {
  const { context, calls, finish } = await mockAlerts();
  const pending = context.confirmAction({ title: 'Import offers?' });
  context.showToast('An error occurred', 'error');
  assert.equal(calls.length, 1);
  assert.equal(await context.confirmAction({ title: 'Delete?' }), false);
  finish(false); await pending;
  assert.equal(calls.length, 2);
  assert.equal(calls[1].toast, true);
  assert.equal(calls[1].icon, 'error');
  finish(false);
});

test('confirmation can interrupt a toast safely', async () => {
  const { context, calls, finish } = await mockAlerts();
  context.showToast('Saved');
  const pending = context.confirmAction({ title: 'Edit card?' });
  await Promise.resolve();
  assert.equal(calls.length, 2);
  assert.equal(calls[1].title, 'Edit card?');
  finish(true); assert.equal(await pending, true);
});

test('admin actions and shared upload panels render without errors', async () => {
  const result = await build({ stdin: { contents: `
    import React from 'react';
    import { renderToStaticMarkup } from 'react-dom/server';
    import { AdminCardsPage } from './src/features/admin/pages/AdminCardsPage.jsx';
    import { AdminOffersPage } from './src/features/admin/pages/AdminOffersPage.jsx';
    import { BulkUploadPanel } from './src/features/admin/components/BulkUploadPanel.jsx';
    export const cards = renderToStaticMarkup(<AdminCardsPage onChanged={() => {}} />);
    export const offers = renderToStaticMarkup(<AdminOffersPage onChanged={() => {}} />);
    export const panels = ['cards', 'offers'].map(kind => renderToStaticMarkup(<BulkUploadPanel kind={kind} onUpload={() => {}} onComplete={() => {}} onDownloadTemplate={() => {}} />));
  `, resolveDir: process.cwd(), loader: 'jsx' }, bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic', define: { 'import.meta.env.BASE_URL': '"/"' }, loader: { '.css': 'empty' } });
  const module = { exports: {} };
  vm.runInNewContext(result.outputFiles[0].text, { module, exports: module.exports, require: createRequire(import.meta.url), console, process, TextEncoder, TextDecoder, setTimeout, clearTimeout, Buffer, URL, AbortController });
  for (const html of [module.exports.cards, module.exports.offers]) { assert.doesNotMatch(html, /Download template/); assert.match(html, /Bulk upload/); }
  assert.match(module.exports.cards, /Add card/); assert.match(module.exports.offers, /Add offer/);
  assert.match(module.exports.panels[0], /CSV or Excel/);
  assert.match(module.exports.panels[1], /Download Excel template/);
  assert.match(module.exports.panels[1], /accept=".xlsx"/);
});

async function uploadHarness(confirmed, kind = 'cards') {
  const confirmations = [], uploads = [], notifications = [];
  const result = await build({ entryPoints: ['src/features/admin/components/BulkUploadPanel.jsx'], bundle: true, write: false, platform: 'node', format: 'cjs', jsxFactory: 'h', plugins: [{ name: 'mock-ui', setup(build) {
    build.onResolve({ filter: /^react$/ }, () => ({ path: 'hooks', namespace: 'mock' }));
    build.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: 'export const useRef = value => ({current:value}); export const useState = value => [value, () => {}];' }));
    build.onResolve({ filter: /services\/alerts\.js$/ }, () => ({ path: 'alerts', namespace: 'alerts' }));
    build.onLoad({ filter: /.*/, namespace: 'alerts' }, () => ({ contents: 'export const confirmAction = globalThis.confirmAction; export const showToast = globalThis.showToast;' }));
  }}] });
  const module = { exports: {} };
  const context = { module, exports: module.exports, h: (type, props, ...children) => ({type, props: {...props, children}}), confirmAction: async options => { confirmations.push(options); return confirmed; }, showToast: (...args) => notifications.push(args) };
  vm.runInNewContext(result.outputFiles[0].text, context);
  const tree = module.exports.BulkUploadPanel({ kind, onUpload: async file => { uploads.push(file); return {cards_created: 1, duplicates_skipped: 0, rows_imported: 1}; }, onComplete: async () => {}, onDownloadTemplate: () => {} });
  function findInput(node) {
    if (!node || typeof node !== 'object') return null;
    if (node.type === 'input' && node.props.type === 'file') return node;
    for (const child of (Array.isArray(node) ? node : node.props?.children || [])) { const found = findInput(child); if (found) return found; }
  }
  const input = findInput(tree);
  return { confirmations, uploads, notifications, async select(file) { input.props.onChange({target:{files:[file], value:'selected'}}); for (let n=0;n<10;n++) await Promise.resolve(); } };
}

test('cancelled file selection makes no upload request', async () => {
  const app = await uploadHarness(false);
  await app.select({name:'cards.xlsx',size:100});
  assert.equal(app.confirmations.length, 1);
  assert.equal(app.uploads.length, 0);
});

test('confirmed Excel offers upload sends the selected file once and shows success', async () => {
  const app = await uploadHarness(true, 'offers');
  const file = {name:'offers.xlsx',size:100};
  await app.select(file);
  assert.equal(app.confirmations.length, 1);
  assert.equal(app.uploads.length, 1);
  assert.equal(app.uploads[0], file);
  assert.match(app.notifications[0][0], /offer rows imported/);
});

test('unsupported and oversized files show error toasts without upload or confirmation', async () => {
  const app = await uploadHarness(true, 'offers');
  await app.select({name:'offers.csv',size:100});
  await app.select({name:'offers.xlsx',size:11*1024*1024});
  assert.equal(app.confirmations.length, 0);
  assert.equal(app.uploads.length, 0);
  assert.equal(app.notifications.length, 2);
  assert.equal(app.notifications[0][1], 'error');
});

import { isCurrentOffer, nextOfferExpiryCheck } from '../src/services/offerExpiry.js';
test('user expiry guard removes offers at India midnight and always hides archives', () => {
  const before = Date.parse('2026-10-14T18:29:59Z');
  const after = Date.parse('2026-10-14T18:30:00Z');
  const offer = {expires_on: '2026-10-14T00:00:00Z'};
  assert.equal(isCurrentOffer(offer, before), true);
  assert.equal(isCurrentOffer(offer, after), false);
  assert.equal(isCurrentOffer({is_archived:true}, before), false);
  assert.equal(isCurrentOffer({}, after), true);
  assert.equal(nextOfferExpiryCheck(before), 1001);
});

import { matchesOfferSearch } from '../src/services/offerSearch.js';
test('offer search matches linked banks and card names with case-insensitive partial text', () => {
  const offer = {merchant_name:'Cinema', category:'MOVIES', offer_headline:'Weekend savings', coupon_code:'MOVIE500', applicable_master_card_ids:[1]};
  const cards = [{id:1,bank_name:'HDFC Bank',card_name:'Millennia'}, {id:2,bank_name:'Canara Bank',card_name:'Platinum'}];
  for (const search of ['HDFC', ' hDfC ', 'mill', 'Cinema', 'movie500', 'weekend', '']) assert.equal(matchesOfferSearch(offer,cards,search),true);
  assert.equal(matchesOfferSearch(offer,cards,'Canara'),false);
  assert.equal(matchesOfferSearch(offer,cards,'no match'),false);
});
