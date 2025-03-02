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