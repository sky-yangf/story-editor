/**
 * 生成可独立分发的单文件 HTML 试玩包
 * - 不依赖任何外部资源（CDN / 模块）
 * - 内嵌纯 JS 版 runtime（与 src/runtime/*.ts 行为一致）
 * - 玩家双击 .html 即可在浏览器游玩
 */

// ===== Runtime JS（与 src/runtime/*.ts 行为完全一致，纯函数） =====
const RUNTIME_JS = `
function initRunState(story, startNode) {
  var initial = startNode.initialState || {};
  return {
    currentNodeId: startNode.id,
    variables: Object.assign({}, initial.variables || {}),
    inventory: (initial.inventory || []).slice(),
    history: [startNode.id],
    isEnded: false,
    startTime: Date.now()
  };
}
function pushHistory(state, nodeId) {
  var h = state.history.slice();
  h.push(nodeId);
  return Object.assign({}, state, { history: h });
}
function toGameState(state) {
  return { variables: state.variables, inventory: state.inventory, history: state.history };
}
function evaluateCondition(cond, state) {
  switch (cond.type) {
    case 'compare': {
      var a = state.variables[cond.key];
      if (a === undefined) return false;
      var av = Number(a), bv = Number(cond.value);
      switch (cond.op) {
        case '>=': return av >= bv;
        case '>':  return av > bv;
        case '==': return a === cond.value;
        case '<':  return av < bv;
        case '<=': return av <= bv;
        case '!=': return a !== cond.value;
      }
      return false;
    }
    case 'has_item':     return state.inventory.indexOf(cond.item) >= 0;
    case 'not_has_item': return state.inventory.indexOf(cond.item) < 0;
    case 'and': return cond.conditions.every(function(c){ return evaluateCondition(c, state); });
    case 'or':  return cond.conditions.some(function(c){ return evaluateCondition(c, state); });
  }
}
function applyEffect(eff, state) {
  switch (eff.type) {
    case 'set': {
      var v = state.variables; var c = Object.assign({}, v); c[eff.key] = eff.value;
      return Object.assign({}, state, { variables: c });
    }
    case 'add': {
      var v = state.variables; var c = Object.assign({}, v);
      c[eff.key] = (Number(v[eff.key] || 0) + eff.value);
      return Object.assign({}, state, { variables: c });
    }
    case 'add_item': {
      if (state.inventory.indexOf(eff.item) >= 0) return state;
      var inv = state.inventory.slice(); inv.push(eff.item);
      return Object.assign({}, state, { inventory: inv });
    }
    case 'remove_item': {
      var inv = state.inventory.filter(function(i){ return i !== eff.item; });
      return Object.assign({}, state, { inventory: inv });
    }
  }
}
function applyEffects(effects, state) {
  return effects.reduce(function(s, e){ return applyEffect(e, s); }, state);
}
function findNextEdge(story, sourceId, handle) {
  return story.edges.find(function(e){
    return e.source === sourceId && (handle ? e.sourceHandle === handle : !e.sourceHandle);
  }) || null;
}
function checkEnding(state, story) {
  var n = story.nodes[state.currentNodeId];
  if (n && n.type === 'ending') return Object.assign({}, state, { isEnded: true });
  return state;
}
function restart(story) {
  var startNode = null;
  for (var k in story.nodes) {
    if (story.nodes[k].type === 'start') { startNode = story.nodes[k]; break; }
  }
  if (!startNode) return null;
  return initRunState(story, startNode);
}
function advance(story, state) {
  var node = story.nodes[state.currentNodeId];
  if (node.type !== 'start' && node.type !== 'narrative') {
    return { newState: state, error: '节点类型 ' + node.type + ' 不可 advance' };
  }
  var edge = findNextEdge(story, state.currentNodeId);
  if (!edge) return { newState: state, error: '没有下一节点' };
  var s = pushHistory(state, edge.target);
  s.currentNodeId = edge.target;
  return { newState: checkEnding(s, story) };
}
function selectOption(story, state, idx) {
  var node = story.nodes[state.currentNodeId];
  if (node.type !== 'choice') return { newState: state, error: '不是选项节点' };
  var opt = node.options[idx];
  if (!opt) return { newState: state, error: '选项不存在' };
  var s = applyEffects(opt.effects || [], toGameState(state));
  // 把 GameState 字段保留 + currentNodeId/isEnded/startTime
  s = Object.assign({}, state, s);
  var edge = findNextEdge(story, state.currentNodeId, 'option-' + idx);
  if (!edge) return { newState: s, error: '选项没有连出' };
  s = pushHistory(s, edge.target);
  s.currentNodeId = edge.target;
  return { newState: checkEnding(s, story) };
}
function resolveCondition(story, state) {
  var node = story.nodes[state.currentNodeId];
  if (node.type !== 'condition') return { newState: state, error: '不是条件节点' };
  var passed = node.conditions.every(function(c){ return evaluateCondition(c, toGameState(state)); });
  var handle = passed ? 'true' : 'false';
  var edge = findNextEdge(story, state.currentNodeId, handle);
  if (!edge) return { newState: state, error: '条件节点没有 ' + handle + ' 分支' };
  var s = pushHistory(state, edge.target);
  s.currentNodeId = edge.target;
  return { newState: checkEnding(s, story) };
}
function startGame(story) {
  var rs = restart(story);
  if (!rs) return { newState: null, error: '找不到开始节点' };
  // 自动跳过 start
  var r = advance(story, rs);
  if (!r.error) rs = r.newState;
  return { newState: rs, error: r.error || null };
}
`.trim()

