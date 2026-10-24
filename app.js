/* ===== Estado ===== */
const KEY = 'liar-voley-sets-v2';
const COLORS = ['#1F6FEB', '#E0457B', '#1C9C6B', '#8B5CF6', '#F59E0B', '#0EA5C6', '#DC4C2C', '#64748B'];

const fresh = () => ({ bet: 10, teams: [], log: [], vs: { a: null, b: null } });
let S = load();

function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && Array.isArray(d.teams) && Array.isArray(d.log)) return { ...fresh(), ...d };
  } catch (e) {}
  return fresh();
}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };

/* ===== Utilidades ===== */
const uid = () => Math.random().toString(36).slice(2, 9);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const r2 = n => Math.round(n * 100) / 100;
const money = n => 'S/ ' + r2(Math.abs(n)).toFixed(2).replace(/\.00$/, '');
const team = id => S.teams.find(t => t.id === id);
const when = ts => new Date(ts).toLocaleString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

/* ===== Cálculos ===== */
function stats() {
  const won = {}, lost = {}, bal = {}, h2h = {};
  S.teams.forEach(t => {
    won[t.id] = 0; lost[t.id] = 0; bal[t.id] = 0; h2h[t.id] = {};
    S.teams.forEach(u => (h2h[t.id][u.id] = 0));
  });
  S.log.forEach(x => {
    won[x.w]++; lost[x.l]++; h2h[x.w][x.l]++;
    bal[x.w] += x.bet; bal[x.l] -= x.bet;
  });
  S.teams.forEach(t => (bal[t.id] = r2(bal[t.id])));
  return { won, lost, bal, h2h };
}

/* Deudas por cada par de equipos */
function pairs() {
  const out = [];
  const sum = arr => arr.reduce((t, s) => t + s.bet, 0);
  for (let i = 0; i < S.teams.length; i++) {
    for (let j = i + 1; j < S.teams.length; j++) {
      const x = S.teams[i], y = S.teams[j];
      const xs = S.log.filter(s => s.w === x.id && s.l === y.id);
      const ys = S.log.filter(s => s.w === y.id && s.l === x.id);
      if (!xs.length && !ys.length) continue;
      const diff = r2(sum(xs) - sum(ys));
      const bets = [...new Set([...xs, ...ys].map(s => s.bet))];
      out.push({ x, y, xw: xs.length, yw: ys.length, diff, bet: bets.length === 1 ? bets[0] : null });
    }
  }
  return out;
}

/* Convierte un par en deuda: quién debe, a quién y cuánto */
function debtOf(p) {
  if (p.diff === 0) return null;
  const xCobra = p.diff > 0;
  return {
    debtor: xCobra ? p.y : p.x, creditor: xCobra ? p.x : p.y,
    dw: xCobra ? p.yw : p.xw, cw: xCobra ? p.xw : p.yw,
    amt: Math.abs(p.diff), bet: p.bet
  };
}

/* ===== Acciones ===== */
function fixVs() {
  const ids = S.teams.map(t => t.id);
  if (ids.length < 2) { S.vs = { a: null, b: null }; return; }
  if (!ids.includes(S.vs.a)) S.vs.a = ids[0];
  if (!ids.includes(S.vs.b) || S.vs.b === S.vs.a) S.vs.b = ids.find(id => id !== S.vs.a);
}

function addTeam(name) {
  name = name.trim().slice(0, 22);
  if (!name) return;
  if (S.teams.some(t => t.name.toLowerCase() === name.toLowerCase())) return toast('Ya existe un capitán con ese nombre');
  S.teams.push({ id: uid(), name, color: COLORS[S.teams.length % COLORS.length] });
  save(); render();
}

function removeTeam(id) {
  const t = team(id), n = S.log.filter(x => x.w === id || x.l === id).length;
  const msg = n ? `¿Quitar a ${t.name}? También se borrarán sus ${n} sets del registro.` : `¿Quitar a ${t.name}?`;
  if (!confirm(msg)) return;
  S.teams = S.teams.filter(x => x.id !== id);
  S.log = S.log.filter(x => x.w !== id && x.l !== id);
  save(); render();
}

function renameTeam(id) {
  const t = team(id), n = prompt('Nombre del capitán:', t.name);
  if (n && n.trim()) { t.name = n.trim().slice(0, 22); save(); render(); }
}

function addSet(w, l) {
  S.log.push({ id: uid(), w, l, bet: S.bet, t: Date.now() });
  save(); render();
  toast(`${team(w).name} ganó un set a ${team(l).name}`, true);
}

function removeSet(id) { S.log = S.log.filter(x => x.id !== id); save(); render(); }
function undoLast() { S.log.pop(); save(); render(); }

/* ===== Aviso ===== */
let toastTimer;
function toast(msg, withUndo) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('on'), 2600);
}

