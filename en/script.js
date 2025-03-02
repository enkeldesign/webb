const copyEmail = () => {
  const email = "erik@enkel.design";
  navigator.clipboard.writeText(email)
    .then(() => {
      alert(`${email} copied to clipboard.`);
    })
    .catch(err => {
      console.error('Error copying text:', err);
    });
};