pub const PLAYER_HTML: &str = r#"<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>MusicBingo — Игрок</title>
<style>
  :root { --bg:#0f0f13; --card:#1a1a24; --accent:#ff4081; --text:#f0f0f0; --muted:#888; --cell:#252532; --marked:#4caf50; }
  * { box-sizing:border-box; }
  body { margin:0; font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; background:var(--bg); color:var(--text); padding:16px; }
  h1 { font-size:1.25rem; margin:0 0 8px; }
  .room { color:var(--muted); font-size:.9rem; margin-bottom:16px; }
  #status { padding:12px; border-radius:8px; background:var(--card); margin-bottom:16px; text-align:center; }
  #auth { background:var(--card); padding:16px; border-radius:12px; }
  input { width:100%; padding:12px; border-radius:8px; border:1px solid #333; background:#111; color:#fff; font-size:1rem; margin-bottom:12px; }
  button { width:100%; padding:14px; border-radius:8px; border:none; background:var(--accent); color:#fff; font-size:1rem; font-weight:600; cursor:pointer; }
  button:disabled { opacity:.5; }
  .grid { display:grid; grid-template-columns:repeat(5,1fr); gap:8px; margin-top:16px; }
  .cell { aspect-ratio:1; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; background:var(--cell); border-radius:10px; padding:4px; font-size:.7rem; cursor:pointer; transition:.2s; user-select:none; }
  .cell span { pointer-events:none; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden; width:100%; }
  .cell .artist { color:var(--muted); font-size:.6rem; margin-top:2px; }
  .cell.marked { background:var(--marked); color:#fff; }
  .bingo-btn { margin-top:16px; background:#ff9800; }
  .winner { background:#4caf50 !important; }
</style>
</head>
<body>
<h1>🎵 MusicBingo</h1>
<div class="room" id="room">Код комнаты: <b id="roomCode">—</b></div>

<div id="status">Подключение...</div>

<div id="auth">
  <input id="name" placeholder="Ваше имя или ник" maxlength="20">
  <button onclick="join()">Получить карточку</button>
</div>

<div id="game" style="display:none;">
  <div class="grid" id="grid"></div>
  <button class="bingo-btn" id="bingoBtn" onclick="claimBingo()">🎉 БИНГО!</button>
</div>

<script>
const base = location.origin;
const roomCodeEl = document.getElementById('roomCode');
const statusEl = document.getElementById('status');
let playerId = localStorage.getItem('mb_player_id') || '';
let state = null;

async function poll(){
  try {
    const r = await fetch(base + '/api/game/state' + (playerId ? '?player_id='+playerId : ''));
    state = await r.json();
    roomCodeEl.textContent = state.room_code || '—';
    render();
  } catch(e){
    statusEl.textContent = 'Ожидание ведущего...';
  }
  setTimeout(poll, 2000);
}

function render(){
  if(state.phase === 'lobby' && !playerId){
    statusEl.textContent = 'Ведущий готовится. Введите имя и получите карточку.';
    return;
  }
  if(state.bingo_confirmed){
    statusEl.innerHTML = '<b>🎉 Бинго подтверждено!</b>';
    statusEl.className='winner';
  } else if(state.bingo_claimed){
    statusEl.textContent = 'Проверяем бинго...';
  } else {
    statusEl.textContent = state.round_pattern ? ('Раунд '+state.round_number+' — '+state.round_pattern) : 'Ожидание начала раунда';
  }
  if(state.card && state.card.length){
    document.getElementById('auth').style.display='none';
    document.getElementById('game').style.display='block';
    const grid = document.getElementById('grid');
    grid.innerHTML = '';
    state.card.forEach((cell, idx)=>{
      const div = document.createElement('div');
      div.className = 'cell' + (cell.marked ? ' marked' : '');
      div.innerHTML = '<span>'+escapeHtml(cell.title)+'</span><span class="artist">'+escapeHtml(cell.artist)+'</span>';
      div.onclick = ()=> toggleMark(idx);
      grid.appendChild(div);
    });
  }
}

async function join(){
  const name = document.getElementById('name').value.trim();
  if(!name) return alert('Введите имя');
  const r = await fetch(base + '/api/game/join', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({name})
  });
  const data = await r.json();
  if(data.player_id){
    playerId = data.player_id;
    localStorage.setItem('mb_player_id', playerId);
    document.getElementById('auth').style.display='none';
  }
}

async function toggleMark(idx){
  if(!playerId || !state || !state.card) return;
  const cell = state.card[idx];
  const r = await fetch(base + '/api/game/mark', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({player_id: playerId, track_id: cell.track_id})
  });
  const data = await r.json();
  if(data.card) state.card = data.card;
  render();
}

async function claimBingo(){
  if(!playerId) return;
  await fetch(base + '/api/game/bingo', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({player_id: playerId})
  });
}

function escapeHtml(t){ return (t||'').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[m])); }

poll();
</script>
</body>
</html>"#;