/* ===== Vistas ===== */
function secTeams() {
  const chips = S.teams.map(t => `
    <div class="chip" style="--c:${t.color}">${esc(t.name)}
      <button data-rename="${t.id}" aria-label="Cambiar nombre de ${esc(t.name)}">✎</button>
      <button data-remove="${t.id}" aria-label="Quitar a ${esc(t.name)}">✕</button>
    </div>`).join('');
  return `<section class="card">
    <h2>Capitanes</h2>
    <form class="add" id="addTeam">
      <input name="name" maxlength="22" placeholder="Nombre del capitán" aria-label="Nombre del capitán" autocomplete="off" required>
      <button type="submit">Agregar</button>
    </form>
    ${S.teams.length ? `<div class="chips">${chips}</div>` : `<p class="empty" style="margin-top:12px">Agrega a cada capitán. Cada uno representa a su equipo.</p>`}
  </section>`;
}

function secVersus(h2h) {
  if (S.teams.length < 2) {
    return `<section class="card"><h2>Enfrentamiento</h2><p class="empty">Agrega al menos dos capitanes para registrar sets.</p></section>`;
  }
  const opts = sel => S.teams.map(t => `<option value="${t.id}" ${t.id === sel ? 'selected' : ''}>${esc(t.name)}</option>`).join('');
  const A = team(S.vs.a), B = team(S.vs.b);
  const side = (T, O, key) => `
    <div class="side" style="--c:${T.color}">
      <div class="nm">${esc(T.name)}</div>
      <div class="big">${h2h[T.id][O.id]}</div>
      <div class="sub">sets ganados a ${esc(O.name)}</div>
      <button class="win" data-win="${key}">Ganó el set</button>
    </div>`;
  return `<section class="card">
    <h2>Enfrentamiento</h2>
    <div class="two">
      <div><label for="vsA">Equipo de</label><select id="vsA">${opts(S.vs.a)}</select></div>
      <div><label for="vsB">Juega contra</label><select id="vsB">${opts(S.vs.b)}</select></div>
    </div>
    <div style="margin-top:12px"><label for="bet">Monto por set (S/)</label>
      <input id="bet" type="number" min="0" step="0.5" inputmode="decimal" value="${S.bet}"></div>
    <div class="versus">
      ${side(A, B, 'a')}
      <div class="mid">VS<button class="ghost" data-swap aria-label="Intercambiar equipos">⇄</button></div>
      ${side(B, A, 'b')}
    </div>
  </section>`;
}

function secDebts(ps) {
  if (!ps.length) {
    return `<section class="card"><h2>Quién debe a quién</h2><p class="empty">${S.log.length ? '' : 'Todavía no hay sets registrados. Cuando juegues, aquí verás cada deuda explicada.'}</p></section>`;
  }
  let total = 0;
  const cards = ps.map(p => {
    const d = debtOf(p), n = p.xw + p.yw;
    if (!d) {
      return `<article class="debt even"><div class="who"><b style="color:${p.x.color}">${esc(p.x.name)}</b> y <b style="color:${p.y.color}">${esc(p.y.name)}</b> quedan a mano</div>
        <p class="why">Jugaron ${n} sets entre ellos y cada uno ganó ${p.xw}. Nadie debe nada.</p></article>`;
    }
    total += d.amt;
    const k = d.cw - d.dw, m = Math.min(d.dw, d.cw);
    const s = v => v === 1 ? 'set' : 'sets';
    let why = `Jugaron ${n} sets entre ellos: ${esc(d.debtor.name)} ganó ${d.dw} y perdió ${d.cw}. `;
    if (m > 0) why += `Se anulan ${m} ${s(m)} ganados contra ${m} perdidos. `;
    if (k > 0 && d.bet !== null) why += `Le sobran ${k} ${s(k)} perdidos, y cada set vale ${money(d.bet)}: ${k} × ${money(d.bet)} = <b>${money(d.amt)}</b>.`;
    else if (k > 0) why += `Le sobran ${k} ${s(k)} perdidos, según el monto de cada set.`;
    else why += `Ganaron la misma cantidad, pero los sets tenían montos distintos.`;
    return `<article class="debt"><div class="who"><b style="color:${d.debtor.color}">${esc(d.debtor.name)}</b> le debe <b class="amt">${money(d.amt)}</b> a <b style="color:${d.creditor.color}">${esc(d.creditor.name)}</b></div>
      <p class="why">${why}</p></article>`;
  }).join('');
  return `<section class="card"><h2>Quién debe a quién</h2>${cards}
    ${total ? `<div class="pot">Total que se debe entre todos: ${money(total)}</div>` : ''}</section>`;
}

