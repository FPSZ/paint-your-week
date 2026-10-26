import { $, el } from '../core/utils.js';
import { WD } from '../core/domain.js';

/* ================= DOM refs ================= */
export const scroller = $('#scroller'), gridEl = $('#grid'), gutter = $('#gutter'), colsBox = $('#cols'), bandsBox = $('#bands'), dayheads = $('#dayheads');
export const colEls = [], dhEls = [];
export const blockEls = new Map();
export const nowLine = el('div', 'nowline'), elapsedEl = el('div', 'elapsed'), nowTag = el('div', 'now-tag');
export const ghost = el('div', 'slot', '<span></span>');
export const layer = $('#layer');

export function setup() {
  for (let d = 0; d < 7; d++) {
    const c = el('div', 'col'); c.dataset.d = d; colsBox.appendChild(c); colEls.push(c);
    const h = el('div', 'dh', `<div class="dh-top"><span class="dh-wd">${WD[d]}</span><span class="dh-badge"></span></div><div class="dh-date"></div><div class="dh-bar"></div><div class="dh-meta"><span class="dn"></span><span class="fr"></span></div>`);
    h.dataset.d = d; dayheads.appendChild(h); dhEls.push(h);
  }
}
