/* ════════════════════════════════
   State
   ════════════════════════════════ */
const state = {
  username: '',
  language: null,
  level:    null,
  history:  []
};

const LANG_META = {
  korean:   { flag: '🇰🇷', label: '한국어', code: 'ko-KR' },
  chinese:  { flag: '🇨🇳', label: '中文',   code: 'zh-CN' },
  english:  { flag: '🇺🇸', label: 'English', code: 'en-US' },
  japanese: { flag: '🇯🇵', label: '日本語', code: 'ja-JP' }
};

/* ════════════════════════════════
   DOM refs
   ════════════════════════════════ */
const views        = { login: document.getElementById('login-view'), language: document.getElementById('language-view'), chat: document.getElementById('chat-view') };
const loginForm    = document.getElementById('login-form');
const usernameEl   = document.getElementById('username');
const passwordEl   = document.getElementById('password');
const loginError   = document.getElementById('login-error');
const displayName  = document.getElementById('display-name');
const logoutBtn    = document.getElementById('logout-btn');
const langCards    = document.querySelectorAll('.lang-card');
const levelCards   = document.querySelectorAll('.level-card');
const startBtn     = document.getElementById('start-btn');
const backBtn      = document.getElementById('back-btn');
const chatFlag     = document.getElementById('chat-flag');
const chatLabel    = document.getElementById('chat-lang-label');
const messagesEl   = document.getElementById('messages');
const msgInput     = document.getElementById('msg-input');
const sendBtn      = document.getElementById('send-btn');
const micBtn       = document.getElementById('mic-btn');
const micOnIcon    = document.getElementById('mic-on-icon');
const micOffIcon   = document.getElementById('mic-off-icon');
const wakelockBadge = document.getElementById('wakelock-badge');
const ttsBtn       = document.getElementById('tts-btn');

/* ════════════════════════════════
   View switching
   ════════════════════════════════ */
function showView(name) {
  Object.entries(views).forEach(([k, el]) => el.classList.toggle('active', k === name));
}

/* ════════════════════════════════
   로그인 (고정 계정)
   ════════════════════════════════ */
loginForm.addEventListener('submit', e => {
  e.preventDefault();
  const id   = usernameEl.value.trim();
  const pass = passwordEl.value.trim();
  if (id !== 'wsu2026' || pass !== 'ai2026') {
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
  micOff();
  releaseWakeLock();
  ttsCancel();
  showView('login');
});

/* ════════════════════════════════
   언어 + 수준 선택
   ════════════════════════════════ */
function updateStartBtn() { startBtn.disabled = !(state.language && state.level); }

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
  initSpeechRecognition();
  await requestWakeLock();

  try {
    const res = await fetch(`/api/greeting?language=${state.language}`);
    const { greeting } = await res.json();
    appendMessage('ai', greeting);
    state.history.push({ role: 'assistant', content: greeting });
    speakTTS(greeting);
  } catch {
    appendMessage('ai', '연결에 문제가 생겼어요. 잠시 후 다시 시도해주세요.');
  }
});

backBtn.addEventListener('click', () => {
  micOff();
  releaseWakeLock();
  ttsCancel();
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
    wakeLock.addEventListener('release', () => { wakelockBadge.classList.add('hidden'); wakeLock = null; });
  } catch (e) { console.warn('Wake Lock 실패:', e.message); }
}

function releaseWakeLock() {
  if (wakeLock) wakeLock.release();
  wakelockBadge.classList.add('hidden');
}

document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible' && views.chat.classList.contains('active')) {
    await requestWakeLock();
  }
});

/* ════════════════════════════════
   TTS — AI 응답 음성 출력
   ════════════════════════════════ */
let ttsEnabled = true;

ttsBtn.addEventListener('click', () => {
  ttsEnabled = !ttsEnabled;
  ttsBtn.textContent = ttsEnabled ? '🔊' : '🔇';
  ttsBtn.classList.toggle('muted', !ttsEnabled);
  if (!ttsEnabled) ttsCancel();
});

function ttsCancel() {
  if (window.speechSynthesis) speechSynthesis.cancel();
}

function speakTTS(fullText) {
  if (!ttsEnabled || !window.speechSynthesis) return;

  const marker = '📚 주요 단어';
  const idx = fullText.indexOf(marker);
  const text = (idx !== -1 ? fullText.slice(0, idx) : fullText).trim();
  if (!text) return;

  speechSynthesis.cancel();

  const utter = new SpeechSynthesisUtterance(text);
  utter.lang  = LANG_META[state.language]?.code || 'en-US';
  utter.rate  = 0.88;
  utter.pitch = 1;

  /* TTS 재생 중엔 마이크 중단, 끝나면 재개 */
  const wasOn = isListening;
  if (wasOn) { pausedForTTS = true; try { recognition.stop(); } catch (_) {} }

  utter.onend = utter.onerror = () => {
    pausedForTTS = false;
    if (wasOn) micOn();
  };

  speechSynthesis.speak(utter);
}

/* ════════════════════════════════
   마이크 — 연속 음성 인식
   ════════════════════════════════ */
let recognition   = null;
let isListening   = false;
let pausedForTTS  = false;
let accFinal      = '';   // 누적 최종 인식 텍스트
let autoSendTimer = null;

