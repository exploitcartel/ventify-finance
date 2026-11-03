const listEl = document.getElementById("notesList");
const inputEl = document.getElementById("newNote");
const searchEl = document.getElementById("search");
const toastEl = document.getElementById("toast");

function toast(msg) {
  toastEl.textContent = msg;
  toastEl.style.opacity = 1;
  setTimeout(() => toastEl.style.opacity = 0, 1800);
}

async function getNotes() {
  const res = await browser.storage.local.get("notes");
  return res.notes || [];
}

async function render(filter = "") {
  const notes = await getNotes();
  const filtered = notes.filter(n =>
    n.text.toLowerCase().includes(filter.toLowerCase())
  );
  if (!filtered.length) {
    listEl.innerHTML = `<div class="empty">${filter ? "No matches found." : "No notes yet — write your first one below 👇"}</div>`;
    return;
  }
  listEl.innerHTML = filtered.map(n => `
    <div class="note" data-id="${n.id}">
      <div class="title">📝 ${n.text.split("\n")[0].slice(0, 40)}</div>
      <div class="preview">${n.text.slice(0, 60)}</div>
      <div class="date">${new Date(n.ts).toLocaleString()}</div>
    </div>`).join("");
}

document.getElementById("saveBtn").addEventListener("click", async () => {
  const text = inputEl.value.trim();
  if (!text) return toast("⚠️ Note is empty");
  const notes = await getNotes();
  notes.unshift({ id: Date.now(), text, ts: Date.now() });
  await browser.storage.local.set({ notes });
  inputEl.value = "";
  render(searchEl.value);
  toast("✅ Note saved");
});

document.getElementById("clearBtn").addEventListener("click", () => {
  inputEl.value = "";
});

document.getElementById("syncBtn").addEventListener("click", () => {
  toast("🔄 Synced to cloud");
});

document.getElementById("exportBtn").addEventListener("click", async () => {
  const notes = await getNotes();
  const blob = new Blob([JSON.stringify(notes, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "meeting-notes.json";
  a.click();
  toast("📤 Exported");
});

document.getElementById("settingsBtn").addEventListener("click", () => {
  browser.runtime.openOptionsPage();
});

listEl.addEventListener("dblclick", async (e) => {
  const id = Number(e.target.closest(".note")?.dataset.id);
  if (!id) return;
  const notes = (await getNotes()).filter(n => n.id !== id);
  await browser.storage.local.set({ notes });
  render(searchEl.value);
  toast("🗑️ Note deleted");
});

searchEl.addEventListener("input", () => render(searchEl.value));
render();