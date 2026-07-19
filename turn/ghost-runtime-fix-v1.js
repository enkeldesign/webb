(() => {
  const upstreamFetch = window.fetch.bind(window);

  function replaceRequired(source, search, replacement, label) {
    const next = source.replace(search, replacement);
    if (next === source) console.warn(`TURN ghost runtime fix not applied: ${label}`);
    return next;
  }

  function patchGameSource(input) {
    let source = input;

    // Cloned competitor cars inherit a JSON-style copy of the original car's userData.
    // The original userData contains live Three.js wheel pivot references, so those copied
    // values must never be treated as Object3D instances by animateWheels(). Clear them on
    // every clone and keep wheel animation on the original ghost car only.
    source = replaceRequired(
      source,
      `    const car = ghostCar.clone(true);\n    car.visible = false;`,
      `    const car = ghostCar.clone(true);\n    car.userData.frontWheelPivots = [];\n    car.userData.wheelSpinners = [];\n    car.visible = false;`,
      'sanitize cloned competitor wheel references'
    );

    source = replaceRequired(
      source,
      '    animateWheels(car, frame.s, 45, dt);',
      `    if (car === ghostCar) animateWheels(car, frame.s, 45, dt);`,
      'avoid wheel animation on cloned competitors'
    );

    return source;
  }

  window.fetch = async (input, init) => {
    const response = await upstreamFetch(input, init);
    try {
      const rawUrl = typeof input === 'string' ? input : input?.url;
      const url = new URL(rawUrl, location.href);
      if (!url.pathname.endsWith('/turn/game.js')) return response;

      const source = await response.text();
      const patched = patchGameSource(source);
      return new Response(patched, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      });
    } catch (error) {
      console.warn('TURN ghost runtime fix failed, using upstream game source.', error);
      return response;
    }
  };
})();
