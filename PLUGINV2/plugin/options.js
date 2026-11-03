document.getElementById("autosync").addEventListener("change", async (e) => {
  await browser.storage.local.set({ autosync: e.target.value });
});
document.getElementById("theme").addEventListener("change", async (e) => {
  await browser.storage.local.set({ theme: e.target.value });
});
(async () => {
  const s = await browser.storage.local.get(["autosync", "theme"]);
  if (s.autosync) document.getElementById("autosync").value = s.autosync;
  if (s.theme) document.getElementById("theme").value = s.theme;
})();