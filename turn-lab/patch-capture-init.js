(() => {
  const nativeFetch = window.fetch.bind(window);
  const patches = [];
  let stagedResponse = null;

  async function stageFetch(input, init) {
    if (stagedResponse) return stagedResponse.clone();
    return nativeFetch(input, init);
  }

  const pipeline = {
    nativeFetch,
    patches,
    stageFetch,
    setStagedResponse(response) {
      stagedResponse = response;
    },
    clearStagedResponse() {
      stagedResponse = null;
    }
  };

  globalThis.__turnLegacyPipeline = pipeline;
  globalThis.__turnCaptureLegacyPatch = (name) => {
    const patchFetch = window.fetch;
    if (patchFetch === stageFetch) {
      console.warn(`TURN LAB: legacy patch ${name} did not install a fetch transform.`);
      return false;
    }

    patches.push({ name, run: patchFetch });
    window.fetch = stageFetch;
    console.info(`TURN LAB: captured legacy patch ${name}.`);
    return true;
  };

  // Every legacy patch script captures this clean staging fetch instead of the previous patch.
  // The actual game request is handled later by legacy-bootstrap.js in one explicit pipeline.
  window.fetch = stageFetch;
})();