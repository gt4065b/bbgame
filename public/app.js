/* ── State ── */
const state = {
  username: '',
  language: null,
  level: null,
  history: []
};

const LANG_META = {
  korean:   { flag: '🇰🇷', label: '한국어', code: 'ko-KR' },
  chinese:  { flag: '🇨🇳', label: '中文',   code: 'zh-CN' },
  english:  { flag: '🇺🇸', label: 'English', code: 'en-US' },
  japanese: { flag: '🇯🇵', label: '日本語', code: 'ja-JP' }
};

/* ── DOM refs ── */
const views = {
  login:    document.getElementById('login-view'),
  language: document.getElementById('language-view'),
  chat:     document.getElementById('chat-view')
};

const loginForm      = document.getElementById('login-form');
const usernameEl     = document.getElementById('username');
const passwordEl     = document.getElementById('password');
const loginError     = document.getElementById('login-error');
const displayName    = document.getElementById('display-name');
const logoutBtn      = document.getElementById('logout-btn');
const langCards      = document.querySelectorAll('.lang-card');
const levelCards     = document.querySelectorAll('.level-card');
const startBtn       = document.getElementById('start-btn');
const backBtn        = document.getElementById('back-btn');
const chatFlag       = document.getElementById('chat-flag');
const chatLabel      = document.getElementById('chat-lang-label');
const messagesEl     = document.getElementById('messages');
const msgInput       = document.getElementById('msg-input');
const sendBtn        = document.getElementById('send-btn');
const micBtn         = document.getElementById('mic-btn');
const wakelockBadge  = document.getElementById('wakelock-badge');
const micOnIcon      = document.getElementById('mic-on-icon');
const micOffIcon     = document.getElementById('mic-off-icon');

/* ── View switching ── */
function showView(name) {
  Object.entries(views).forEach(([key, el]) => {
    el.classList.toggle('active', key === name);
  });
}

/* ════════════════════════════════
   로그인 (고정 계정)
   ════════════════════════════════ */
const VALID_ID = 'wsu2026';
const VALID_PW = 'ai2026';

loginForm.addEventListener('submit', e => {
  e.preventDefault();
  const id   = usernameEl.value.trim();
  const pass = passwordEl.value.trim();

  if (id !== VALID_ID || pass !== VALID_PW) {
    loginError.textContent = '아이디 또는 비밀번호가 올바르지 않습니다.';
    loginError.classList.remove('hidden');
    passwordEl.value = '';
    passwordEl.focus();
    return;
  }
  loginError.classList.add('hidden');
  state.username = id;
  displayName.textContent = id;
  showView('language');
});

/* ── 로그아웃 ── */
logoutBtn.addEventListener('click', () => {
  state.username = '';
  state.language = null;
  state.level    = null;
  state.history  = [];
  usernameEl.value = '';
  passwordEl.value = '';
  langCards.forEach(c => c.classList.remove('selected'));
  levelCards.forEach(c => c.classList.remove('selected'));
  startBtn.disabled = true;
  stopListening();
  releaseWakeLock();
  showView('login');
});

/* ════════════════════════════════
   언어 + 수준 선택
   ════════════════════════════════ */
function updateStartBtn() {
  startBtn.disabled = !(state.language && state.level);
}

langCards.forEach(card => {
  card.addEventListener('click', () => {
    langCards.forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    state.language = card.dataset.lang;
    updateStartBtn();
  });
});

levelCards.forEach(card => {
  card.addEventListener('click', () => {
    levelCards.forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    state.level = card.dataset.level;
    updateStartBtn();
  });
});

/* ════════════════════════════════
   대화 시작
   ════════════════════════════════ */
startBtn.addEventListener('click', async () => {
  const meta = LANG_META[state.language];
  chatFlag.textContent  = meta.flag;
  chatLabel.textContent = meta.label;
  messagesEl.innerHTML  = '';
  state.history = [];
  showView('chat');
  msgInput.focus();
  initSpeechRecognition();
  await requestWakeLock();

  try {
    const res = await fetch(`/api/greeting?language=${state.language}`);
    const { greeting } = await res.json();
    appendMessage('ai', greeting);
    state.history.push({ role: 'assistant', content: greeting });
  } catch {
    appendMessage('ai', '안녕하세요! 연결에 문제가 생겼어요. 잠시 후 다시 시도해주세요.');
  }
});

/* ── 뒤로 ── */
backBtn.addEventListener('click', () => {
  stopListening();
  releaseWakeLock();
  state.history = [];
  showView('language');
});

/* ════════════════════════════════
   Wake Lock — 화면 꺼짐 방지
   ════════════════════════════════ */
let wakeLock = null;

async function requestWakeLock() {
  if (!('wakeLock' in navigator)) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakelockBadge.classList.remove('hidden');
    wakeLock.addEventListener('release', () => {
      wakelockBadge.classList.add('hidden');
      wakeLock = null;
    });
  } catch (err) {
    console.warn('Wake Lock 획득 실패:', err.message);
  }
}

