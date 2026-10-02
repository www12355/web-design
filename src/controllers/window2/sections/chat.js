/* ============================================================
   第 2 屏 section · 群聊（原 window2.js 群聊块逐行等价迁移，P3-1）
   挂载条件：页面存在 .chat__thread。缺容器时整体不挂载，bus.chat 保持 no-op。
   ============================================================ */
import { openDocReview } from '../../../modules/docgen.js';
import {
  fmtAgo, AVATAR_MAP, gsapOK, later,
  whoName, chatEsc, getDocRef, bus, onPageHide
} from '../shared.js';

let chatOrb = null;

export function initChat() {
  const thread = document.querySelector('.chat__thread');
  if (!thread) return;   /* 本页无群聊（screen3/4）：不挂载，bus.chat 保持空转 */

  /* 聊天头部主 AI（白色小球，暖底可读）；持有句柄以便卸载时 stop（P0-1） */
  chatOrb = Bloub.mount(document.getElementById('chat-main'), {
    size: 40, shape: 'cercle', ink: '#ffffff', expression: 'attentif', state: 'idle', paper: '#2C2C2E'
  });
  onPageHide(() => { if (chatOrb && chatOrb.stop) chatOrb.stop(); });

  /* 群聊头像：按角色渲染真实小球（缩小版） */
  document.querySelectorAll('.avatar-slot[data-who]').forEach(el => {
    const c = AVATAR_MAP[el.dataset.who];
    if (!c) return;
    if (el.dataset.who === 'main') el.classList.add('bot-white');
    el.innerHTML = Bloub.static({ size: 34, expression: 'neutre', state: 'idle', ...c });
  });

  const chatCount = document.getElementById('chat-count');
  let typingRow = null;
  function showTyping(who) {
    hideTyping();
    const row = document.createElement('div');
    row.className = 'chat-row';
    const av = document.createElement('span');
    av.className = 'avatar-slot' + (who === 'main' ? ' bot-white' : '');
    av.innerHTML = Bloub.static({ size: 34, expression: 'neutre', state: 'idle', ...AVATAR_MAP[who] });
    const t = document.createElement('div');
    t.className = 'typing';
    t.innerHTML = `${whoName(who)} 正在输入<span class="dots"><i></i><i></i><i></i></span>`;
    row.append(av, t);
    thread.appendChild(row);
    typingRow = row;
    thread.scrollTop = thread.scrollHeight;
  }
  function hideTyping() { if (typingRow) { typingRow.remove(); typingRow = null; } }

  const chatQ = [];
  let draining = false;
  function queueChat(who, text, isMain, think, meta = {}) { chatQ.push({ who, text, isMain, think, meta }); drainChat(); }
  function drainChat() {
    if (draining || !chatQ.length) return;
    draining = true;
    const m = chatQ.shift();
    showTyping(m.who);
    later(() => {
      hideTyping();
      const row = addChatRow(m.who, m.text, m.isMain, m.think, m.meta);
      draining = false;
      drainChat();
      return row;
    }, 1000 + Math.random() * 1500);
  }
  function addChatRow(who, text, isMain, think, meta = {}) {
    const row = document.createElement('div');
    row.className = 'chat-row' + (isMain ? ' chat-row--ai' : '');
    const av = document.createElement('span');
    av.className = 'avatar-slot' + (who === 'main' ? ' bot-white' : '');
    av.title = whoName(who);
    av.innerHTML = Bloub.static({ size: 34, expression: 'neutre', state: 'idle', ...AVATAR_MAP[who] });
    const b = document.createElement('div');
    const isFile = meta.kind === 'file' || meta.kind === 'review';
    const clickable = isFile && !!meta.docId;
    b.className = 'bubble' + (isMain ? ' bubble--ai' : '') + (isFile ? ' bubble--file' : '') + (clickable ? ' is-clickable' : '');
    if (clickable) {
      b.dataset.docId = meta.docId;
      b.setAttribute('role', 'button');
      b.setAttribute('tabindex', '0');
      b.setAttribute('aria-label', `打开交付审阅：${meta.fileName || meta.docId}`);
      b.title = '点击打开交付审阅';
    }
    const thinkHtml = think ? (() => {
      const ts = Date.now();
      return `<div class="bubble__think"><b><svg viewBox="0 0 24 24"><path d="M9 18h6M10 21h4M12 3a6 6 0 00-4 10.5c.6.5 1 1.2 1 2h6c0-.8.4-1.5 1-2A6 6 0 0012 3z"/></svg>思考 · <span data-ts="${ts}">${fmtAgo(ts)}</span></b>${chatEsc(think)}</div>`;
    })() : '';
    const cardHtml = isFile ? `<div class="bubble-file" data-file-kind="${chatEsc(meta.kind)}">
      <svg class="bubble-file__icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#ft-word"></use></svg>
      <div class="bubble-file__main"><b>${chatEsc(meta.fileName || '交付方案.docx')}</b><span>${chatEsc(meta.fileMeta || '交付方案 · DOCX')}</span><small>${chatEsc(meta.fileSub || '主 AI 生成')} · ${chatEsc(meta.fileSize || '文件已同步')}</small></div>
      <strong>${chatEsc(meta.fileType || 'DOCX')}</strong><em>${chatEsc(meta.fileStatus || '已生成')}</em>
    </div>` : chatEsc(text);
    b.innerHTML = `${thinkHtml}${cardHtml}<div class="bubble__time" data-ts="${Date.now()}">${fmtAgo(Date.now())}</div>`;
    row.append(av, b);
    thread.appendChild(row);
    const rows = thread.querySelectorAll('.chat-row');
    if (rows.length > 46) rows[0].remove();
    thread.scrollTop = thread.scrollHeight;
    if (chatCount) chatCount.textContent = rows.length;
    if (gsapOK()) gsap.from(row, { y: 12, autoAlpha: 0, duration: 0.4, ease: 'power2.out' });
    return row;
  }
  /* 交付文件气泡：点击 / 回车 / 空格 → 重新打开该文档的审阅弹窗
     用事件委托只绑一次：气泡随消息动态增删、且超过 46 行会被裁剪，无需逐条绑定与解绑 */
  function reviewFromBubble(target) {
    const bubble = target && target.closest ? target.closest('.bubble--file[data-doc-id]') : null;
    if (!bubble || !thread.contains(bubble)) return false;
    const ref = getDocRef(bubble.dataset.docId);
    if (!ref) return false;
    bus.eb.wakeIdle();
    openDocReview(ref.content, ref.order, { context: ref.context });
    return true;
  }
  thread.addEventListener('click', (e) => reviewFromBubble(e.target));
  thread.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if (reviewFromBubble(e.target)) e.preventDefault();
  });
  function addReact(row, txt) {
    if (!row || !row.after) return;
    later(() => {
      const r = document.createElement('span');
      r.className = 'msg-react';
      r.innerHTML = `<svg class="msg-react__ic" aria-hidden="true"><use href="#ic-check"/></svg>${txt}`;
      row.after(r);
      if (gsapOK()) gsap.from(r, { scale: 0.6, autoAlpha: 0, duration: 0.35, ease: 'back.out(2)' });
    }, 2200 + Math.random() * 2200);
  }

  bus.chat = {
    queueChat,
    addReact,
    lastRow() {
      const rows = thread.querySelectorAll('.chat-row');
      return rows[rows.length - 1] || null;
    },
    threadRows() {
      return [...thread.querySelectorAll('.chat-row')].slice(-10).map(row => ({
        who: whoName(row.querySelector('.avatar-slot')?.dataset.who || 'main'),
        text: row.querySelector('.bubble')?.innerText || row.querySelector('.typing')?.innerText || '',
        main: row.classList.contains('chat-row--ai'),
        time: (() => { const el = row.querySelector('.bubble__time'); const t = el && el.dataset.ts ? +el.dataset.ts : null; return t || Date.now(); })()
      })).filter(r => r.text);
    },
    discussion() {
      return [...thread.querySelectorAll('.bubble')].slice(-18).map(b => b.innerText).filter(Boolean);
    }
  };
}
