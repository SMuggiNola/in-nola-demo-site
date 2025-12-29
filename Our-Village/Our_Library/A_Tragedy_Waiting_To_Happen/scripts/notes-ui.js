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
  // Use RegExp constructor to avoid literal parsing issues
  const QUOTE_REGEX = new RegExp("^\\[QUOTE: ([\\s\\S]*?)\\]\\n+");

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

  // ----- HIGHLIGHTING HELPERS ----- 
  function clearHighlights() {
    document.querySelectorAll(".highlighted-text").forEach(el => {
      const parent = el.parentNode;
      if (parent) {
          parent.replaceChild(document.createTextNode(el.textContent), el);
          parent.normalize();
      }
    });
  }

  function highlightPassage(text, noteId) {
    const context = document.querySelector(".book-content");
    if (!context || !text) return false;

    // Simple text node walker to find matches in text nodes
    const walker = document.createTreeWalker(context, NodeFilter.SHOW_TEXT, null, false);
    while(walker.nextNode()) {
       const node = walker.currentNode;
       
       if (node.parentNode && node.parentNode.classList.contains("highlighted-text")) {
           continue;
       }

       const idx = node.nodeValue.indexOf(text);
       if (idx !== -1) {
          const range = document.createRange();
          range.setStart(node, idx);
          range.setEnd(node, idx + text.length);
          
          const span = document.createElement("span");
          span.className = "highlighted-text";
          span.dataset.noteId = noteId;
          span.title = "Click to view note";
          span.onclick = (e) => {
             e.stopPropagation();
             openPanelAndScrollTo(noteId);
          };
          
          try {
            range.surroundContents(span);
            return true;
          } catch (e) {
            console.warn("Notes UI: Could not highlight range:", e);
          }
       }
    }
    return false;
  }

  function openPanelAndScrollTo(noteId) {
    panel.classList.add("open");
    document.body.classList.add("with-notes-open");
    
    setTimeout(() => {
        const el = document.getElementById("note-" + noteId);
        if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            el.style.transition = "background-color 0.5s";
            el.style.backgroundColor = "rgba(212, 175, 55, 0.2)";
            setTimeout(() => el.style.backgroundColor = "", 1500);
        }
    }, 100);
  }

  // ----- HELPER: Render Single Note -----
  function renderNoteElement(item, displayNum, isEditor) {
      const note = item.original;
      const el = document.createElement("div");
      el.className = "note";
      el.id = "note-" + note.id;
      
      let headerHtml = `<div class="note-meta">`;
      if (displayNum) {
         headerHtml += `<span class="note-number">${displayNum}</span>`;
      }
      headerHtml += `
          <span class="note-author">${note.author}</span>
          <span class="note-date">
            ${new Date(note.timestamp).toLocaleDateString()}
          </span>
        </div>
      `;

      el.innerHTML = `
        ${headerHtml}
        ${item.quoteText ? `<div class="note-quote">“${item.quoteText}”</div>` : ""}
        <div class="note-text">${item.displayText}</div>
      `;

      if (isEditor) {
        const actions = document.createElement("div");
        actions.className = "note-actions";
        actions.innerHTML = `
          <button data-edit>Edit</button>
          <button data-delete>Delete</button>
        `;
        el.appendChild(actions);

        actions.querySelector("[data-edit]").onclick = () => {
          setupEditor(note.text, note.id);
        };

        actions.querySelector("[data-delete]").onclick = async () => {
          if (!confirm("Delete this note? ")) return;
          await deleteNote(note.id);
          loadNotes();
        };
      }
      return el;
  }

  // ----- LOAD NOTES ----- 
  async function loadNotes() {
    const editorName = localStorage.getItem("notes_editor_name");
    const IS_EDITOR = Boolean(editorName);

    bodyEl.innerHTML = `<p class="notes-loading">Loading notes…</p>`;
    clearHighlights();

    try {
      const res = await fetch(NOTES_ENDPOINT);
      if (!res.ok) throw new Error("Bad response");

      const data = await res.json();
      const notes = data.notes || [];

      // 1. First Pass: Create Highlights
      const processedNotes = notes.map(note => {
          let quoteText = null;
          let displayText = note.text;
          const match = note.text.match(QUOTE_REGEX);
          if (match) {
            quoteText = match[1];
            displayText = note.text.replace(QUOTE_REGEX, "");
            highlightPassage(quoteText, note.id);
          }
          return {
              original: note,
              quoteText,
              displayText,
              domOrder: 999999
          };
      });

      // 2. Identify Footnotes vs Endnotes based on actual highlighting success
      const highlights = document.querySelectorAll(".highlighted-text");
      const idToOrder = {}; // Map noteId -> visual number
      highlights.forEach((el, index) => {
          const id = el.dataset.noteId;
          idToOrder[id] = index + 1;
      });

      // Split into groups
      const footnotes = [];
      const endnotes = [];

      processedNotes.forEach(item => {
          const id = item.original.id;
          if (idToOrder[id]) {
              item.domOrder = idToOrder[id];
              footnotes.push(item);
          } else {
              endnotes.push(item);
          }
      });

      // Sort
      footnotes.sort((a, b) => a.domOrder - b.domOrder);
      // Endnotes sorted by date (newest first) or ID
      endnotes.sort((a, b) => b.original.timestamp - a.original.timestamp);

      // 3. Render
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

      if (!notes.length) {
        const empty = document.createElement("p");
        empty.className = "notes-empty";
        empty.textContent = "No notes for this chapter yet.";
        bodyEl.appendChild(empty);
      } else {
          // Render Footnotes
          if (footnotes.length > 0) {
              const h3 = document.createElement("h3");
              h3.className = "notes-section-title";
              h3.textContent = "Footnotes";
              bodyEl.appendChild(h3);

              footnotes.forEach(item => {
                  const num = idToOrder[item.original.id];
                  bodyEl.appendChild(renderNoteElement(item, num, IS_EDITOR));
              });
          }

          // Render Endnotes
          if (endnotes.length > 0) {
              const h3 = document.createElement("h3");
              h3.className = "notes-section-title";
              h3.textContent = "Endnotes";
              bodyEl.appendChild(h3);

              endnotes.forEach((item, idx) => {
                  // Number endnotes 1, 2, 3... separately
                  bodyEl.appendChild(renderNoteElement(item, idx + 1, IS_EDITOR));
              });
          }
      }

      // ---- EDITOR UI ---- 
      if (IS_EDITOR) {
        renderEditorArea();
      }

    } catch (err) {
      console.error(err);
      bodyEl.innerHTML =
        `<p class="notes-error">Notes are unavailable right now.</p>`;
    }
  }

  function renderEditorArea() {
      const existing = bodyEl.querySelector(".notes-editor");
      if(existing) existing.remove();

      const editor = document.createElement("div");
      editor.className = "notes-editor";
      editor.innerHTML = `
        <div class="editor-controls" style="margin-bottom:0.5rem; text-align: left;">
            <button id="insert-selection" style="width:auto; font-size: 0.7rem;">+ Quote Selection</button>
        </div>
        <textarea id="note-text" placeholder="Add a note…"></textarea>
        <button id="save-note">Save Note</button>
        <button id="cancel-edit" style="display:none;">Cancel</button>
        <button id="lock-editor">Lock Editor</button>
      `;
      bodyEl.appendChild(editor);

      editor.querySelector("#save-note").onclick = saveNote;
      editor.querySelector("#lock-editor").onclick = () => {
        localStorage.removeItem("notes_editor_name");
        EDITING_NOTE_ID = null;
        loadNotes();
      };
      
      const cancelBtn = editor.querySelector("#cancel-edit");
      cancelBtn.onclick = () => {
          resetEditor();
      };

      editor.querySelector("#insert-selection").onclick = () => {
          const selection = window.getSelection().toString().trim();
          if (!selection) {
              alert("Please select some text in the book first.");
              return;
          }
          const textarea = document.getElementById("note-text");
          if (textarea.value.match(QUOTE_REGEX)) {
             if(!confirm("Replace existing quote? ")) return;
             textarea.value = textarea.value.replace(QUOTE_REGEX, `[QUOTE: ${selection}]\
\
`);
          } else {
             const tag = `[QUOTE: ${selection}]\
\
`;
             textarea.value = tag + textarea.value;
          }
      };
  }

  function setupEditor(text, id) {
      if (!document.querySelector(".notes-editor")) {
          // Should be there
      }
      
      const textarea = document.getElementById("note-text");
      if(!textarea) return;

      textarea.value = text;
      EDITING_NOTE_ID = id;
      
      const cancelBtn = document.getElementById("cancel-edit");
      if(cancelBtn) cancelBtn.style.display = "inline-block";
      
      textarea.scrollIntoView({behavior: "smooth"});
  }
  
  function resetEditor() {
      const textarea = document.getElementById("note-text");
      if(textarea) textarea.value = "";
      EDITING_NOTE_ID = null;
      const cancelBtn = document.getElementById("cancel-edit");
      if(cancelBtn) cancelBtn.style.display = "none";
  }

  // ----- SAVE / UPDATE NOTE ----- 
  async function saveNote() {
    const textarea = document.getElementById("note-text");
    const text = textarea.value.trim();
    if (!text) return;

    const method = EDITING_NOTE_ID ? "PUT" : "POST";

    try {
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

        resetEditor();
        loadNotes();
    } catch(e) {
        alert("Failed to save note.");
        console.error(e);
    }
  }

  // ----- DELETE NOTE ----- 
  async function deleteNote(id) {
    try {
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
    } catch(e) {
        alert("Failed to delete note.");
    }
  }

  // ----- EVENTS ----- 
  openBtn.onclick = () => {
    panel.classList.add("open");
    document.body.classList.add("with-notes-open");
    loadNotes();
  };

  panel.querySelector("#close-notes").onclick = () => {
    panel.classList.remove("open");
    document.body.classList.remove("with-notes-open");
  };

  // ----- INIT ----- 
  loadNotes();

})();