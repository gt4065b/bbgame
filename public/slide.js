/* ══════════════════════════════════
   State
══════════════════════════════════ */
const state = {
  slides: [],        // { type:'image'|'demo', src?:string, label:string }
  current: 0,
  isBlackout: false,
  isHighlight: false,
  isPointer: false,
  zoomLevel: 1,
  listening: false,
  cmdCooldown: false,
};

const ZOOM_STEPS = [1, 1.4, 1.8, 2.4];

/* ══════════════════════════════════
   Demo slides
══════════════════════════════════ */
const DEMO_SLIDES = [
  {
    bg: 'slide-bg-1',
    html: `<div class="demo-slide slide-bg-1">
      <h2 style="color:#a78bfa">음성 슬라이드 제어 시스템</h2>
      <p>Web Speech API 기반의 핸즈프리 발표 도구<br>교수자를 위한 강의실 최적화 솔루션</p>
      <p style="font-size:.8rem;opacity:.5;margin-top:8px">🎤 "슬라이드 다음" 이라고 말해보세요</p>
      <span class="slide-num">1</span>
    </div>`,
    label: '표지'
  },
  {
    bg: 'slide-bg-2',
    html: `<div class="demo-slide slide-bg-2">
      <h2>핵심 기능 소개</h2>
      <ul>
        <li>음성으로 슬라이드 이동 — 양손이 자유롭습니다</li>
        <li>레이저 포인터 — 중요 부분 강조</li>
        <li>화면 끄기 / 켜기 — 주목 집중 유도</li>
        <li>확대 / 축소 — 세밀한 내용 확인</li>
      </ul>
      <span class="slide-num">2</span>
    </div>`,
    label: '기능 소개'
  },
  {
    bg: 'slide-bg-3',
    html: `<div class="demo-slide slide-bg-3">
      <h2>음성 명령어 목록</h2>
      <ul>
        <li>"슬라이드 다음 / 이전 / 처음 / 마지막"</li>
        <li>"슬라이드 5번" — 특정 슬라이드로 이동</li>
        <li>"화면 끄기 / 켜기"</li>
        <li>"강조 / 확대 / 축소"</li>
        <li>"포인터 켜기 / 끄기"</li>
        <li>"종료"</li>
      </ul>
      <span class="slide-num">3</span>
    </div>`,
    label: '명령어'
  },
  {
    bg: 'slide-bg-4',
    html: `<div class="demo-slide slide-bg-4">
      <h2>인식률 향상 팁</h2>
      <ul>
        <li>명확하고 자연스러운 속도로 말하세요</li>
        <li>"슬라이드" 접두어로 오작동을 방지합니다</li>
        <li>강의 중 일반 발화와 명령어가 구분됩니다</li>
        <li>조용한 환경에서 가장 잘 작동합니다</li>
      </ul>
      <span class="slide-num">4</span>
    </div>`,
    label: '팁'
  },
  {
    bg: 'slide-bg-5',
    html: `<div class="demo-slide slide-bg-5">
      <h2>🎓 발표를 시작하세요</h2>
      <p>이 화면은 데모 슬라이드입니다.<br>실제 슬라이드 이미지를 업로드하여 사용할 수 있습니다.</p>
      <p style="margin-top:16px;font-size:.85rem;color:#6c63ff">강의실에서 바로 사용 가능</p>
      <span class="slide-num">5</span>
    </div>`,
    label: '마무리'
  }
];

/* ══════════════════════════════════
   Command definitions
══════════════════════════════════ */
const COMMANDS = [
  { pattern: /슬라이드\s*다음|슬라이드\s*앞으로|다음\s*슬라이드/,   action: 'next' },
  { pattern: /슬라이드\s*이전|슬라이드\s*뒤로|이전\s*슬라이드/,    action: 'prev' },
  { pattern: /슬라이드\s*처음|처음\s*슬라이드|표지로/,             action: 'first' },
  { pattern: /슬라이드\s*마지막|마지막\s*슬라이드/,                action: 'last' },
  { pattern: /슬라이드\s*(\d+)\s*번|(\d+)\s*번\s*슬라이드/,       action: 'goto', capture: true },
  { pattern: /화면\s*끄기|화면을?\s*끄/,                          action: 'blackout_on' },
  { pattern: /화면\s*켜기|화면을?\s*켜/,                          action: 'blackout_off' },
  { pattern: /^강조$|강조해/,                                     action: 'highlight' },
  { pattern: /확대/,                                              action: 'zoom_in' },
  { pattern: /축소|원래\s*크기/,                                  action: 'zoom_out' },
  { pattern: /포인터\s*켜기|포인터\s*켜/,                         action: 'pointer_on' },
  { pattern: /포인터\s*끄기|포인터\s*끄/,                         action: 'pointer_off' },
  { pattern: /슬라이드\s*종료|발표\s*종료|^종료$/,                 action: 'exit' },
  { pattern: /슬라이드\s*시작|발표\s*시작/,                        action: 'announce_start' },
];