// ===== Player HTML/JS 模板（自包含） =====
const PLAYER_JS = `
var STORY = window.__STORY__;
var runState = null;
var error = null;

function start() {
  var r = startGame(STORY);
  runState = r.newState;
  error = r.error;
  render();
}
function choose(i) {
  var r = selectOption(STORY, runState, i);
  runState = r.newState;
  error = r.error;
  render();
}
function advanceNow() {
  if (!runState) return;
  var node = STORY.nodes[runState.currentNodeId];
  var r;
  if (node.type === 'start' || node.type === 'narrative') r = advance(STORY, runState);
  else if (node.type === 'condition') r = resolveCondition(STORY, runState);
  else { error = '当前类型 ' + node.type + ' 不可 advance'; render(); return; }
  runState = r.newState; error = r.error; render();
}
function restartGame() {
  var r = startGame(STORY);
  runState = r.newState; error = r.error; render();
}
function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function labelType(t) {
  return ({ start:'🎬 开始', narrative:'📖 叙述', choice:'❓ 选项', condition:'🔀 条件', ending:'🏁 结局' })[t] || t;
}
function render() {
  var root = document.getElementById('root');
  if (!runState) {
    root.innerHTML = '<div class="card"><div class="muted">故事未加载。</div>'
      + (error ? '<div class="err">⚠ ' + esc(error) + '</div>' : '')
      + '<button class="btn-primary" onclick="start()">▶ 开始</button></div>';
    return;
  }
  var node = STORY.nodes[runState.currentNodeId];
  if (!node) {
    root.innerHTML = '<div class="card err">⚠ 节点 #' + esc(runState.currentNodeId) + ' 不存在</div>'
      + '<button class="btn-primary" onclick="restartGame()">↻ 重新开始</button>';
    return;
  }
  var html = '';
  // 故事元数据头（封面/作者/简介）
  var meta = STORY.description || STORY.author || STORY.cover;
  if (meta) {
    var authorPart = STORY.author ? ' · by ' + esc(STORY.author) : '';
    var versionPart = STORY.version ? ' <span class="muted small">v' + esc(STORY.version) + '</span>' : '';
    html += '<div class="meta-card">'
      + (STORY.cover ? '<img class="cover" src="' + esc(STORY.cover) + '" alt="封面" onerror="this.style.display=\x6E\x6F\x6E\x65" />' : '')
      + '<div>'
      +   (STORY.description ? '<div class="meta-desc">' + esc(STORY.description) + '</div>' : '')
      +   '<div class="meta-author">' + authorPart + versionPart + '</div>'
      + '</div></div>';
  }
  // 头部
  html += '<div class="header">'
    + '<div><div class="muted small">正在游玩</div><div class="title">🎮 ' + esc(STORY.title) + '</div></div>'
    + '<div class="header-actions">'
    +   '<button class="btn-ghost" onclick="restartGame()" title="重新开始">↻</button>'
    + '</div></div>';
  // 状态栏
  var v = runState.variables || {};
  var vKeys = Object.keys(v);
  var vChips = vKeys.length
    ? vKeys.map(function(k){ return '<span class="chip-var">' + esc(k) + ' = <b>' + esc(v[k]) + '</b></span>'; }).join('')
    : '<span class="muted small">（无变量）</span>';
  var invChips = '';
  if (runState.inventory && runState.inventory.length) {
    invChips = '<div class="muted small" style="margin-top:6px">🎒 物品（' + runState.inventory.length + '）</div>'
      + '<div class="chip-row">' + runState.inventory.map(function(i){ return '<span class="chip-item">· ' + esc(i) + '</span>'; }).join('') + '</div>';
  }
  html += '<div class="card state-bar"><div class="muted small bold">📊 状态</div>'
    + '<div class="chip-row">' + vChips + '</div>' + invChips + '</div>';
  // 当前节点
  html += '<div class="card">'
    + '<div class="muted small">' + esc(labelType(node.type)) + ' · ' + esc(node.id) + '</div>'
    + '<div class="node-title">' + esc(node.title) + '</div>'
    + (node.description ? '<div class="node-desc">' + esc(node.description) + '</div>' : '')
    + '</div>';
  // 类型分支
  if (node.type === 'narrative') {
    html += '<button class="btn-primary" onclick="advanceNow()">继续 →</button>';
  } else if (node.type === 'condition') {
    html += '<button class="btn-primary" onclick="advanceNow()">判定 →</button>';
  } else if (node.type === 'choice') {
    var opts = node.options;
    if (node.prompt) html += '<div class="prompt">' + esc(node.prompt) + '</div>';
    for (var i = 0; i < opts.length; i++) {
      html += '<button class="btn-choice" onclick="choose(' + i + ')">'
        + '<span class="muted small">' + (i + 1) + '.</span> '
        + esc(opts[i].text || '（空选项）') + '</button>';
    }
  } else if (node.type === 'ending') {
    html += '<div class="ending">'
      + '<div class="big-emoji">🏁</div>'
      + '<div class="ending-title">' + esc(node.endingTitle) + '</div>'
      + (node.hidden ? '<div class="muted small">（隐藏结局 · 已解锁）</div>' : '')
      + '<button class="btn-primary" style="margin-top:12px" onclick="restartGame()">↻ 再玩一次</button>'
      + '</div>';
  }
  // 错误
  if (error) {
    html += '<div class="card err">⚠ ' + esc(error) + '</div>';
  }
  // 历史
  html += '<details class="history"><summary class="muted small">历史轨迹（' + runState.history.length + ' 步）</summary><ol class="history-list">';
  for (var j = 0; j < runState.history.length; j++) {
    var hid = runState.history[j];
    var hn = STORY.nodes[hid];
    html += '<li><span class="muted">' + esc(hid) + '</span> · ' + esc((hn && hn.title) || '(不存在)') + '</li>';
  }
  html += '</ol></details>';
  root.innerHTML = html;
}
// 启动
start();
`.trim()

