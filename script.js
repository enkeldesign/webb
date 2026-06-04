const loadOptionalDesign = () => {
  const params = new URLSearchParams(window.location.search);

  if (params.get("design") !== "enkel-grid") {
    return;
  }

  const href = "/enkel-grid.css?v=20260604";

  if (document.querySelector(`link[rel="stylesheet"][href="${href}"]`)) {
    return;
  }

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  link.dataset.enkelDesign = "grid";
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