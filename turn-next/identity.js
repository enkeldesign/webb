(() => {
  function rewriteInstallCopy(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    for (const node of nodes) {
      const current = node.nodeValue;
      const next = current.replace(/\bTURN\b(?! NEXT)/g, 'TURN NEXT');
      if (next !== current) node.nodeValue = next;
    }
  }

  function makeHiddenHook(tagName, id) {
    const element = document.createElement(tagName);
    element.id = id;
    element.hidden = true;
    element.setAttribute('aria-hidden', 'true');
    if (tagName === 'button') element.type = 'button';
    return element;
  }

  function retireLegacyStartPanel() {
    const intro = document.querySelector('#intro');
    if (!intro) return;

    intro.hidden = true;
    intro.className = 'turn-next-legacy-intro-shell';
    intro.setAttribute('aria-hidden', 'true');
    intro.removeAttribute('aria-labelledby');
    intro.replaceChildren(
      makeHiddenHook('button', 'motionButton'),
      makeHiddenHook('button', 'manualButton'),
      makeHiddenHook('p', 'status')
    );
    document.documentElement.dataset.turnLegacyStart = 'retired';
  }

  function installIdentity() {
    document.documentElement.dataset.turnDeployment = 'next';
    retireLegacyStartPanel();

    const gate = document.querySelector('#installGate');
    if (gate) {
      rewriteInstallCopy(gate);
      const observer = new MutationObserver(() => rewriteInstallCopy(gate));
      observer.observe(gate, { childList: true, subtree: true, characterData: true });
    }

    const source = globalThis.__TURN_BUILD__;
    console.info(`TURN NEXT: test runtime loaded from TURN ${source?.id || 'unknown source'}.`);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installIdentity, { once: true });
  } else {
    installIdentity();
  }
})();