const PLAYER_CSS = `
* { box-sizing: border-box; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  margin: 0; padding: 16px;
  background: #f3f4f6; color: #1f2937;
  max-width: 720px; margin: 0 auto;
}
#root { display: flex; flex-direction: column; gap: 12px; }
.card { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px; }
.header { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; }
.header-actions { display: flex; gap: 4px; }
.title { font-size: 16px; font-weight: 700; }
.node-title { font-size: 18px; font-weight: 700; margin-bottom: 8px; }
.node-desc { font-size: 14px; color: #374151; line-height: 1.6; white-space: pre-wrap; }
.state-bar { background: #f9fafb; }
.chip-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
.chip-var { font-size: 12px; padding: 2px 8px; background: #dbeafe; color: #1e3a8a; border-radius: 4px; }
.chip-item { font-size: 12px; padding: 2px 8px; background: #fef3c7; color: #78350f; border-radius: 4px; }
.prompt { font-size: 13px; color: #4b5563; font-weight: 600; margin-bottom: 6px; }
.btn-primary { font-size: 14px; padding: 10px 18px; background: #2563eb; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; }
.btn-primary:hover { background: #1d4ed8; }
.btn-ghost { font-size: 14px; padding: 4px 10px; background: transparent; color: #6b7280; border: 1px solid #d1d5db; border-radius: 4px; cursor: pointer; }
.btn-choice { font-size: 14px; padding: 10px 14px; background: #f9fafb; color: #1f2937; border: 1px solid #d1d5db; border-radius: 6px; cursor: pointer; text-align: left; }
.btn-choice:hover { background: #f3f4f6; border-color: #9ca3af; }
.ending { text-align: center; padding: 16px 0; }
.big-emoji { font-size: 28px; margin-bottom: 8px; }
.ending-title { font-size: 20px; font-weight: 700; color: #16a34a; }
.muted { color: #6b7280; }
.small { font-size: 12px; }
.bold { font-weight: 600; }
.err { color: #dc2626; background: #fee2e2; border-color: #fca5a5; }
.history { margin-top: 8px; }
.history-list { font-size: 12px; color: #4b5563; padding-left: 20px; margin-top: 4px; }
summary { cursor: pointer; }
.meta-card {
  display: flex; gap: 12px; align-items: flex-start;
  background: #fff; border: 1px solid #e5e7eb; border-radius: 8px;
  padding: 12px;
}
.meta-card .cover {
  width: 80px; height: 80px; object-fit: cover;
  border-radius: 6px; flex-shrink: 0;
}
.meta-card .meta-desc {
  font-size: 13px; color: #4b5563; line-height: 1.5;
  white-space: pre-wrap; margin-bottom: 6px;
}
.meta-card .meta-author {
  font-size: 12px; color: #6b7280; font-weight: 500;
}
`.trim()

/**
 * 把 Story 转成完整可玩的 HTML 字符串
 */
export function exportStoryHtml(story: import('../types').Story): string {
  const storyJson = JSON.stringify(story)
    .replace(/<\/script>/gi, '<\\/script>')   // 防注入
    .replace(/<!--/g, '<\\!--')

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(story.title)} · 故事试玩</title>
<style>${PLAYER_CSS}</style>
</head>
<body>
<div id="root"></div>
<script>window.__STORY__ = ${storyJson};</script>
<script>${RUNTIME_JS}</script>
<script>${PLAYER_JS}</script>
</body>
</html>`
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
