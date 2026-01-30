(() => {
  const STORAGE_KEY = 'commander-life-state-v1';
  const playersContainer = document.getElementById('players');
  const playerCountInput = document.getElementById('player-count');
  const startingLifeInput = document.getElementById('starting-life');
  const resetAllBtn = document.getElementById('reset-all');

  const defaultStarting = parseInt(startingLifeInput.value, 10) || 40;

  let state = loadState() || { startingLife: defaultStarting, players: [] };

  function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  function loadState() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch(e){return null} }

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

  function ensurePlayers(n) {
    state.players = state.players.slice(0, n);
    while (state.players.length < n) state.players.push(makePlayer(state.players.length));
    saveState();
  }

  function render() {
    playersContainer.innerHTML = '';
    state.players.forEach((p, idx) => {
      const el = document.createElement('div');
      el.className = 'player';
      // set CSS var for player color
      el.style.setProperty('--player-color', p.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length].hex);

      el.innerHTML = `
        <div class="top">
          <div style="display:flex;align-items:center;gap:8px">
            <select class="color-picker" data-id="${p.id}">
              ${DEFAULT_COLORS.map(c=>`<option value="${c.hex}" ${(p.color||DEFAULT_COLORS[idx % DEFAULT_COLORS.length].hex)===c.hex ? 'selected' : ''}>${c.name}</option>`).join('')}
            </select>
            <input class="name" data-id="${p.id}" value="${escapeHtml(p.name)}" />
          </div>
          <button class="btn reset" data-id="${p.id}">Reset</button>
        </div>
        <div class="life" data-id="${p.id}">${p.life}</div>
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
          <div class="cmdr-list">
            ${state.players.filter(x=>x.id!==p.id).map(op=> `<span class="cmdr-item" data-cmdr-val="${p.id}-${op.id}" title="Click to -1, Shift+Click to reset. Click the number to edit">${escapeHtml(op.name)}: <span class="cmdr-count" data-count-id="${p.id}-${op.id}">${p.commanderDamage?.[op.id]||0}</span></span>`).join('')}
          </div>
          <div style="display:flex;gap:8px;justify-content:center;margin-top:6px">
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
      `;

      playersContainer.appendChild(el);
      // ensure UI reflects current state (commander damage badges, dead class, etc.)
      updatePlayerUI(p);
    });
    attachListeners();
  }

  function attachListeners() {
    // name edits
    playersContainer.querySelectorAll('.name').forEach(input => {
      input.oninput = e => {
        const id = e.target.dataset.id;
        const p = state.players.find(x => x.id == id);
        if (p) p.name = e.target.value;
        saveState();
        // update commander source selects and damage badges in other players' cards
        state.players.forEach(op => {
          if (op.id !== id) {
            // update cmdr-source select option text
            const sel = playersContainer.querySelector(`.cmdr-source[data-id="${op.id}"]`);
            if (sel) {
              const opt = sel.querySelector(`option[value="${id}"]`);
              if (opt) opt.textContent = escapeHtml(p.name);
            }
            // update cmdr-list item text showing this player's name and damage
            const badge = playersContainer.querySelector(`[data-cmdr-val="${op.id}-${id}"]`);
            if (badge) badge.innerHTML = `${escapeHtml(p.name)}: <span class="cmdr-count" data-count-id="${op.id}-${id}">${op.commanderDamage?.[id] || 0}</span>`;
          }
        });
      };
    });

    // reset
    playersContainer.querySelectorAll('.reset').forEach(btn => {
      btn.onclick = e => { const id = e.target.dataset.id; resetPlayer(id); };
    });

    // color pickers (dropdown of default colors)
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

    // life changes
    playersContainer.querySelectorAll('.inc1').forEach(b => b.onclick = e => changeLife(e.target.dataset.id, 1));
    playersContainer.querySelectorAll('.dec1').forEach(b => b.onclick = e => changeLife(e.target.dataset.id, -1));
    playersContainer.querySelectorAll('.inc5').forEach(b => b.onclick = e => changeLife(e.target.dataset.id, 5));
    playersContainer.querySelectorAll('.dec5').forEach(b => b.onclick = e => changeLife(e.target.dataset.id, -5));

    // poison
    playersContainer.querySelectorAll('.p-inc').forEach(b => b.onclick = e => changePoison(e.target.dataset.id, 1));
    playersContainer.querySelectorAll('.p-dec').forEach(b => b.onclick = e => changePoison(e.target.dataset.id, -1));

    // commander damage: pick source and amount (amount dropdown 1..21)
    playersContainer.querySelectorAll('.cmdr-amount').forEach(sel => {
      sel.onchange = e => {
        const id = e.target.dataset.id; // target player receiving damage
        const amount = parseInt(e.target.value, 10);
        const sourceSel = playersContainer.querySelector(`.cmdr-source[data-id="${id}"]`);
        const commanderId = sourceSel?.value;
        if (!commanderId || Number.isNaN(amount)) { e.target.value = ''; return; }
        const commander = state.players.find(x=>x.id==commanderId)?.name || 'Commander';
        const p = state.players.find(x=>x.id==id);
        if (!p) { e.target.value = ''; return; }
        p.commanderDamage = p.commanderDamage || {};
        p.commanderDamage[commanderId] = (p.commanderDamage[commanderId] || 0) + amount;
        // also reduce life
        p.life -= amount;
        if (p.life < -999) p.life = -999;
        saveState();
        updatePlayerUI(p);
        e.target.value = '';
      };
    });

    // commander damage badges: click to -1 (restores 1 life), Shift+click or right-click to remove entirely (restore all life)
    playersContainer.querySelectorAll('.cmdr-item').forEach(span => {
      span.onclick = e => {
        const val = e.currentTarget.dataset.cmdrVal;
        if (!val) return;
        const [targetId, sourceId] = val.split('-');
        const p = state.players.find(x => x.id == targetId);
        if (!p || !p.commanderDamage || !p.commanderDamage[sourceId]) return;
        const cur = p.commanderDamage[sourceId] || 0;
        if (e.shiftKey) {
          // remove entire commander damage and restore life
          p.life += cur;
          delete p.commanderDamage[sourceId];
        } else {
          // decrement by 1 and restore 1 life
          const next = cur - 1;
          p.life += 1;
          if (next <= 0) delete p.commanderDamage[sourceId];
          else p.commanderDamage[sourceId] = next;
        }
        if (p.life < -999) p.life = -999;
        saveState();
        updatePlayerUI(p);
      };
      // right-click will remove entire damage as well
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

    // double-click the count number to edit exact commander damage (delegated handler), bind only once
    if (!playersContainer._cmdrDblBound) {
      playersContainer.addEventListener('dblclick', e => {
        const tgt = e.target;
        if (!tgt.classList.contains('cmdr-count')) return;
        const val = tgt.dataset.countId; // "target-source"
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
        // replace the count span with the input
        tgt.replaceWith(input);
        input.focus();
        input.select();

        function finish() {
          const newVal = Math.max(0, parseInt(input.value, 10) || 0);
          const delta = newVal - cur;
          p.commanderDamage = p.commanderDamage || {};
          if (newVal <= 0) delete p.commanderDamage[sourceId]; else p.commanderDamage[sourceId] = newVal;
          // adjust life relative to delta (increase damage reduces life)
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

    // single-click the count number to edit exact commander damage (capture-phase delegated handler), bind only once
    if (!playersContainer._cmdrClickBound) {
      playersContainer.addEventListener('click', e => {
        const tgt = e.target;
        if (!tgt.classList.contains('cmdr-count')) return;
        // stop propagation so the .cmdr-item click handler (which decrements) doesn't run
        e.preventDefault();
        e.stopPropagation();
        const val = tgt.dataset.countId; // "target-source"
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
        // replace the count span with the input
        tgt.replaceWith(input);
        input.focus();
        input.select();

        function finish() {
          const newVal = Math.max(0, parseInt(input.value, 10) || 0);
          const delta = newVal - cur;
          p.commanderDamage = p.commanderDamage || {};
          if (newVal <= 0) delete p.commanderDamage[sourceId]; else p.commanderDamage[sourceId] = newVal;
          // adjust life relative to delta (increase damage reduces life)
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

  function changeLife(id, delta) {
    const p = state.players.find(x => x.id == id);
    if (!p) return;
    p.life += delta;
    if (p.life < -999) p.life = -999;
    saveState();
    updatePlayerUI(p);
  }

  function changePoison(id, delta) {
    const p = state.players.find(x => x.id == id);
    if (!p) return;
    p.poison = Math.max(0, p.poison + delta);
    saveState();
    updatePlayerUI(p);
  }

  function resetPlayer(id) {
    const p = state.players.find(x => x.id == id);
    if (!p) return;
    p.life = state.startingLife;
    p.poison = 0;
    p.commanderDamage = {};
    saveState();
    updatePlayerUI(p);
  }

  function updatePlayerUI(p) {
    const lifeEl = playersContainer.querySelector(`.life[data-id="${p.id}"]`);
    if (lifeEl) lifeEl.textContent = p.life;
    const poisonEl = playersContainer.querySelector(`[data-poison-id="${p.id}"]`);
    if (poisonEl) poisonEl.textContent = p.poison;
    const card = playersContainer.querySelector(`.player .name[data-id="${p.id}"]`)?.closest('.player');
    if (card && p.color) card.style.setProperty('--player-color', p.color);
    // update commander damage badges
    state.players.forEach(op => {
      if (op.id === p.id) return;
      const el = playersContainer.querySelector(`[data-cmdr-val="${p.id}-${op.id}"]`);
      if (el) el.innerHTML = `${escapeHtml(op.name)}: <span class="cmdr-count" data-count-id="${p.id}-${op.id}">${p.commanderDamage?.[op.id] || 0}</span>`;
    });
    // mark dead if life <= 0 or any commander damage >=21
    const isDead = (p.life <= 0) || Object.values(p.commanderDamage || {}).some(v => v >= 21);
    if (card) {
      if (isDead) card.classList.add('dead');
      else card.classList.remove('dead');
    }
  }
  // get default hex for index
  function getDefaultColor(i) { return DEFAULT_COLORS[i % DEFAULT_COLORS.length].hex; }  function getDefaultColor(i) { return DEFAULT_COLORS[i % DEFAULT_COLORS.length].hex; }
  function escapeHtml(s){return (s+'').replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"})[c])}

  // controls
  playerCountInput.onchange = () => {
    const n = Math.max(1, Math.min(6, parseInt(playerCountInput.value,10)||1));
    playerCountInput.value = n;
    ensurePlayers(n);
    render();
  };

  startingLifeInput.onchange = () => {
    state.startingLife = Math.max(1, parseInt(startingLifeInput.value,10)||40);
    // update players that are at previous starting life? We'll not auto-change current values, only affect resets.
    saveState();
  };

  resetAllBtn.onclick = () => {
    state.players.forEach(p => { p.life = state.startingLife; p.poison = 0; p.commanderDamage = {}; });
    saveState();
    render();
  };

  // initialize
  (function init(){
    if (!state.players || !state.players.length) ensurePlayers(parseInt(playerCountInput.value,10)||4);
    startingLifeInput.value = state.startingLife;
    playerCountInput.value = state.players.length;
    render();
  })();

})();
