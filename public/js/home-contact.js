// Ventify Finance - homepage contact form. Illustrative only, like the
// dashboard charts above it - there is no backend endpoint behind this
// form, it just confirms the message locally. Real inquiries go to the
// account-manager contacts listed next to the form.
(function () {
  const form = document.getElementById("home-contact-form");
  const msg = document.getElementById("home-contact-msg");
  if (!form || !msg) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("cf-name").value.trim();
    msg.textContent = `Thanks${name ? ", " + name : ""} - your message has been noted. ` +
      "An account manager will follow up by email shortly.";
    msg.classList.add("ok");
    form.reset();
  });
})();
