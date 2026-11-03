// Ventify Finance - "Forgot password" page. Illustrative only: there is no
// backend endpoint behind this, it just shows the generic confirmation a
// real password-reset flow would show (never reveals whether the email
// actually belongs to an account).
(function () {
  const form = document.getElementById("forgot-form");
  const sent = document.getElementById("forgot-sent");
  if (!form || !sent) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    form.classList.add("hidden");
    sent.classList.remove("hidden");
  });
})();