function secRanking(won, lost, ps) {
  if (!S.teams.length) return '';
  const owes = {}, owed = {};
  S.teams.forEach(t => { owes[t.id] = 0; owed[t.id] = 0; });
  ps.forEach(p => { const d = debtOf(p); if (d) { owes[d.debtor.id] += d.amt; owed[d.creditor.id] += d.amt; } });
  const rows = [...S.teams].sort((x, y) => (owed[y.id] - owes[y.id]) - (owed[x.id] - owes[x.id]) || won[y.id] - won[x.id]).map(t => `
    <tr><td class="team" style="--c:${t.color}"><i></i>${esc(t.name)}</td><td>${won[t.id]}</td><td>${lost[t.id]}</td>
    <td class="${owes[t.id] ? 'neg' : ''}">${owes[t.id] ? money(owes[t.id]) : '—'}</td><td class="${owed[t.id] ? 'pos' : ''}">${owed[t.id] ? money(owed[t.id]) : '—'}</td></tr>`).join('');
  return `<section class="card"><h2>Resumen por equipo</h2>
    <div class="scroll"><table><tr><th>Equipo</th><th>Ganados</th><th>Perdidos</th><th>Debe pagar</th><th>Le deben</th></tr>${rows}</table></div></section>`;
}

function secMatrix(h2h) {
  if (S.teams.length < 2) return '';
  const head = S.teams.map(t => `<th>${esc(t.name)}</th>`).join('');
  const rows = S.teams.map(r => `<tr><td class="team" style="--c:${r.color}"><i></i>${esc(r.name)}</td>${
    S.teams.map(c => r.id === c.id ? `<td class="cell-0">—</td>` : `<td class="cell-n ${h2h[r.id][c.id] ? '' : 'cell-0'}">${h2h[r.id][c.id]}</td>`).join('')}</tr>`).join('');
  return `<section class="card"><h2>Sets entre equipos</h2>
    <p class="muted" style="margin-bottom:8px">Cada fila muestra cuántos sets ganó a la columna.</p>
    <div class="scroll"><table><tr><th>Ganó a →</th>${head}</tr>${rows}</table></div></section>`;
}

function secLog() {
  const rows = [...S.log].map((x, i) => ({ x, n: i + 1 })).reverse().map(({ x, n }) => {
    const W = team(x.w), L = team(x.l);
    return `<tr><td>${n}</td><td>${when(x.t)}</td><td class="team" style="--c:${W.color}"><i></i>${esc(W.name)}</td><td>${esc(L.name)}</td><td>${money(x.bet)}</td>
      <td><button class="x" data-delset="${x.id}" aria-label="Quitar este set">✕</button></td></tr>`;
  }).join('');
  const table = S.log.length
    ? `<div class="scroll"><table><tr><th>N°</th><th>Hora</th><th>Ganó</th><th>Perdió</th><th>Monto</th><th></th></tr>${rows}</table></div>`
    : `<p class="empty">Los sets aparecerán aquí en orden, del más reciente al más antiguo.</p>`;
  return `<section class="card"><h2>Registro de sets</h2>${table}
    <div class="actions">
      <button class="ghost" data-undo ${S.log.length ? '' : 'disabled'}>Deshacer último set</button>
      <button class="danger" data-reset ${S.log.length ? '' : 'disabled'}>Empezar de cero</button>
    </div></section>`;
}

/* ===== Render ===== */
function render() {
  fixVs();
  const { won, lost, h2h } = stats();
  const ps = pairs();
  document.getElementById('count').innerHTML = `${S.log.length}<small>sets en total</small>`;
  document.getElementById('app').innerHTML = `
    <div class="cols">
      <div>${secTeams()}${secVersus(h2h)}</div>
      <div>${secDebts(ps)}${secRanking(won, lost, ps)}</div>
    </div>
    ${secMatrix(h2h)}
    ${secLog()}`;
}

/* ===== Eventos ===== */
document.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const d = b.dataset;
  if (d.win) return d.win === 'a' ? addSet(S.vs.a, S.vs.b) : addSet(S.vs.b, S.vs.a);
  if ('swap' in d) { [S.vs.a, S.vs.b] = [S.vs.b, S.vs.a]; save(); return render(); }
  if (d.remove) return removeTeam(d.remove);
  if (d.rename) return renameTeam(d.rename);
  if (d.delset) return removeSet(d.delset);
  if ('undo' in d) return undoLast();
  if ('reset' in d && confirm('¿Borrar todos los sets? Los capitanes se mantienen.')) { S.log = []; save(); render(); }
});

document.addEventListener('change', e => {
  const id = e.target.id;
  if (id === 'vsA') { S.vs.a = e.target.value; if (S.vs.b === S.vs.a) S.vs.b = null; save(); render(); }
  if (id === 'vsB') { S.vs.b = e.target.value; if (S.vs.a === S.vs.b) S.vs.a = null; save(); render(); }
  if (id === 'bet') { S.bet = Math.max(0, parseFloat(e.target.value) || 0); save(); render(); }
});

document.addEventListener('submit', e => {
  if (e.target.id !== 'addTeam') return;
  e.preventDefault();
  addTeam(e.target.name.value);
});

render();
