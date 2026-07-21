/**
 * Shared Seanchas UI + API client — used by the index (seanchas.html) and the
 * per-scéal page (sceal.html). Depends on window.Session (js/main.js).
 *
 * Exposes window.SeanchasUI:
 *   .API           — fetch wrappers (feed, getOne, create, edit, del, comment,
 *                    delComment, activity, directory)
 *   .esc(str)      — html-escape
 *   .visLabel(v)   — badge label for a visibility value
 *   .init(opts)    — inject the shared modal; opts.onSaved(sceal), opts.onDeleted(id)
 *   .openAdd()     — open the "add a scéal" modal
 *   .openEdit(s)   — open the modal to edit scéal s
 *   .openDelete(s) — open the delete-confirm modal for scéal s
 */
(function () {
  var S = function () { return window.Session; };

  function esc(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var VIS_LABEL = { members: '☘ Members only', shared: '👁 Shared', private: '🔒 Private', public: 'Public' };
  function visLabel(v) { return VIS_LABEL[v || 'public'] || 'Public'; }

  function creds() {
    var s = S();
    return { username: s ? s.username() : '', apiToken: s ? s.apiToken() : '' };
  }
  function isLoggedIn() { var s = S(); return !!(s && s.isMember()); }

  async function req(method, path, bodyObj) {
    var opts = { method: method, headers: { 'Content-Type': 'application/json' } };
    if (bodyObj) opts.body = JSON.stringify(bodyObj);
    var res = await fetch('/api/seanchas' + path, opts);
    var ct = res.headers.get('content-type') || '';
    var data = ct.indexOf('application/json') !== -1 ? await res.json() : {};
    if (!res.ok) throw new Error(data.error || ('Request failed (' + res.status + ')'));
    return data;
  }

  var API = {
    feed: function () {
      return isLoggedIn()
        ? req('POST', '/feed', creds())
        : req('GET', '');
    },
    getOne: function (id, key) { var b = Object.assign({ id: id }, creds()); if (key) b.key = key; return req('POST', '/get', b); },
    share: function (id, action) { return req('POST', '/share', Object.assign({ id: id, action: action }, creds())); },
    create: function (p) { return req('POST', '', Object.assign({}, p, creds())); },
    edit: function (p) { return req('PUT', '', Object.assign({}, p, creds())); },
    del: function (id) { return req('DELETE', '', Object.assign({ id: id }, creds())); },
    comment: function (id, text) { return req('POST', '/comment', Object.assign({ id: id, text: text }, creds())); },
    delComment: function (id, commentId) { return req('POST', '/comment/delete', Object.assign({ id: id, commentId: commentId }, creds())); },
    activity: function () { return req('POST', '/activity', creds()); },
    directory: function () { return req('POST', '/directory', creds()); }
  };

  // ── image compression ────────────────────────────────────────────────
  function compressFromImage(img, maxW) {
    var canvas = document.createElement('canvas');
    var w = img.width, h = img.height;
    if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
    return { dataUrl: canvas.toDataURL('image/jpeg', 0.7), w: w, h: h };
  }
  function loadImageFromFile(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function (e) { var img = new Image(); img.onload = function () { resolve(img); }; img.onerror = reject; img.src = e.target.result; };
      reader.onerror = reject; reader.readAsDataURL(file);
    });
  }

  // ── shared styles ─────────────────────────────────────────────────────
  var CSS = `
  .sq-badge{display:inline-block;font-size:0.68rem;letter-spacing:0.03em;padding:0.12rem 0.5rem;border-radius:999px;border:1px solid rgba(212,167,38,0.4);color:var(--gold-light);background:rgba(212,167,38,0.12);}
  .sq-badge.private{border-color:rgba(248,113,113,0.5);color:#fca5a5;background:rgba(248,113,113,0.1);}
  .modal-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.9);z-index:1000;justify-content:center;align-items:center;padding:1rem;}
  .modal-overlay.active{display:flex;}
  .modal{background:#0a2818;border:1px solid rgba(212,167,38,0.4);border-radius:var(--radius);max-width:560px;width:100%;max-height:90vh;overflow-y:auto;padding:1.75rem;box-shadow:0 8px 32px rgba(0,0,0,0.6);}
  .modal h2{color:var(--gold);margin:0 0 0.25rem;font-size:1.4rem;}
  .modal .modal-sub{color:var(--text-secondary);font-size:0.9rem;margin:0 0 1.25rem;}
  .modal .form-group{margin-bottom:1rem;}
  .modal label{display:block;color:var(--gold);font-size:0.85rem;margin-bottom:0.3rem;}
  .modal label .opt{color:var(--text-secondary);font-weight:400;font-style:italic;}
  .modal input,.modal textarea,.modal select{width:100%;padding:0.65rem 0.85rem;border:1px solid var(--glass-border);border-radius:6px;background:rgba(0,0,0,0.2);color:var(--text-primary);font-size:0.95rem;font-family:inherit;}
  .modal input:focus,.modal textarea:focus,.modal select:focus{outline:none;border-color:var(--gold);}
  .modal textarea{min-height:150px;resize:vertical;}
  .modal .hint{font-size:0.78rem;color:var(--text-secondary);margin-top:0.25rem;}
  .modal .form-row{display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;}
  @media(max-width:500px){.modal .form-row{grid-template-columns:1fr;}}
  .modal input[type="file"]{padding:0.5rem;border:1px dashed var(--glass-border);cursor:pointer;font-size:0.85rem;}
  .modal .current-preview img{max-width:100%;max-height:140px;border-radius:6px;margin-top:0.5rem;}
  .modal .image-controls{margin-top:0.5rem;display:none;}
  .modal .image-controls label{font-size:0.72rem;color:var(--text-secondary);}
  .modal .image-controls input[type="range"]{width:100%;margin:0.2rem 0;accent-color:var(--gold);padding:0;border:none;background:transparent;}
  .modal .image-controls .size-info{font-size:0.7rem;color:var(--text-secondary);display:flex;justify-content:space-between;}
  .modal .remove-check{display:flex;align-items:center;gap:0.4rem;margin-top:0.4rem;font-size:0.8rem;color:#fca5a5;}
  .modal .remove-check input[type="checkbox"]{width:auto;}
  .sq-check{display:flex;align-items:center;gap:0.5rem;color:var(--text-primary);font-size:0.9rem;margin-top:0.4rem;cursor:pointer;}
  .sq-check input[type="checkbox"]{width:auto;}
  .share-picker{margin-top:0.5rem;}
  .share-list{max-height:160px;overflow-y:auto;border:1px solid var(--glass-border);border-radius:6px;padding:0.5rem 0.75rem;background:rgba(0,0,0,0.15);}
  .share-list label{display:flex;align-items:center;gap:0.5rem;color:var(--text-primary);font-size:0.9rem;padding:0.2rem 0;cursor:pointer;}
  .share-list input[type="checkbox"]{width:auto;}
  .share-list em{color:var(--text-secondary);font-size:0.85rem;}
  .modal-actions{display:flex;gap:0.75rem;margin-top:1.5rem;justify-content:flex-end;}
  .modal-actions button{padding:0.65rem 1.3rem;border-radius:6px;font-weight:600;cursor:pointer;transition:all 0.2s ease;}
  .modal-actions .cancel-btn{background:transparent;border:1px solid var(--glass-border);color:var(--text-secondary);}
  .modal-actions .cancel-btn:hover{border-color:var(--text-primary);color:var(--text-primary);}
  .modal-actions .save-btn{background:var(--gold);border:none;color:var(--green-900);}
  .modal-actions .save-btn:hover{transform:translateY(-1px);box-shadow:0 2px 8px rgba(212,167,38,0.4);}
  .modal-actions .save-btn:disabled{opacity:0.6;cursor:not-allowed;transform:none;box-shadow:none;}
  .modal-actions .delete-confirm-btn{background:#dc2626;border:none;color:#fff;}
  .modal-actions .delete-confirm-btn:hover{background:#b91c1c;}
  .modal-actions{flex-wrap:wrap;}
  .modal-actions .discard-btn{background:transparent;border:1px solid #f87171;color:#fca5a5;}
  .modal-actions .discard-btn:hover{background:rgba(248,113,113,0.12);}
  .delete-warning{color:#fca5a5;font-size:0.9rem;margin-bottom:1rem;}
  .modal-status{text-align:center;padding:0.75rem;border-radius:6px;margin-top:1rem;display:none;font-size:0.9rem;}
  .modal-status.success{display:block;background:rgba(34,197,94,0.2);color:#86efac;border:1px solid rgba(34,197,94,0.3);}
  .modal-status.error{display:block;background:rgba(239,68,68,0.2);color:#fca5a5;border:1px solid rgba(239,68,68,0.3);}
  `;

  var MODAL_HTML = `
  <div class="modal-overlay" id="sqModal">
    <div class="modal">
      <h2 id="sqModalTitle">Add a Scéal</h2>
      <p class="modal-sub" id="sqModalSub">Share a story for the seanchas — a memory, a family history, a moment worth keeping.</p>
      <form id="sqForm">
        <input type="hidden" id="sqId">
        <div class="form-group">
          <label for="sqTitle">Title of the scéal *</label>
          <input type="text" id="sqTitle" required placeholder="e.g., Ó Mongabháin → Muggivan">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="sqContributor">Your name *</label>
            <input type="text" id="sqContributor" required placeholder="Who is telling it">
          </div>
          <div class="form-group">
            <label for="sqPeople">Family / people <span class="opt">(optional)</span></label>
            <input type="text" id="sqPeople" placeholder="e.g., Muintir Mhongabháin">
          </div>
        </div>
        <div class="form-group">
          <label for="sqStory">The story * <span class="opt">(keep it on the short side)</span></label>
          <textarea id="sqStory" required placeholder="Tell it in your own words — a summary is perfect."></textarea>
        </div>
        <div class="form-group">
          <label for="sqNextSteps">Next steps <span class="opt">(optional)</span></label>
          <textarea id="sqNextSteps" style="min-height:80px;" placeholder="Where you'd like to take this next — records to check, questions to answer, leads to follow."></textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="sqPlace">Place <span class="opt">(optional)</span></label>
            <input type="text" id="sqPlace" placeholder="Townland, parish, or city">
          </div>
          <div class="form-group">
            <label for="sqEra">When <span class="opt">(optional)</span></label>
            <input type="text" id="sqEra" placeholder="e.g., 1840s">
          </div>
        </div>
        <div class="form-group">
          <label for="sqImage">Photo <span class="opt">(optional)</span></label>
          <input type="file" id="sqImage" accept="image/*">
          <div class="current-preview" id="sqImagePreview" style="display:none;"><img id="sqImagePreviewImg" alt="Photo preview"></div>
          <div class="image-controls" id="sqImageControls">
            <label>Resize: <span id="sqSizeLabel">800px</span> wide</label>
            <input type="range" id="sqSizeSlider" min="300" max="1200" step="50" value="800">
            <div class="size-info"><span id="sqDimLabel"></span><span id="sqKbLabel"></span></div>
          </div>
          <div class="remove-check" id="sqImageRemoveWrap" style="display:none;">
            <input type="checkbox" id="sqRemoveImage"><label for="sqRemoveImage" style="color:#fca5a5;">Remove current photo</label>
          </div>
        </div>
        <div class="form-group">
          <label for="sqVisibility">Who can read this scéal?</label>
          <select id="sqVisibility">
            <option value="public">Anyone visiting the site</option>
            <option value="members">Any IN-NOLA member</option>
            <option value="shared">Only members I choose</option>
            <option value="private">Only me (private)</option>
          </select>
          <div class="share-picker" id="sqSharePicker" style="display:none;">
            <p class="hint" style="margin:0.5rem 0 0.35rem;">Tick the members who may read it:</p>
            <div class="share-list" id="sqShareList"><em>Loading members…</em></div>
          </div>
        </div>
        <div class="form-group">
          <label for="sqSeanchasName">Seanchas <span class="opt">(which collection this belongs to)</span></label>
          <input type="text" id="sqSeanchasName" list="sqSeanchasNames" autocomplete="off" placeholder="e.g., Scéalta Sheáin Uí Mhongabháin">
          <datalist id="sqSeanchasNames"></datalist>
          <p class="hint">Type an existing seanchas to add to it (a family collection can span members), or a new name to start your own.</p>
        </div>
        <div class="form-group">
          <label class="sq-check"><input type="checkbox" id="sqCommentsOpen"> Welcome IN-NOLA member input (open comments)</label>
          <p class="hint">Members who can read this scéal will be able to comment and help the research along.</p>
        </div>
        <div class="modal-actions">
          <button type="button" class="cancel-btn" id="sqCancel">Cancel</button>
          <button type="submit" class="save-btn" id="sqSubmit">Add to the Seanchas</button>
        </div>
        <div class="modal-status" id="sqStatus"></div>
      </form>
    </div>
  </div>
  <div class="modal-overlay" id="sqDeleteModal">
    <div class="modal" style="max-width:400px;">
      <h2>Remove Scéal</h2>
      <p class="delete-warning">Remove "<span id="sqDeleteTitle"></span>"? This cannot be undone.</p>
      <input type="hidden" id="sqDeleteId">
      <div class="modal-actions">
        <button type="button" class="cancel-btn" id="sqDeleteCancel">Cancel</button>
        <button type="button" class="delete-confirm-btn" id="sqDeleteConfirm">Remove</button>
      </div>
    </div>
  </div>
  <div class="modal-overlay" id="sqCloseConfirm" style="z-index:1001;">
    <div class="modal" style="max-width:430px;">
      <h2>Unsaved changes</h2>
      <p class="modal-sub" style="margin-bottom:1.25rem;">You’ve made changes to this scéal. Save them, or close without saving?</p>
      <div class="modal-actions">
        <button type="button" class="cancel-btn" id="sqCloseKeep">Keep editing</button>
        <button type="button" class="discard-btn" id="sqCloseDiscard">Close without saving</button>
        <button type="button" class="save-btn" id="sqCloseSave">Save &amp; close</button>
      </div>
    </div>
  </div>`;

  // ── modal state ────────────────────────────────────────────────────────
  var pendingImage = null, rawImageEl = null, directoryCache = null;
  var formDirty = false; // true once the user edits any field in the open modal
  var cfg = { onSaved: function () {}, onDeleted: function () {} };
  var mounted = false;
  var isLocal = location.hostname === '127.0.0.1' || location.hostname === 'localhost' || location.port === '5500';

  function $(id) { return document.getElementById(id); }

  function updatePreview(maxW) {
    if (!rawImageEl) return;
    var r = compressFromImage(rawImageEl, maxW);
    pendingImage = r.dataUrl;
    $('sqImagePreviewImg').src = r.dataUrl;
    $('sqImagePreview').style.display = 'block';
    $('sqSizeLabel').textContent = maxW + 'px';
    $('sqDimLabel').textContent = r.w + ' × ' + r.h + 'px';
    $('sqKbLabel').textContent = '~' + Math.round(r.dataUrl.length * 3 / 4 / 1024) + ' KB';
  }

  async function loadDirectory() {
    if (directoryCache) return directoryCache;
    try { directoryCache = (await API.directory()).members || []; } catch (e) { directoryCache = []; }
    return directoryCache;
  }
  async function renderShareList(selectedIds) {
    var sel = {}; (selectedIds || []).forEach(function (x) { sel[x] = true; });
    var members = await loadDirectory();
    var wrap = $('sqShareList');
    if (!members.length) { wrap.innerHTML = '<em>No other members to share with yet.</em>'; return; }
    wrap.innerHTML = members.map(function (m) {
      return '<label><input type="checkbox" class="sq-share-cb" value="' + esc(m.memberId) + '"' + (sel[m.memberId] ? ' checked' : '') + '> ' + esc(m.name) + '</label>';
    }).join('');
  }
  function collectShared() {
    return Array.prototype.slice.call(document.querySelectorAll('#sqShareList .sq-share-cb')).filter(function (c) { return c.checked; }).map(function (c) { return c.value; });
  }

  // Populate the seanchas-name autocomplete from existing collections the viewer can see.
  // When setDefault, prefill the field with the member's most-recent seanchas (or their name).
  async function loadSeanchasNames(setDefault) {
    try {
      var d = await API.feed();
      var scealta = d.scealta || [];
      var names = [], seen = {};
      scealta.forEach(function (s) { if (s.seanchasName && !seen[s.seanchasName]) { seen[s.seanchasName] = 1; names.push(s.seanchasName); } });
      $('sqSeanchasNames').innerHTML = names.map(function (n) { return '<option value="' + esc(n) + '">'; }).join('');
      if (setDefault && S() && !formDirty) {
        var mine = scealta.filter(function (s) { return s.authorId === S().memberId(); });
        $('sqSeanchasName').value = mine.length ? mine[0].seanchasName : ('Scéalta ' + S().displayName());
      }
    } catch (e) { /* ignore */ }
  }

  function resetImage() {
    pendingImage = null; rawImageEl = null;
    $('sqImage').value = ''; $('sqImagePreview').style.display = 'none';
    $('sqImageControls').style.display = 'none'; $('sqImageRemoveWrap').style.display = 'none';
    $('sqRemoveImage').checked = false; $('sqSizeSlider').value = 800;
  }
  function status(msg, ok) { var el = $('sqStatus'); el.textContent = msg; el.className = 'modal-status ' + (ok ? 'success' : 'error'); }
  function hideStatus() { $('sqStatus').className = 'modal-status'; }
  function closeModal() { $('sqModal').classList.remove('active'); $('sqCloseConfirm').classList.remove('active'); formDirty = false; }
  function closeDelete() { $('sqDeleteModal').classList.remove('active'); }
  // Intentional close: if there are unsaved edits, ask first.
  function requestCloseModal() {
    if (formDirty) $('sqCloseConfirm').classList.add('active');
    else closeModal();
  }

  function openAdd() {
    $('sqForm').reset(); $('sqId').value = ''; resetImage();
    $('sqModalTitle').textContent = 'Add a Scéal';
    $('sqModalSub').textContent = 'Share a story for the seanchas — a memory, a family history, a moment worth keeping.';
    $('sqSubmit').textContent = 'Add to the Seanchas';
    var nm = S() ? S().displayName() : '';
    var cf = $('sqContributor'); cf.value = nm; cf.readOnly = false; // editable so you can render your name in Irish
    $('sqVisibility').value = 'public'; $('sqSharePicker').style.display = 'none'; $('sqShareList').innerHTML = '';
    $('sqCommentsOpen').checked = false;
    $('sqSeanchasName').value = S() ? ('Scéalta ' + S().displayName()) : '';
    loadSeanchasNames(true);
    hideStatus(); formDirty = false; $('sqModal').classList.add('active');
  }

  function openEdit(s) {
    $('sqForm').reset(); resetImage();
    $('sqId').value = s.id;
    $('sqTitle').value = s.title || ''; $('sqContributor').value = s.contributor || ''; $('sqContributor').readOnly = false;
    $('sqPeople').value = s.people || ''; $('sqStory').value = s.story || '';
    $('sqPlace').value = s.place || ''; $('sqEra').value = s.era || '';
    $('sqNextSteps').value = s.nextSteps || '';
    if (s.image) { $('sqImagePreviewImg').src = s.image; $('sqImagePreview').style.display = 'block'; $('sqImageRemoveWrap').style.display = 'flex'; }
    var vis = s.visibility || 'public';
    $('sqVisibility').value = vis;
    if (vis === 'shared') { $('sqSharePicker').style.display = 'block'; renderShareList(s.sharedWith || []); }
    else $('sqSharePicker').style.display = 'none';
    $('sqCommentsOpen').checked = !!s.commentsOpen;
    $('sqSeanchasName').value = s.seanchasName || '';
    loadSeanchasNames(false);
    $('sqModalTitle').textContent = 'Edit Scéal';
    $('sqModalSub').textContent = 'Edit this scéal, who can read it, and whether comments are open.';
    $('sqSubmit').textContent = 'Save Changes';
    hideStatus(); formDirty = false; $('sqModal').classList.add('active');
  }

  function openDelete(s) { $('sqDeleteId').value = s.id; $('sqDeleteTitle').textContent = s.title || ''; $('sqDeleteModal').classList.add('active'); }

  function wire() {
    $('sqImage').addEventListener('change', async function (e) {
      var f = e.target.files[0]; if (!f) return;
      try { rawImageEl = await loadImageFromFile(f); $('sqSizeSlider').value = 800; updatePreview(800); $('sqImageControls').style.display = 'block'; $('sqRemoveImage').checked = false; } catch (err) { console.error(err); }
    });
    $('sqSizeSlider').addEventListener('input', function (e) { updatePreview(parseInt(e.target.value, 10)); });
    $('sqVisibility').addEventListener('change', function (e) {
      if (e.target.value === 'shared') { $('sqSharePicker').style.display = 'block'; renderShareList(collectShared()); }
      else $('sqSharePicker').style.display = 'none';
    });
    // Any edit marks the form dirty.
    $('sqForm').addEventListener('input', function () { formDirty = true; });
    $('sqForm').addEventListener('change', function () { formDirty = true; });

    // Cancel and outside-clicks are close *requests* — they confirm if there are unsaved edits.
    $('sqCancel').addEventListener('click', requestCloseModal);
    $('sqDeleteCancel').addEventListener('click', closeDelete);
    $('sqModal').addEventListener('click', function (e) { if (e.target === $('sqModal')) requestCloseModal(); });
    $('sqDeleteModal').addEventListener('click', function (e) { if (e.target === $('sqDeleteModal')) closeDelete(); });
    $('sqCloseConfirm').addEventListener('click', function (e) { if (e.target === $('sqCloseConfirm')) $('sqCloseConfirm').classList.remove('active'); });

    // Unsaved-changes dialog buttons.
    $('sqCloseKeep').addEventListener('click', function () { $('sqCloseConfirm').classList.remove('active'); });
    $('sqCloseDiscard').addEventListener('click', function () { closeModal(); });
    $('sqCloseSave').addEventListener('click', function () { $('sqCloseConfirm').classList.remove('active'); $('sqForm').requestSubmit(); });

    $('sqForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      var btn = $('sqSubmit'); var id = $('sqId').value; var editing = !!id;
      if (isLocal) { status('Saving is disabled in local dev — deploy to Cloudflare to contribute for real.', false); return; }
      var imageVal;
      if (editing && $('sqRemoveImage').checked) imageVal = '';
      else if (pendingImage) imageVal = pendingImage;
      else imageVal = undefined;
      var vis = $('sqVisibility').value;
      var payload = {
        title: $('sqTitle').value.trim(), contributor: $('sqContributor').value.trim(),
        story: $('sqStory').value.trim(), people: $('sqPeople').value.trim(),
        place: $('sqPlace').value.trim(), era: $('sqEra').value.trim(),
        nextSteps: $('sqNextSteps').value.trim(),
        visibility: vis, sharedWith: vis === 'shared' ? collectShared() : [],
        commentsOpen: $('sqCommentsOpen').checked
      };
      if (imageVal !== undefined) payload.image = imageVal;
      payload.seanchasName = $('sqSeanchasName').value.trim();
      btn.disabled = true; btn.textContent = editing ? 'Saving…' : 'Adding…';
      try {
        var result = editing ? await API.edit(Object.assign({ id: id }, payload)) : await API.create(payload);
        status(result.message || 'Saved.', true);
        setTimeout(function () { closeModal(); cfg.onSaved(result.sceal); }, 900);
      } catch (err) {
        status(err.message || 'Failed to save.', false);
        btn.disabled = false; btn.textContent = editing ? 'Save Changes' : 'Add to the Seanchas';
      }
    });

    $('sqDeleteConfirm').addEventListener('click', async function () {
      var id = $('sqDeleteId').value;
      try { await API.del(id); closeDelete(); cfg.onDeleted(id); }
      catch (err) { alert(err.message || 'Failed to remove.'); }
    });
  }

  function init(opts) {
    opts = opts || {};
    if (opts.onSaved) cfg.onSaved = opts.onSaved;
    if (opts.onDeleted) cfg.onDeleted = opts.onDeleted;
    if (mounted) return;
    var style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
    var holder = document.createElement('div'); holder.innerHTML = MODAL_HTML; document.body.appendChild(holder);
    wire(); mounted = true;
  }

  window.SeanchasUI = {
    API: API, esc: esc, visLabel: visLabel, isLoggedIn: isLoggedIn,
    init: init, openAdd: openAdd, openEdit: openEdit, openDelete: openDelete
  };
})();