function releaseWakeLock() {
  if (wakeLock) { wakeLock.release(); }
  wakelockBadge.classList.add('hidden');
}

/* 화면이 다시 켜지면 Wake Lock 재획득 */
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible' && views.chat.classList.contains('active')) {
    await requestWakeLock();
  }
});

/* ════════════════════════════════
   음성 입력 (Web Speech API)
   ════════════════════════════════ */
let recognition = null;
let isListening = false;

function initSpeechRecognition() {
  if (recognition) return; // 이미 초기화됨

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    micBtn.classList.add('unsupported');
    return;
  }

  recognition = new SR();
  recognition.continuous = false;
  recognition.interimResults = true;

  recognition.onresult = e => {
    const transcript = Array.from(e.results)
      .map(r => r[0].transcript)
      .join('');
    msgInput.value = transcript;
    autoResizeTextarea();

    if (e.results[e.results.length - 1].isFinal) {
      isListening = false;
      updateMicUI();
      sendMessage();
    }
  };

  recognition.onend = () => {
    isListening = false;
    updateMicUI();
  };

  recognition.onerror = err => {
    console.warn('음성 인식 오류:', err.error);
    isListening = false;
    updateMicUI();
  };
}

function startListening() {
  if (!recognition) return;
  recognition.lang = LANG_META[state.language]?.code || 'en-US';
  try {
    recognition.start();
    isListening = true;
    updateMicUI();
  } catch (e) {
    console.warn('recognition.start 오류:', e);
  }
}

function stopListening() {
  if (!recognition) return;
  try { recognition.stop(); } catch (_) {}
  isListening = false;
  updateMicUI();
}

function updateMicUI() {
  micBtn.classList.toggle('recording', isListening);
  micOnIcon.style.display  = isListening ? 'none'  : 'block';
  micOffIcon.style.display = isListening ? 'block' : 'none';
  micBtn.title = isListening
    ? '음성 인식 중… (클릭하면 중지)'
    : '마이크를 눌러 말하기';
}

micBtn.addEventListener('click', () => {
  if (isListening) stopListening();
  else             startListening();
});

/* ════════════════════════════════
   메시지 전송
   ════════════════════════════════ */
async function sendMessage() {
  const text = msgInput.value.trim();
  if (!text || sendBtn.disabled) return;

  msgInput.value = '';
  autoResizeTextarea();
  sendBtn.disabled = true;

  appendMessage('user', text);
  state.history.push({ role: 'user', content: text });

  const typingEl = appendTyping();
  scrollToBottom();

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: state.history,
        language: state.language,
        level:    state.level
      })
    });

    if (!response.ok) {
      const err = await response.json();
      typingEl.remove();
      appendMessage('ai', `오류: ${err.error || '알 수 없는 오류'}`);
      sendBtn.disabled = false;
      return;
    }

    typingEl.remove();
    const { bubbleEl, textEl } = createAIBubble();

    const reader  = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText  = '';
    let buffer    = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6);
        if (payload === '[DONE]') break;

        try {
          const { delta, error } = JSON.parse(payload);
          if (error) { textEl.textContent = `오류: ${error}`; break; }
          if (delta) {
            fullText += delta;
            textEl.textContent = fullText;
            scrollToBottom();
          }
        } catch { /* 불완전한 청크 무시 */ }
      }
    }

    if (fullText) {
      state.history.push({ role: 'assistant', content: fullText });
      renderVocabSection(bubbleEl, fullText);
      scrollToBottom();
    }
  } catch {
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

function autoResizeTextarea() {
  msgInput.style.height = 'auto';
  msgInput.style.height = msgInput.scrollHeight + 'px';
}
msgInput.addEventListener('input', autoResizeTextarea);

/* ════════════════════════════════
   DOM 헬퍼
   ════════════════════════════════ */
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
  bubble.innerHTML = `<div class="typing-dots"><span></span><span></span><span></span></div>`;
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

/* 스트리밍 완료 후 📚 섹션을 분리해 스타일 적용 */
function renderVocabSection(bubble, fullText) {
  const marker = '📚 주요 단어';
  const idx = fullText.indexOf(marker);
  if (idx === -1) return;

  const mainText  = fullText.slice(0, idx).trimEnd();
  const vocabText = fullText.slice(idx);

  bubble.innerHTML = '';

  const mainEl = document.createElement('p');
  mainEl.style.whiteSpace = 'pre-wrap';
  mainEl.style.marginBottom = '12px';
  mainEl.textContent = mainText;
  bubble.appendChild(mainEl);

  const vocabEl = document.createElement('div');
  vocabEl.className = 'vocab-box';
  vocabEl.textContent = vocabText;
  bubble.appendChild(vocabEl);
}

function scrollToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}
