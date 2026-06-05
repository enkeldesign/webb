const loadOptionalDesign = () => {
  const params = new URLSearchParams(window.location.search);
  const design = params.get("design");

  const optionalDesigns = {
    "enkel-grid": "/enkel-grid.css?v=20260604",
    "aspect-grid": "/enkel-aspect-grid.css?v=20260605"
  };

  const href = optionalDesigns[design];

  if (!href) {
    return;
  }

  if (document.querySelector(`link[rel="stylesheet"][href="${href}"]`)) {
    return;
  }

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  link.dataset.enkelDesign = design;
  document.head.append(link);
};

loadOptionalDesign();

const copyEmail = () => {
  const email = "erik@enkel.design";
  navigator.clipboard.writeText(email)
    .then(() => {
      alert(`${email} kopierat till urklipp.`);
    })
    .catch(err => {
      console.error('Error copying text:', err);
    });
};
