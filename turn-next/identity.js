(() => {
  function rewriteInstallCopy(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    for (const node of nodes) {
      node.nodeValue = node.nodeValue.replace(/\bTURN\b(?! NEXT)/g, 'TURN NEXT');
    }
  }

  function installIdentity() {
    document.documentElement.dataset.turnDeployment = 'next';

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