function parseCommand(text) {
  const t = text.trim();
  for (const cmd of COMMANDS) {
    const m = t.match(cmd.pattern);
    if (m) {
      const num = cmd.capture ? parseInt(m[1] || m[2]) : null;
      return { action: cmd.action, num };
    }
  }
  return null;
}

/* ══════════════════════════════════
   DOM refs — setup
══════════════════════════════════ */
const setupView      = document.getElementById('setup-view');
const presentView    = document.getElementById('present-view');
const fileInput      = document.getElementById('file-input');
const uploadZone     = document.getElementById('upload-zone');
const uploadInner    = document.getElementById('upload-inner');
const uploadPreview  = document.getElementById('upload-preview');
const previewCount   = document.getElementById('preview-count');
const previewThumbs  = document.getElementById('preview-thumbs');
const resetUpload    = document.getElementById('reset-upload');
const demoBtn        = document.getElementById('demo-btn');
const startPresentBtn= document.getElementById('start-present-btn');
const uploadBtn      = document.getElementById('upload-btn');

/* ── setup: upload ── */
uploadBtn.addEventListener('click', () => fileInput.click());
uploadZone.addEventListener('click', e => {
  if (e.target === uploadZone || e.target === uploadInner) fileInput.click();
});

uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('dragover'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
uploadZone.addEventListener('drop', e => {
  e.preventDefault();
  uploadZone.classList.remove('dragover');
  handleFiles(Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/')));
});

fileInput.addEventListener('change', () => {
  handleFiles(Array.from(fileInput.files));
  fileInput.value = '';
});

resetUpload.addEventListener('click', e => {
  e.stopPropagation();
  state.slides = [];
  uploadPreview.style.display = 'none';
  uploadInner.style.display = '';
  startPresentBtn.disabled = true;
});

function handleFiles(files) {
  if (!files.length) return;
  const sorted = files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  state.slides = sorted.map(f => ({ type: 'image', src: URL.createObjectURL(f), label: f.name }));
  previewCount.textContent = `${files.length}장 선택됨`;
  previewThumbs.innerHTML = '';
  sorted.slice(0, 8).forEach(f => {
    const img = document.createElement('img');
    img.src = URL.createObjectURL(f);
    img.alt = f.name;
    previewThumbs.appendChild(img);
  });
  uploadInner.style.display = 'none';
  uploadPreview.style.display = '';
  startPresentBtn.disabled = false;
}

demoBtn.addEventListener('click', () => {
  state.slides = DEMO_SLIDES.map(d => ({ type: 'demo', html: d.html, label: d.label }));
  startPresentBtn.disabled = false;
  demoBtn.textContent = '✓ 데모 슬라이드 선택됨';
  demoBtn.style.borderColor = 'var(--green)';
  demoBtn.style.color = 'var(--green)';
});

startPresentBtn.addEventListener('click', startPresentation);

/* ══════════════════════════════════
   DOM refs — present
══════════════════════════════════ */
const slideCounter   = document.getElementById('slide-counter');
const slideContainer = document.getElementById('slide-container');
const slideZoomWrap  = document.getElementById('slide-zoom-wrap');
const blackout       = document.getElementById('blackout');
const highlightOv    = document.getElementById('highlight-overlay');
const laser          = document.getElementById('laser');
const thumbList      = document.getElementById('thumb-list');
const transcriptText = document.getElementById('transcript-text');
const voiceStatus    = document.getElementById('voice-status');
const voiceLabel     = document.getElementById('voice-label');
const cmdToast       = document.getElementById('cmd-toast');
const exitBtn        = document.getElementById('exit-btn');
const pointerToggle  = document.getElementById('pointer-toggle');

/* ══════════════════════════════════
   Presentation start / stop
══════════════════════════════════ */
function startPresentation() {
  state.current = 0;
  state.isBlackout = false;
  state.isHighlight = false;
  state.isPointer = false;
  state.zoomLevel = 1;

  setupView.classList.remove('active');
  presentView.classList.add('active');

  buildThumbs();
  renderSlide(0);
  initVoice();
}

exitBtn.addEventListener('click', endPresentation);

function endPresentation() {
  stopVoice();
  presentView.classList.remove('active');
  setupView.classList.add('active');
  state.isBlackout = false;
  state.isHighlight = false;
  state.isPointer = false;
  state.zoomLevel = 1;
  slideZoomWrap.style.transform = '';
  blackout.classList.add('hidden');
  highlightOv.classList.add('hidden');
  laser.classList.add('hidden');
  pointerToggle.classList.remove('active');
}

/* ══════════════════════════════════
   Slide rendering
══════════════════════════════════ */
function renderSlide(idx, dir = 0) {
  if (idx < 0 || idx >= state.slides.length) return;
  state.current = idx;

  slideContainer.classList.add('fade-out');
  setTimeout(() => {
    const s = state.slides[idx];
    if (s.type === 'image') {
      slideContainer.innerHTML = `<img src="${s.src}" alt="슬라이드 ${idx + 1}" draggable="false">`;
    } else {
      slideContainer.innerHTML = s.html;
    }
    slideContainer.classList.remove('fade-out');
    updateHUD();
    syncThumbs();
  }, 130);
}

function updateHUD() {
  slideCounter.textContent = `${state.current + 1} / ${state.slides.length}`;
}

/* ══════════════════════════════════
   Thumbnails
══════════════════════════════════ */
function buildThumbs() {
  thumbList.innerHTML = '';
  state.slides.forEach((s, i) => {
    const item = document.createElement('div');
    item.className = 'thumb-item';
    item.dataset.idx = i;

    if (s.type === 'image') {
      const img = document.createElement('img');
      img.src = s.src;
      img.alt = `썸네일 ${i + 1}`;
      item.appendChild(img);
    } else {
      const d = document.createElement('div');
      d.className = 'thumb-demo';
      d.textContent = s.label || `슬라이드 ${i + 1}`;
      item.appendChild(d);
    }

    const num = document.createElement('span');
    num.className = 'thumb-num';
    num.textContent = i + 1;
    item.appendChild(num);

    item.addEventListener('click', () => renderSlide(i));
    thumbList.appendChild(item);
  });
}

function syncThumbs() {
  const items = thumbList.querySelectorAll('.thumb-item');
  items.forEach((item, i) => item.classList.toggle('active', i === state.current));
  const active = items[state.current];
  if (active) active.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
}

/* ══════════════════════════════════
   Command execution
══════════════════════════════════ */
const ACTION_LABELS = {
  next:           '다음 슬라이드',
  prev:           '이전 슬라이드',
  first:          '첫 번째 슬라이드',
  last:           '마지막 슬라이드',
  goto:           '슬라이드 이동',
  blackout_on:    '화면 끄기',
  blackout_off:   '화면 켜기',
  highlight:      '강조',
  zoom_in:        '확대',
  zoom_out:       '축소',
  pointer_on:     '포인터 켜기',
  pointer_off:    '포인터 끄기',
  exit:           '발표 종료',
  announce_start: '발표 시작',
};

function executeCommand(action, num) {
  switch (action) {
    case 'next':
      if (state.current < state.slides.length - 1) renderSlide(state.current + 1, 1);
      break;
    case 'prev':
      if (state.current > 0) renderSlide(state.current - 1, -1);
      break;
    case 'first':
      renderSlide(0);
      break;
    case 'last':
      renderSlide(state.slides.length - 1);
      break;
    case 'goto':
      if (num >= 1 && num <= state.slides.length) renderSlide(num - 1);
      break;
    case 'blackout_on':
      state.isBlackout = true;
      blackout.classList.remove('hidden');
      break;
    case 'blackout_off':
      state.isBlackout = false;
      blackout.classList.add('hidden');
      break;
    case 'highlight':
      state.isHighlight = !state.isHighlight;
      highlightOv.classList.toggle('hidden', !state.isHighlight);
      break;
    case 'zoom_in': {
      const next = ZOOM_STEPS.find(z => z > state.zoomLevel) || ZOOM_STEPS[ZOOM_STEPS.length - 1];
      state.zoomLevel = next;
      slideZoomWrap.style.transform = `scale(${next})`;
      break;
    }
    case 'zoom_out': {
      const prev = [...ZOOM_STEPS].reverse().find(z => z < state.zoomLevel) || 1;
      state.zoomLevel = prev;
      slideZoomWrap.style.transform = prev === 1 ? '' : `scale(${prev})`;
      break;
    }
    case 'pointer_on':
      state.isPointer = true;
      laser.classList.remove('hidden');
      pointerToggle.classList.add('active');
      break;
    case 'pointer_off':
      state.isPointer = false;
      laser.classList.add('hidden');
      pointerToggle.classList.remove('active');
      break;
    case 'exit':
      endPresentation();
      return;
    case 'announce_start':
      showToast('발표 시작!');
      return;
  }
  showToast(ACTION_LABELS[action] || action);
}

/* ══════════════════════════════════
   Toast
══════════════════════════════════ */
let toastTimer = null;
function showToast(msg) {
  cmdToast.textContent = msg;
  cmdToast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => cmdToast.classList.add('hidden'), 1800);
}

/* ══════════════════════════════════
   Pointer toggle button
══════════════════════════════════ */
pointerToggle.addEventListener('click', () => {
  if (state.isPointer) executeCommand('pointer_off');
  else executeCommand('pointer_on');
});

/* ══════════════════════════════════
   Laser pointer — mouse / touch
══════════════════════════════════ */
document.getElementById('slide-stage').addEventListener('mousemove', e => {
  if (!state.isPointer) return;
  const rect = e.currentTarget.getBoundingClientRect();
  laser.style.left = (e.clientX - rect.left) + 'px';
  laser.style.top  = (e.clientY - rect.top) + 'px';
});

document.getElementById('slide-stage').addEventListener('touchmove', e => {
  if (!state.isPointer) return;
  e.preventDefault();
  const touch = e.touches[0];
  const rect = e.currentTarget.getBoundingClientRect();
  laser.style.left = (touch.clientX - rect.left) + 'px';
  laser.style.top  = (touch.clientY - rect.top) + 'px';
}, { passive: false });

/* ══════════════════════════════════
   Keyboard shortcuts
══════════════════════════════════ */
document.addEventListener('keydown', e => {
  if (!presentView.classList.contains('active')) return;
  switch (e.key) {
    case 'ArrowRight': case ' ': e.preventDefault(); executeCommand('next'); break;
    case 'ArrowLeft':            e.preventDefault(); executeCommand('prev'); break;
    case 'Home':                 executeCommand('first'); break;
    case 'End':                  executeCommand('last'); break;
    case 'b': case 'B':          executeCommand(state.isBlackout ? 'blackout_off' : 'blackout_on'); break;
    case 'h': case 'H':          executeCommand('highlight'); break;
    case '+': case '=':          executeCommand('zoom_in'); break;
    case '-':                    executeCommand('zoom_out'); break;
    case 'Escape':               endPresentation(); break;
  }
});

/* ══════════════════════════════════
   Voice recognition
══════════════════════════════════ */
let recognition = null;
let voiceRestartTimer = null;

function initVoice() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    voiceLabel.textContent = '음성 인식 미지원 브라우저';
    voiceStatus.classList.add('error');
    return;
  }

  if (recognition) { try { recognition.stop(); } catch (_) {} }

  recognition = new SR();
  recognition.lang = 'ko-KR';
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    state.listening = true;
    voiceStatus.className = 'voice-status listening';
    voiceLabel.textContent = '음성 인식 중';
  };

  recognition.onresult = e => {
    let interim = '';
    let finalText = '';

    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) finalText += t;
      else interim += t;
    }

    const display = finalText || interim;
    transcriptText.textContent = display;
    transcriptText.classList.remove('matched');

    if (finalText && !state.cmdCooldown) {
      const parsed = parseCommand(finalText);
      if (parsed) {
        transcriptText.classList.add('matched');
        voiceStatus.className = 'voice-status command';
        voiceLabel.textContent = ACTION_LABELS[parsed.action] || '명령 실행';
        executeCommand(parsed.action, parsed.num);

        state.cmdCooldown = true;
        setTimeout(() => {
          state.cmdCooldown = false;
          voiceStatus.className = 'voice-status listening';
          voiceLabel.textContent = '음성 인식 중';
        }, 800);
      }
    }
  };

  recognition.onerror = err => {
    if (err.error === 'no-speech' || err.error === 'aborted') return;
    voiceStatus.className = 'voice-status error';
    voiceLabel.textContent = '인식 오류';
    console.warn('SR error:', err.error);
  };

  recognition.onend = () => {
    state.listening = false;
    if (presentView.classList.contains('active')) {
      voiceStatus.className = 'voice-status idle';
      voiceLabel.textContent = '재연결 중…';
      clearTimeout(voiceRestartTimer);
      voiceRestartTimer = setTimeout(() => {
        if (presentView.classList.contains('active')) startVoice();
      }, 500);
    }
  };

  startVoice();
}

function startVoice() {
  if (!recognition) return;
  try {
    recognition.start();
  } catch (e) {
    console.warn('recognition.start error:', e);
  }
}

function stopVoice() {
  clearTimeout(voiceRestartTimer);
  if (!recognition) return;
  try { recognition.stop(); } catch (_) {}
  recognition = null;
  state.listening = false;
}
