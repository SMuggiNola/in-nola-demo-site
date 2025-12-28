(() => {
  // ----- REQUIRED PAGE CONTEXT -----
  if (!window.BOOK_ID || !window.CHAPTER_ID) {
    console.warn("Notes UI: BOOK_ID or CHAPTER_ID not defined");
    return;
  }

  // ----- API CONFIG -----
  const API_BASE = "https://tragedy-notes.sean-muggivan.workers.dev";
  const NOTES_ENDPOINT =
    `${API_BASE}/notes?bookId=${encodeURIComponent(window.BOOK_ID)}` +
    `&chapterId=${encodeURIComponent(window.CHAPTER_ID)}`;

  // ----- EDITOR CONFIG -----
  const EDITORS = {
    "130303": "JJ",
    "140404": "Tony"
  };

  let EDITING_NOTE_ID = null;

  // ----- CREATE NOTES BUTTON -----
  const openBtn = document.createElement("button");
  openBtn.id = "open-notes";
  openBtn.textContent = "Notes";
  document.body.appendChild(openBtn);

  // ----- CREATE PANEL -----
  const panel = document.createElement("div");
  panel.id = "notes-panel";
  panel.innerHTML = `
    <div class="notes-header">
      <span>Notes & Commentary</span>
      <button id="close-notes" aria-label="Close notes">×</button>
    </div>
    <div class="notes-body">
      <p class="notes-loading">Loading notes…</p>
    </div>
  `;
  document.body.appendChild(panel);

  const bodyEl = panel.querySelector(".notes-body");

  // ----- LOAD NOTES -----
  async function loadNotes() {
    const editorName = localStorage.getItem("notes_editor_name");
    const IS_EDITOR = Boolean(editorName);

    bodyEl.innerHTML = `<p class="notes-loading">Loading notes…</p>`;

    try {
      const res = await fetch(NOTES_ENDPOINT);
      if (!res.ok) throw new Error("Bad response");

      const data = await res.json();
      const notes = data.notes || [];

      bodyEl.innerHTML = "";

      // ---- UNLOCK UI ----
      if (!IS_EDITOR) {
        const unlock = document.createElement("div");
        unlock.className = "notes-unlock";
        unlock.innerHTML = `<button id="unlock-editor">Unlock Editor</button>`;
        bodyEl.appendChild(unlock);

        unlock.querySelector("#unlock-editor").onclick = () => {
          const pin = prompt("Enter 6-digit editor PIN:");
          if (EDITORS[pin]) {
            localStorage.setItem("notes_editor_name", EDITORS[pin]);
            loadNotes();
          } else {
            alert("Incorrect PIN.");
          }
        };
      }

      // ---- NOTES LIST ----
      if (!notes.length) {
        const empty = document.createElement("p");
        empty.className = "notes-empty";
        empty.textContent = "No notes for this chapter yet.";
        bodyEl.appendChild(empty);
      } else {
        notes.forEach(note => {
          const el = document.createElement("div");
          el.className = "note";
          el.innerHTML = `
            <div class="note-meta">
              <span class="note-author">${note.author}</span>
              <span class="note-date">
                ${new Date(note.timestamp).toLocaleDateString()}
              </span>
            </div>
            <div class="note-text">${note.text}</div>
          `;

          if (IS_EDITOR) {
            const actions = document.createElement("div");
            actions.className = "note-actions";
            actions.innerHTML = `
              <button data-edit>Edit</button>
              <button data-delete>Delete</button>
            `;
            el.appendChild(actions);

            actions.querySelector("[data-edit]").onclick = () => {
              document.getElementById("note-text").value = note.text;
              EDITING_NOTE_ID = note.id;
            };

            actions.querySelector("[data-delete]").onclick = async () => {
              if (!confirm("Delete this note?")) return;
              await deleteNote(note.id);
              loadNotes();
            };
          }

          bodyEl.appendChild(el);
        });
      }

      // ---- EDITOR UI ----
      if (IS_EDITOR) {
        const editor = document.createElement("div");
        editor.className = "notes-editor";
        editor.innerHTML = `
          <textarea id="note-text" placeholder="Add a note..."></textarea>
          <button id="save-note">Save Note</button>
          <button id="lock-editor">Lock Editor</button>
        `;
        bodyEl.appendChild(editor);

        editor.querySelector("#save-note").onclick = saveNote;

        editor.querySelector("#lock-editor").onclick = () => {
          localStorage.removeItem("notes_editor_name");
          EDITING_NOTE_ID = null;
          loadNotes();
        };
      }

    } catch (err) {
      bodyEl.innerHTML =
        `<p class="notes-error">Notes are unavailable right now.</p>`;
    }
  }

  // ----- SAVE / UPDATE NOTE -----
  async function saveNote() {
    const textarea = document.getElementById("note-text");
    const text = textarea.value.trim();
    if (!text) return;

    const method = EDITING_NOTE_ID ? "PUT" : "POST";

    await fetch(`${API_BASE}/notes`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer Mgv1lTI5X2gyRps4BJY502aH5u4DwLOw"
      },
      body: JSON.stringify({
        id: EDITING_NOTE_ID,
        bookId: window.BOOK_ID,
        chapterId: window.CHAPTER_ID,
        author: localStorage.getItem("notes_editor_name"),
        text
      })
    });

    textarea.value = "";
    EDITING_NOTE_ID = null;
    loadNotes();
  }

  // ----- DELETE NOTE -----
  async function deleteNote(id) {
    await fetch(`${API_BASE}/notes`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer Mgv1lTI5X2gyRps4BJY502aH5u4DwLOw"
      },
      body: JSON.stringify({
        id,
        bookId: window.BOOK_ID,
        chapterId: window.CHAPTER_ID
      })
    });
  }

  // ----- EVENTS -----
  openBtn.onclick = () => {
    panel.classList.add("open");
    loadNotes();
  };

  panel.querySelector("#close-notes").onclick = () => {
    panel.classList.remove("open");
  };

})();
