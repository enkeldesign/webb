(() => {
  'use strict';

  const SCALE = 0.75;
  const SCALE_ATTRIBUTE = 'data-turn-ui-baseline-scale';
  const NORMALIZED_ATTRIBUTE = 'data-turn-ui-baseline-normalized';
  const ABSOLUTE_LENGTH_UNITS = new Set(['px', 'rem']);
  const processedSheets = new WeakSet();
  const pendingLinks = new WeakSet();

  const diagnostics = {
    scale: SCALE,
    stylesheets: 0,
    rules: 0,
    declarations: 0,
    mediaQueries: 0,
    htmlLengths: 0,
    protectedFormControls: 0,
    inaccessibleStylesheets: 0
  };

  function formatNumber(value) {
    const rounded = Math.round((value + Number.EPSILON) * 10000) / 10000;
    if (Object.is(rounded, -0) || Math.abs(rounded) < 0.00005) return '0';
    return String(rounded);
  }

  function startsUrlFunction(source, index) {
    return source.slice(index, index + 4).toLowerCase() === 'url(';
  }

  function copyFunctionVerbatim(source, start) {
    let index = start;
    let depth = 0;
    let quote = '';
    for (; index < source.length; index += 1) {
      const char = source[index];
      if (quote) {
        if (char === '\\') {
          index += 1;
          continue;
        }
        if (char === quote) quote = '';
        continue;
      }
      if (char === '"' || char === "'") {
        quote = char;
        continue;
      }
      if (char === '(') depth += 1;
      if (char === ')') {
        depth -= 1;
        if (depth === 0) return source.slice(start, index + 1);
      }
    }
    return source.slice(start);
  }

  function scaleAbsoluteLengths(source) {
    const text = String(source ?? '');
    let result = '';
    let index = 0;
    let quote = '';

    while (index < text.length) {
      const char = text[index];

      if (quote) {
        result += char;
        if (char === '\\' && index + 1 < text.length) {
          result += text[index + 1];
          index += 2;
          continue;
        }
        if (char === quote) quote = '';
        index += 1;
        continue;
      }

      if (char === '"' || char === "'") {
        quote = char;
        result += char;
        index += 1;
        continue;
      }

      if (startsUrlFunction(text, index)) {
        const verbatim = copyFunctionVerbatim(text, index);
        result += verbatim;
        index += verbatim.length;
        continue;
      }

      const previous = index > 0 ? text[index - 1] : '';
      const canStartNumber = !previous || !/[A-Za-z0-9_-]/.test(previous);
      if (canStartNumber) {
        const match = text.slice(index).match(/^(-?(?:\d+(?:\.\d*)?|\.\d+))(px|rem)\b/i);
        if (match && ABSOLUTE_LENGTH_UNITS.has(match[2].toLowerCase())) {
          const scaled = Number(match[1]) * SCALE;
          result += `${formatNumber(scaled)}${match[2]}`;
          index += match[0].length;
          continue;
        }
      }

      result += char;
      index += 1;
    }

    return result;
  }

  function selectorTargetsRoot(selectorText) {
    const selector = String(selectorText || '');
    return selector.split(',').some((part) => {
      const trimmed = part.trim();
      return trimmed === ':root' || trimmed === 'html' || /^html(?:[.#[:]|\s|>|\+|~)/.test(trimmed);
    });
  }

  function scaleStyleDeclaration(style, selectorText = '') {
    if (!style) return;
    const properties = Array.from({ length: style.length }, (_, index) => style.item(index)).filter(Boolean);
    for (const property of properties) {
      const value = style.getPropertyValue(property);
      if (property === 'font-size' && selectorTargetsRoot(selectorText)) continue;
      const nextValue = scaleAbsoluteLengths(value);
      if (nextValue === value) continue;
      const priority = style.getPropertyPriority(property);
      style.setProperty(property, nextValue, priority);
      diagnostics.declarations += 1;
    }
  }

  function scaleRule(rule) {
    if (!rule) return;
    diagnostics.rules += 1;

    if (rule.media?.mediaText) {
      const currentMedia = rule.media.mediaText;
      const nextMedia = scaleAbsoluteLengths(currentMedia);
      if (nextMedia !== currentMedia) {
        try {
          rule.media.mediaText = nextMedia;
          diagnostics.mediaQueries += 1;
        } catch {
          // A browser may expose a read-only MediaList for a particular rule.
          // The declaration rules inside it are still safe to normalize.
        }
      }
    }

    if (rule.style) scaleStyleDeclaration(rule.style, rule.selectorText || '');

    if (rule.styleSheet) {
      processStylesheet(rule.styleSheet);
    }

    if (rule.cssRules) {
      for (const childRule of Array.from(rule.cssRules)) scaleRule(childRule);
    }
  }

  function processStylesheet(sheet) {
    if (!sheet || processedSheets.has(sheet)) return;
    let rules;
    try {
      rules = sheet.cssRules;
    } catch {
      diagnostics.inaccessibleStylesheets += 1;
      return;
    }
    processedSheets.add(sheet);
    diagnostics.stylesheets += 1;
    for (const rule of Array.from(rules || [])) scaleRule(rule);
    const owner = sheet.ownerNode;
    if (owner?.setAttribute) owner.setAttribute(NORMALIZED_ATTRIBUTE, '');
  }

  function processStylesheetNode(node) {
    if (!(node instanceof Element)) return;
    if (node.matches('style')) {
      processStylesheet(node.sheet);
      return;
    }
    if (node.matches('link[rel~="stylesheet"]')) {
      if (node.sheet) {
        processStylesheet(node.sheet);
        return;
      }
      if (pendingLinks.has(node)) return;
      pendingLinks.add(node);
      node.addEventListener('load', () => {
        pendingLinks.delete(node);
        processStylesheet(node.sheet);
      }, { once: true });
    }
  }

  function processStylesheetTree(root) {
    if (!(root instanceof Element)) return;
    processStylesheetNode(root);
    for (const node of root.querySelectorAll('style, link[rel~="stylesheet"]')) {
      processStylesheetNode(node);
    }
  }

  function scaleNumericHtmlLength(element, attributeName) {
    const raw = element.getAttribute(attributeName);
    if (!raw || !/^-?(?:\d+(?:\.\d*)?|\.\d+)(?:px)?$/i.test(raw.trim())) return;
    const unit = /px$/i.test(raw.trim()) ? 'px' : '';
    const value = Number.parseFloat(raw);
    const next = `${formatNumber(value * SCALE)}${unit}`;
    if (next === raw) return;
    element.setAttribute(attributeName, next);
    diagnostics.htmlLengths += 1;
  }

  function normalizePresentationalLengths(root) {
    if (!(root instanceof Element)) return;
    const candidates = root.matches('svg[width], svg[height], img[width], img[height]')
      ? [root]
      : [];
    candidates.push(...root.querySelectorAll('svg[width], svg[height], img[width], img[height]'));
    for (const element of candidates) {
      if (element.dataset.turnUiLengthNormalized === 'true') continue;
      scaleNumericHtmlLength(element, 'width');
      scaleNumericHtmlLength(element, 'height');
      element.dataset.turnUiLengthNormalized = 'true';
    }
  }

  const NON_TEXT_INPUT_TYPES = new Set([
    'button', 'checkbox', 'color', 'file', 'hidden', 'image',
    'radio', 'range', 'reset', 'submit'
  ]);

  function protectFormControl(control) {
    if (!(control instanceof Element)) return;
    if (control.matches('input') && NON_TEXT_INPUT_TYPES.has((control.getAttribute('type') || 'text').toLowerCase())) {
      return;
    }
    const size = Number.parseFloat(getComputedStyle(control).fontSize);
    if (!Number.isFinite(size) || size >= 16) return;
    control.style.setProperty('font-size', '16px', 'important');
    control.dataset.turnSafariTextZoomProtected = 'true';
    diagnostics.protectedFormControls += 1;
  }

  function protectFormControls(root) {
    if (!(root instanceof Element)) return;
    if (root.matches('input, select, textarea')) protectFormControl(root);
    for (const control of root.querySelectorAll('input, select, textarea')) protectFormControl(control);
  }

  function normalizeTree(root) {
    processStylesheetTree(root);
    normalizePresentationalLengths(root);
    protectFormControls(root);
  }

  function normalizeExistingDocument() {
    for (const sheet of Array.from(document.styleSheets)) processStylesheet(sheet);
    normalizePresentationalLengths(document.documentElement);
    protectFormControls(document.documentElement);
  }

  globalThis.__turnPageZoomBaselineTest = Object.freeze({
    scale: SCALE,
    scaleAbsoluteLengths,
    formatNumber,
    selectorTargetsRoot
  });

  if (typeof document === 'undefined' || typeof Element === 'undefined') return;

  document.documentElement.setAttribute(SCALE_ATTRIBUTE, String(SCALE));
  normalizeExistingDocument();

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'childList') {
        if (record.target instanceof Element && record.target.matches('style') && record.target.sheet) {
          processedSheets.delete(record.target.sheet);
          processStylesheet(record.target.sheet);
        }
        for (const node of record.addedNodes) {
          if (node instanceof Element) {
            normalizeTree(node);
          } else if (node.parentElement?.matches?.('style') && node.parentElement.sheet) {
            processedSheets.delete(node.parentElement.sheet);
            processStylesheet(node.parentElement.sheet);
          }
        }
        continue;
      }

      if (record.type === 'characterData') {
        const style = record.target.parentElement?.closest?.('style');
        if (style?.sheet) {
          processedSheets.delete(style.sheet);
          processStylesheet(style.sheet);
        }
      }
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true
  });

  const settle = () => {
    normalizeExistingDocument();
    globalThis.__turnPageZoomBaselineDiagnostics = Object.freeze({ ...diagnostics });
    window.dispatchEvent(new CustomEvent('turn:ui-baseline-normalized', {
      detail: globalThis.__turnPageZoomBaselineDiagnostics
    }));
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', settle, { once: true });
  } else {
    queueMicrotask(settle);
  }
})();
