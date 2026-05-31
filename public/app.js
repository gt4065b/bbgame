/* ── State ── */
const state = {
  username: '',
  language: null,
  history: []   // { role: 'user'|'assistant', content: string }
};

const LANG_META = {
  korean:   { flag: '🇰🇷', label: '한국어' },
  chinese:  { flag: '🇨🇳', label: '中文' },
  english:  { flag: '🇺🇸', label: 'English' },
  japanese: { flag: '🇯🇵', label: '日本語' }
};

/* ── DOM refs ── */
const views = {
  login:    document.getElementById('login-view'),
  language: document.getElementById('language-view'),
  chat:     document.getElementById('chat-view')
};

const loginForm   = document.getElementById('login-form');
const usernameEl  = document.getElementById('username');
const passwordEl  = document.getElementById('password');
const loginError  = document.getElementById('login-error');
const displayName = document.getElementById('display-name');
const logoutBtn   = document.getElementById('logout-btn');
const langCards   = document.querySelectorAll('.lang-card');
const startBtn    = document.getElementById('start-btn');
const backBtn     = document.getElementById('back-btn');
const chatFlag    = document.getElementById('chat-flag');
const chatLabel   = document.getElementById('chat-lang-label');
const messagesEl  = document.getElementById('messages');
const msgInput    = document.getElementById('msg-input');
const sendBtn     = document.getElementById('send-btn');

/* ── View switching ── */
function showView(name) {
  Object.entries(views).forEach(([key, el]) => {
    el.classList.toggle('active', key === name);
  });
}

/* ── Login ── */
loginForm.addEventListener('submit', e => {
  e.preventDefault();
  const name = usernameEl.value.trim();
  const pass = passwordEl.value.trim();

  if (!name || !pass) {
    loginError.classList.remove('hidden');
    return;
  }
  loginError.classList.add('hidden');
  state.username = name;
  displayName.textContent = name;
  showView('language');
});

/* ── Logout ── */
logoutBtn.addEventListener('click', () => {
  state.username = '';
  state.language = null;
  state.history = [];
  usernameEl.value = '';
  passwordEl.value = '';
  langCards.forEach(c => c.classList.remove('selected'));
  startBtn.disabled = true;
  showView('login');
});

/* ── Language selection ── */
langCards.forEach(card => {
  card.addEventListener('click', () => {
    langCards.forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    state.language = card.dataset.lang;
    startBtn.disabled = false;
  });
});

/* ── Start conversation ── */
startBtn.addEventListener('click', async () => {
  const meta = LANG_META[state.language];
  chatFlag.textContent = meta.flag;
  chatLabel.textContent = meta.label;
  messagesEl.innerHTML = '';
  state.history = [];
  showView('chat');
  msgInput.focus();

  // Fetch initial greeting
  try {
    const res = await fetch(`/api/greeting?language=${state.language}`);
    const { greeting } = await res.json();
    appendMessage('ai', greeting);
    state.history.push({ role: 'assistant', content: greeting });
  } catch {
    appendMessage('ai', '안녕하세요! 연결에 문제가 생겼어요. 잠시 후 다시 시도해주세요.');
  }
});

/* ── Back to language selection ── */
backBtn.addEventListener('click', () => {
  state.history = [];
  showView('language');
});

/* ── Send message ── */
async function sendMessage() {
  const text = msgInput.value.trim();
  if (!text || sendBtn.disabled) return;

  msgInput.value = '';
  msgInput.style.height = 'auto';
  sendBtn.disabled = true;

  appendMessage('user', text);
  state.history.push({ role: 'user', content: text });

  const typingEl = appendTyping();
  scrollToBottom();

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: state.history, language: state.language })
    });

    if (!response.ok) {
      const err = await response.json();
      typingEl.remove();
      appendMessage('ai', `오류: ${err.error || '알 수 없는 오류'}`);
      sendBtn.disabled = false;
      return;
    }

    // Replace typing indicator with streaming bubble
    typingEl.remove();
    const { bubbleEl, textEl } = createAIBubble();

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete line

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6);
        if (payload === '[DONE]') break;

        try {
          const { delta, error } = JSON.parse(payload);
          if (error) {
            textEl.textContent = `오류: ${error}`;
            break;
          }
          if (delta) {
            fullText += delta;
            textEl.textContent = fullText;
            scrollToBottom();
          }
        } catch { /* skip malformed chunk */ }
      }
    }

    if (fullText) {
      state.history.push({ role: 'assistant', content: fullText });
    }
  } catch (err) {
    typingEl?.remove();
    appendMessage('ai', '연결 오류가 발생했습니다. 다시 시도해주세요.');
  } finally {
    sendBtn.disabled = false;
    msgInput.focus();
  }
}

sendBtn.addEventListener('click', sendMessage);

msgInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

/* Auto-resize textarea */
msgInput.addEventListener('input', () => {
  msgInput.style.height = 'auto';
  msgInput.style.height = msgInput.scrollHeight + 'px';
});

/* ── DOM helpers ── */
function appendMessage(role, text) {
  const row = document.createElement('div');
  row.className = `msg-row ${role}`;

  if (role === 'ai') {
    const avatar = document.createElement('div');
    avatar.className = 'msg-avatar';
    avatar.textContent = LANG_META[state.language]?.flag || '🤖';
    row.appendChild(avatar);
  }

  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  bubble.textContent = text;
  row.appendChild(bubble);

  messagesEl.appendChild(row);
  scrollToBottom();
  return row;
}

function appendTyping() {
  const row = document.createElement('div');
  row.className = 'msg-row ai';

  const avatar = document.createElement('div');
  avatar.className = 'msg-avatar';
  avatar.textContent = LANG_META[state.language]?.flag || '🤖';
  row.appendChild(avatar);

  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  bubble.innerHTML = `<div class="typing-dots">
    <span></span><span></span><span></span>
  </div>`;
  row.appendChild(bubble);

  messagesEl.appendChild(row);
  scrollToBottom();
  return row;
}

function createAIBubble() {
  const row = document.createElement('div');
  row.className = 'msg-row ai';
  row.style.animation = 'none';

  const avatar = document.createElement('div');
  avatar.className = 'msg-avatar';
  avatar.textContent = LANG_META[state.language]?.flag || '🤖';
  row.appendChild(avatar);

  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';

  const textEl = document.createElement('span');
  bubble.appendChild(textEl);
  row.appendChild(bubble);
  messagesEl.appendChild(row);

  return { bubbleEl: bubble, textEl };
}

function scrollToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}