function initSpeechRecognition() {
  if (recognition) return;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { micBtn.classList.add('unsupported'); return; }

  recognition = new SR();
  recognition.continuous     = true;   // 계속 듣기
  recognition.interimResults = true;   // 실시간 텍스트 표시

  recognition.onresult = e => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) {
        accFinal += e.results[i][0].transcript;
      } else {
        interim += e.results[i][0].transcript;
      }
    }

    msgInput.value = (accFinal + interim).trim();
    autoResizeTextarea();

    /* 최종 텍스트 확보 시 1초 후 자동 전송 */
    if (accFinal.trim()) {
      clearTimeout(autoSendTimer);
      autoSendTimer = setTimeout(() => {
        const text = accFinal.trim();
        accFinal = '';
        msgInput.value = '';
        autoResizeTextarea();
        if (text) sendMessageWithText(text);
      }, 1000);
    }
  };

  /* 인식 종료 시 TTS 중이 아니면 자동 재시작 */
  recognition.onend = () => {
    if (isListening && !pausedForTTS) {
      setTimeout(() => {
        if (isListening && !pausedForTTS) {
          try { recognition.start(); } catch (_) {}
        }
      }, 300);
    }
  };

  recognition.onerror = err => {
    if (err.error === 'no-speech') return; // 묵음은 무시
    console.warn('음성 인식 오류:', err.error);
  };
}

function micOn() {
  if (!recognition) return;
  recognition.lang = LANG_META[state.language]?.code || 'en-US';
  try { recognition.start(); isListening = true; updateMicUI(); } catch (_) {}
}

function micOff() {
  if (!recognition) return;
  isListening = false;
  accFinal = '';
  clearTimeout(autoSendTimer);
  try { recognition.stop(); } catch (_) {}
  updateMicUI();
}

function updateMicUI() {
  micBtn.classList.toggle('recording', isListening);
  micOnIcon.style.display  = isListening ? 'none'  : 'block';
  micOffIcon.style.display = isListening ? 'block' : 'none';
  micBtn.title = isListening ? '마이크 켜짐 — 클릭하면 끄기' : '마이크 클릭하여 시작';
}

micBtn.addEventListener('click', () => {
  if (isListening) micOff();
  else             micOn();
});

/* ════════════════════════════════
   메시지 전송
   ════════════════════════════════ */
async function sendMessageWithText(text) {
  if (!text || sendBtn.disabled) return;

  sendBtn.disabled = true;
  appendMessage('user', text);
  state.history.push({ role: 'user', content: text });

  const typingEl = appendTyping();
  scrollToBottom();

  try {
    const response = await fetch('/api/chat', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ messages: state.history, language: state.language, level: state.level })
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
          if (delta) { fullText += delta; textEl.textContent = fullText; scrollToBottom(); }
        } catch (_) {}
      }
    }

    if (fullText) {
      state.history.push({ role: 'assistant', content: fullText });
      renderVocabSection(bubbleEl, fullText);
      scrollToBottom();
      speakTTS(fullText); // AI 답변 음성 출력 (TTS 끝나면 마이크 재개)
    }
  } catch {
    typingEl?.remove();
    appendMessage('ai', '연결 오류가 발생했습니다. 다시 시도해주세요.');
  } finally {
    sendBtn.disabled = false;
    /* TTS 사용 안 할 경우 즉시 마이크 재개 */
    if (!ttsEnabled && isListening && pausedForTTS === false) {
      // 이미 켜져 있음
    }
  }
}

/* 텍스트 입력창으로 수동 전송 */
async function sendManual() {
  const text = msgInput.value.trim();
  if (!text) return;
  accFinal = '';
  msgInput.value = '';
  autoResizeTextarea();
  await sendMessageWithText(text);
}

sendBtn.addEventListener('click', sendManual);

msgInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendManual(); }
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
    const av = document.createElement('div');
    av.className = 'msg-avatar';
    av.textContent = LANG_META[state.language]?.flag || '🤖';
    row.appendChild(av);
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
  const av = document.createElement('div');
  av.className = 'msg-avatar';
  av.textContent = LANG_META[state.language]?.flag || '🤖';
  row.appendChild(av);
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
  const av = document.createElement('div');
  av.className = 'msg-avatar';
  av.textContent = LANG_META[state.language]?.flag || '🤖';
  row.appendChild(av);
  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  const textEl = document.createElement('span');
  bubble.appendChild(textEl);
  row.appendChild(bubble);
  messagesEl.appendChild(row);
  return { bubbleEl: bubble, textEl };
}

function renderVocabSection(bubble, fullText) {
  const marker = '📚 주요 단어';
  const idx    = fullText.indexOf(marker);
  if (idx === -1) return;
  const mainText  = fullText.slice(0, idx).trimEnd();
  const vocabText = fullText.slice(idx);
  bubble.innerHTML = '';
  const mainEl = document.createElement('p');
  mainEl.style.cssText = 'white-space:pre-wrap;margin-bottom:12px';
  mainEl.textContent = mainText;
  bubble.appendChild(mainEl);
  const vocabEl = document.createElement('div');
  vocabEl.className = 'vocab-box';
  vocabEl.textContent = vocabText;
  bubble.appendChild(vocabEl);
}

function scrollToBottom() { messagesEl.scrollTop = messagesEl.scrollHeight; }
