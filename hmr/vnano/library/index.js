import './vnano.js';

const $v = (typeof globalThis !== 'undefined' && globalThis.$v) || window.$v;

export const {
    createApp, signal, computed, effect, batch, h, escapeHtml,
    patch, createContext, createPortal, forwardRef, createDOMNode, renderToString, hydrateNode, lazy, createRouter,
    If, Match, Case, Portal, Dynamic, Show, Fragment, Link, RouterView, html,
    Component, App, Suspense, KeepAlive, Delegator, LazyWrapper,
    ajaxSetup, ajax, get, post, getJSON, applyHMR
} = $v;

export default $v;