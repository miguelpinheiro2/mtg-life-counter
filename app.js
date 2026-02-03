(() => {
  /**
   * Commander Life Counter
   * ----------------------
   * This file implements a small single-page UI to track life totals, poison counters,
   * and commander damage for up to 6 players. The state is saved to localStorage
   * under `STORAGE_KEY` so the board persists across page reloads.
   */

  // Key used for persisting state in localStorage.
  const STORAGE_KEY = 'commander-life-state-v1';

  // Cached DOM references to main controls and the players container
  const playersContainer = document.getElementById('players');
  const playerCountInput = document.getElementById('player-count');
  const startingLifeInput = document.getElementById('starting-life');
  const resetAllBtn = document.getElementById('reset-all');

  // Default starting life (reading initial input value, fallback to 40)
  const defaultStarting = parseInt(startingLifeInput.value, 10) || 40;

  // In-memory app state. If there is persisted state use that otherwise create a minimal default.
  let state = loadState() || { startingLife: defaultStarting, players: [] };

  // Persist current state to localStorage
  function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

  // Load state from localStorage. Returns null on parse errors or missing data.
  function loadState() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch(e){return null} }

  // Palette of default player colors used by the color picker and UI accenting
  const DEFAULT_COLORS = [
    { name: 'Red', hex: '#ef476f' },
    { name: 'Yellow', hex: '#ffd166' },
    { name: 'Green', hex: '#06d6a0' },
    { name: 'Blue', hex: '#118ab2' },
    { name: 'Purple', hex: '#f72585' },
    { name: 'Orange', hex: '#ff8c42' },
    { name: 'Pink', hex: '#ff6b9d' },
    { name: 'Cyan', hex: '#00d4ff' },
    { name: 'Lime', hex: '#7fff00' },
    { name: 'Teal', hex: '#20b2aa' },
    { name: 'Indigo', hex: '#4b0082' },
    { name: 'Brown', hex: '#8b4513' }
  ];

  /**
   * makePlayer(i)
   * Create a new player object with sensible defaults.
   * - id: unique identifier (UUID if available, otherwise a timestamp+random fallback)
   * - name: default label like "Player 1"
   * - life: initialized to the state's starting life
   * - poison: poison counter (starting at 0)
   * - commanderDamage: object storing damage taken from each opposing commander
   * - color: a default color picked from DEFAULT_COLORS
   */
  function makePlayer(i) {
    return {
      id: crypto?.randomUUID?.() ?? Date.now()+Math.random(),
      name: `Player ${i + 1}`,
      life: state.startingLife,
      poison: 0,
      commanderDamage: {},
      color: DEFAULT_COLORS[i % DEFAULT_COLORS.length].hex
    };
  }

  /**
   * ensurePlayers(n)
   * Make sure the in-memory player array has exactly `n` players.
   * If there are too many players, truncate; if too few, append new players.
   */
  function ensurePlayers(n) {
    state.players = state.players.slice(0, n);
    while (state.players.length < n) state.players.push(makePlayer(state.players.length));
    saveState();
  }

  /**
   * render()
   * Rebuilds the players UI from `state.players`.
   * Each player card includes: color picker, name input, reset button,
   * life display, +/- buttons, poison controls, and commander damage UI.
   */
  function render() {
    playersContainer.innerHTML = '';
    state.players.forEach((p, idx) => {
      const el = document.createElement('div');
      el.className = 'player';
      // set CSS var so styling can use the player's selected color
      el.style.setProperty('--player-color', p.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length].hex);

      // Build the card HTML. Note: we escape player names to avoid HTML injection.
      el.innerHTML = `
        <div class="top">
          <div class="left" style="display:flex;align-items:center;gap:8px">
            <select class="color-picker" data-id="${p.id}">
              ${DEFAULT_COLORS.map(c=>`<option value="${c.hex}" ${(p.color||DEFAULT_COLORS[idx % DEFAULT_COLORS.length].hex)===c.hex ? 'selected' : ''}>${c.name}</option>`).join('')}
            </select>
          </div>
          <div class="center">
            <input class="name" data-id="${p.id}" value="${escapeHtml(p.name)}" />
          </div>
          <div class="right">
            <div class="life" data-id="${p.id}">${p.life}</div>
            <button class="btn reset" data-id="${p.id}">Reset</button>
          </div>
        </div>
        <div class="controls-row">
          <button class="btn dec1" data-id="${p.id}">-1</button>
          <button class="btn inc1" data-id="${p.id}">+1</button>
          <button class="btn dec5" data-id="${p.id}">-5</button>
          <button class="btn inc5" data-id="${p.id}">+5</button>
        </div>
        <div class="poison small">
          <button class="btn p-dec" data-id="${p.id}">-P</button>
          <div class="muted">Poison: <span data-poison-id="${p.id}">${p.poison}</span></div>
          <button class="btn p-inc" data-id="${p.id}">+P</button>
        </div>
        <div class="commander-damage small" data-id="${p.id}">
          <div class="cmdr-box">
            <div class="cmdr-tag">Commander Damage</div>
            <div class="cmdr-content">
              <div class="cmdr-list">
                ${state.players.filter(x=>x.id!==p.id).map(op=> `<span class="cmdr-item" data-cmdr-val="${p.id}-${op.id}" title="Click to -1, Shift+Click to reset. Click the number to edit">${escapeHtml(op.name)}: <span class="cmdr-count" data-count-id="${p.id}-${op.id}">${p.commanderDamage?.[op.id]||0}</span></span>`).join('')}
              </div>
              <div class="cmdr-controls" style="display:flex;gap:8px;justify-content:center;margin-top:6px">
                <select class="cmdr-source" data-id="${p.id}">
                  <option value="">Source</option>
                  ${state.players.filter(x=>x.id!==p.id).map(op=> `<option value="${op.id}">${escapeHtml(op.name)}</option>`).join('')}
                </select>
                <select class="cmdr-amount" data-id="${p.id}">
                  <option value="">Amount</option>
                  ${Array.from({length:21},(_,i)=>i+1).map(n=>`<option value="${n}">${n}</option>`).join('')}
                </select>
              </div>
            </div>
          </div>
        </div>
      `;

      playersContainer.appendChild(el);
      // After adding the card, make sure visual state (dead class, counts) is correct
      updatePlayerUI(p);
    });
    // Re-bind event listeners for the newly rendered DOM
    attachListeners();
  }

  /**
   * attachListeners()
   * Bind UI event handlers for inputs and buttons within the `playersContainer`.
   * Many handlers are delegated and some are only bound once (e.g. double-click handlers)
   * to avoid duplicate behavior on multiple renders.
   */
  function attachListeners() {
    // Name edits - immediately update state when typing
    playersContainer.querySelectorAll('.name').forEach(input => {
      input.oninput = e => {
        const id = e.target.dataset.id;
        const p = state.players.find(x => x.id == id);
        if (p) p.name = e.target.value;
        saveState();
        // Update other UI elements that show this player's name
        state.players.forEach(op => {
          if (op.id !== id) {
            const sel = playersContainer.querySelector(`.cmdr-source[data-id="${op.id}"]`);
            if (sel) {
              const opt = sel.querySelector(`option[value="${id}"]`);
              if (opt) opt.textContent = escapeHtml(p.name);
            }
            const badge = playersContainer.querySelector(`[data-cmdr-val="${op.id}-${id}"]`);
            if (badge) badge.innerHTML = `${escapeHtml(p.name)}: <span class="cmdr-count" data-count-id="${op.id}-${id}">${op.commanderDamage?.[id] || 0}</span>`;
          }
        });
      };
    });

    // Reset button: resets a single player's values to the starting life and clears counters
    playersContainer.querySelectorAll('.reset').forEach(btn => {
      btn.onclick = e => { const id = e.target.dataset.id; resetPlayer(id); };
    });

    // Color picker: changes the player's accent color and persists it
    playersContainer.querySelectorAll('.color-picker').forEach(sel => {
      sel.onchange = e => {
        const id = e.target.dataset.id;
        const p = state.players.find(x => x.id == id);
        if (!p) return;
        p.color = e.target.value;
        const card = playersContainer.querySelector(`.player .color-picker[data-id="${id}"]`)?.closest('.player');
        if (card) card.style.setProperty('--player-color', p.color);
        saveState();
      };
    });

    // Life increment/decrement buttons
    playersContainer.querySelectorAll('.inc1').forEach(b => b.onclick = e => changeLife(e.target.dataset.id, 1));
    playersContainer.querySelectorAll('.dec1').forEach(b => b.onclick = e => changeLife(e.target.dataset.id, -1));
    playersContainer.querySelectorAll('.inc5').forEach(b => b.onclick = e => changeLife(e.target.dataset.id, 5));
    playersContainer.querySelectorAll('.dec5').forEach(b => b.onclick = e => changeLife(e.target.dataset.id, -5));

    // Poison controls
    playersContainer.querySelectorAll('.p-inc').forEach(b => b.onclick = e => changePoison(e.target.dataset.id, 1));
    playersContainer.querySelectorAll('.p-dec').forEach(b => b.onclick = e => changePoison(e.target.dataset.id, -1));

    // Commander damage via source/amount selects. Adds damage and subtracts life accordingly.
    playersContainer.querySelectorAll('.cmdr-amount').forEach(sel => {
      sel.onchange = e => {
        const id = e.target.dataset.id; // target player receiving damage
        const amount = parseInt(e.target.value, 10);
        const sourceSel = playersContainer.querySelector(`.cmdr-source[data-id="${id}"]`);
        const commanderId = sourceSel?.value;
        if (!commanderId || Number.isNaN(amount)) { e.target.value = ''; return; }
        const p = state.players.find(x=>x.id==id);
        if (!p) { e.target.value = ''; return; }
        p.commanderDamage = p.commanderDamage || {};
        p.commanderDamage[commanderId] = (p.commanderDamage[commanderId] || 0) + amount;
        // also reduce life by the same amount
        p.life -= amount;
        if (p.life < -999) p.life = -999; // hard lower bound to prevent runaway negative values
        saveState();
        updatePlayerUI(p);
        e.target.value = '';
      };
    });

    // Commander damage badges: clicking decrements by 1 and restores 1 life; shift-click or right-click removes all and restores life
    playersContainer.querySelectorAll('.cmdr-item').forEach(span => {
      span.onclick = e => {
        const val = e.currentTarget.dataset.cmdrVal;
        if (!val) return;
        const [targetId, sourceId] = val.split('-');
        const p = state.players.find(x => x.id == targetId);
        if (!p || !p.commanderDamage || !p.commanderDamage[sourceId]) return;
        const cur = p.commanderDamage[sourceId] || 0;
        if (e.shiftKey) {
          // remove entire commander damage and restore life equal to the removed damage
          p.life += cur;
          delete p.commanderDamage[sourceId];
        } else {
          // remove one commander damage and restore 1 life
          const next = cur - 1;
          p.life += 1;
          if (next <= 0) delete p.commanderDamage[sourceId];
          else p.commanderDamage[sourceId] = next;
        }
        if (p.life < -999) p.life = -999;
        saveState();
        updatePlayerUI(p);
      };
      // right-click: same behavior as Shift+click (remove all damage from that source)
      span.oncontextmenu = e => {
        e.preventDefault();
        const val = e.currentTarget.dataset.cmdrVal;
        if (!val) return;
        const [targetId, sourceId] = val.split('-');
        const p = state.players.find(x => x.id == targetId);
        if (!p || !p.commanderDamage || !p.commanderDamage[sourceId]) return;
        const cur = p.commanderDamage[sourceId] || 0;
        p.life += cur;
        delete p.commanderDamage[sourceId];
        if (p.life < -999) p.life = -999;
        saveState();
        updatePlayerUI(p);
      };
      span.title = 'Click to remove 1 commander damage (restores 1 life). Shift+click or right-click to remove all. Click the number to edit exact value.';
    });

    // Double-click on the commander damage number to edit the exact value.
    // We bind this only once (per session) using a guard flag to prevent duplicate handlers.
    if (!playersContainer._cmdrDblBound) {
      playersContainer.addEventListener('dblclick', e => {
        const tgt = e.target;
        if (!tgt.classList.contains('cmdr-count')) return;
        const val = tgt.dataset.countId; // format: "targetId-sourceId"
        if (!val) return;
        const [targetId, sourceId] = val.split('-');
        const p = state.players.find(x => x.id == targetId);
        if (!p) return;
        const cur = p.commanderDamage?.[sourceId] || 0;
        const input = document.createElement('input');
        input.type = 'number';
        input.min = 0;
        input.value = cur;
        input.style.width = '4em';
        // replace the count span with an input so the user can type a value
        tgt.replaceWith(input);
        input.focus();
        input.select();

        function finish() {
          const newVal = Math.max(0, parseInt(input.value, 10) || 0);
          const delta = newVal - cur;
          p.commanderDamage = p.commanderDamage || {};
          if (newVal <= 0) delete p.commanderDamage[sourceId]; else p.commanderDamage[sourceId] = newVal;
          // adjust life relatively: increasing commander damage subtracts life
          p.life -= delta;
          if (p.life < -999) p.life = -999;
          saveState();
          updatePlayerUI(p);
        }

        input.onblur = finish;
        input.onkeydown = ev => {
          if (ev.key === 'Enter') { finish(); input.blur(); }
          else if (ev.key === 'Escape') { updatePlayerUI(p); }
        };
      });
      playersContainer._cmdrDblBound = true;
    }

    // Single-click on the count number also allows editing (capture phase) and we bind it only once.
    if (!playersContainer._cmdrClickBound) {
      playersContainer.addEventListener('click', e => {
        const tgt = e.target;
        if (!tgt.classList.contains('cmdr-count')) return;
        // Prevent the parent .cmdr-item click (which decrements) from firing
        e.preventDefault();
        e.stopPropagation();
        const val = tgt.dataset.countId; // "targetId-sourceId"
        if (!val) return;
        const [targetId, sourceId] = val.split('-');
        const p = state.players.find(x => x.id == targetId);
        if (!p) return;
        const cur = p.commanderDamage?.[sourceId] || 0;
        const input = document.createElement('input');
        input.type = 'number';
        input.min = 0;
        input.value = cur;
        input.style.width = '4em';
        tgt.replaceWith(input);
        input.focus();
        input.select();

        function finish() {
          const newVal = Math.max(0, parseInt(input.value, 10) || 0);
          const delta = newVal - cur;
          p.commanderDamage = p.commanderDamage || {};
          if (newVal <= 0) delete p.commanderDamage[sourceId]; else p.commanderDamage[sourceId] = newVal;
          // adjust life relative to delta
          p.life -= delta;
          if (p.life < -999) p.life = -999;
          saveState();
          updatePlayerUI(p);
        }

        input.onblur = finish;
        input.onkeydown = ev => {
          if (ev.key === 'Enter') { finish(); input.blur(); }
          else if (ev.key === 'Escape') { updatePlayerUI(p); }
        };
      }, true);
      playersContainer._cmdrClickBound = true;
    }

  }

  /**
   * changeLife(id, delta)
   * Adjusts the life total for a player by `delta` and persists the change.
   */
  function changeLife(id, delta) {
    const p = state.players.find(x => x.id == id);
    if (!p) return;
    p.life += delta;
    if (p.life < -999) p.life = -999;
    saveState();
    updatePlayerUI(p);
  }

  /**
   * changePoison(id, delta)
   * Adjusts the poison counter for a player; poison cannot go below 0.
   */
  function changePoison(id, delta) {
    const p = state.players.find(x => x.id == id);
    if (!p) return;
    p.poison = Math.max(0, p.poison + delta);
    saveState();
    updatePlayerUI(p);
  }

  /**
   * resetPlayer(id)
   * Reset life, poison and commander damage for a single player to defaults.
   */
  function resetPlayer(id) {
    const p = state.players.find(x => x.id == id);
    if (!p) return;
    p.life = state.startingLife;
    p.poison = 0;
    p.commanderDamage = {};
    saveState();
    updatePlayerUI(p);
  }

  /**
   * updatePlayerUI(p)
   * Update DOM elements for a specific player to reflect the in-memory state.
   * This updates life text, poison text, commander damage badges, colors, and dead-state styling.
   */
  function updatePlayerUI(p) {
    const lifeEl = playersContainer.querySelector(`.life[data-id="${p.id}"]`);
    if (lifeEl) lifeEl.textContent = p.life;
    const poisonEl = playersContainer.querySelector(`[data-poison-id="${p.id}"]`);
    if (poisonEl) poisonEl.textContent = p.poison;
    const card = playersContainer.querySelector(`.player .name[data-id="${p.id}"]`)?.closest('.player');
    if (card && p.color) card.style.setProperty('--player-color', p.color);
    // update commander damage badges for each opposing player
    state.players.forEach(op => {
      if (op.id === p.id) return;
      const el = playersContainer.querySelector(`[data-cmdr-val="${p.id}-${op.id}"]`);
      if (el) el.innerHTML = `${escapeHtml(op.name)}: <span class="cmdr-count" data-count-id="${p.id}-${op.id}">${p.commanderDamage?.[op.id] || 0}</span>`;
    });
    // determine death: either life <= 0 OR any commander damage >= 21
    const isDead = (p.life <= 0) || Object.values(p.commanderDamage || {}).some(v => v >= 21);
    if (card) {
      if (isDead) card.classList.add('dead');
      else card.classList.remove('dead');
    }
  }

  // get default hex for index (helper)
  function getDefaultColor(i) { return DEFAULT_COLORS[i % DEFAULT_COLORS.length].hex; }

  // Simple HTML-escaping utility for safe text rendering
  function escapeHtml(s){return (s+'').replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"})[c])}

  // controls: player count input
  playerCountInput.onchange = () => {
    const n = Math.max(1, Math.min(6, parseInt(playerCountInput.value,10)||1));
    playerCountInput.value = n;
    ensurePlayers(n);
    render();
  };

  // starting life input: updates the default starting life used for resets and new players
  startingLifeInput.onchange = () => {
    state.startingLife = Math.max(1, parseInt(startingLifeInput.value,10)||40);
    // Note: this does not retroactively change existing players' life totals.
    saveState();
  };

  // reset-all button: restore all players to the configured starting life and clear their counters
  resetAllBtn.onclick = () => {
    state.players.forEach(p => { p.life = state.startingLife; p.poison = 0; p.commanderDamage = {}; });
    saveState();
    render();
  };

  // initialize the UI from state
  (function init(){
    if (!state.players || !state.players.length) ensurePlayers(parseInt(playerCountInput.value,10)||4);
    startingLifeInput.value = state.startingLife;
    playerCountInput.value = state.players.length;
    render();
  })();

})();
