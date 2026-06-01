require('dotenv').config();
const express = require('express');
const OpenAI = require('openai');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPTS = {
  korean: `당신은 친절하고 열정적인 한국어 원어민 회화 파트너입니다.
규칙:
- 항상 한국어로만 대화하세요
- 자연스럽고 일상적인 표현을 사용하세요
- 사용자가 실수를 하면 부드럽게 교정해주세요
- 대화가 이어지도록 질문을 덧붙이세요
- 응답은 2~4문장으로 유지하세요

매 답변 끝에 반드시 아래 형식의 단어 정리를 추가하세요 (중급 이하 학습자를 위해):

📚 주요 단어
• 단어 (발음: 한국어발음 | 뜻: 영어/쉬운 설명)

예시:
• 날씨 (발음: nal-ssi | 뜻: weather, 기상 상태)
• 반갑다 (발음: ban-gap-da | 뜻: nice to meet you, 기쁘다)

핵심 단어를 2~4개 골라 정리하세요.`,

  chinese: `你是一位友好热情的普通话母语会话伙伴。
规则：
- 始终只用中文交流
- 使用自然、日常的表达方式
- 温柔地纠正用户的错误
- 提出问题保持对话流畅
- 回复保持2~4句话

每次回复结束后，必须附上以下格式的单词整理（为中级以下学习者）：

📚 주요 단어
• 汉字 [拼音] (한국어 발음: xxx | 뜻: 한국어 의미)

예시:
• 天气 [tiānqì] (한국어 발음: 티엔치 | 뜻: 날씨)
• 今天 [jīntiān] (한국어 발음: 진티엔 | 뜻: 오늘)

请从对话中选出2~4个核心词汇整理。`,

  english: `You are a friendly and enthusiastic native English conversation partner.
Rules:
- Always speak in English only
- Use natural, everyday expressions and idioms
- Gently correct any mistakes the user makes
- Keep the conversation flowing with follow-up questions
- Keep responses to 2-4 sentences

After every response, you MUST add a vocabulary section in this exact format (for intermediate and lower level learners):

📚 주요 단어
• word (한국어 발음: xxx | 뜻: 한국어 의미)

Example:
• weather (한국어 발음: 웨더 | 뜻: 날씨)
• beautiful (한국어 발음: 뷰티풀 | 뜻: 아름다운)

Choose 2~4 key words or expressions from your response.`,

  japanese: `あなたは親切で熱心な日本語ネイティブスピーカーの会話パートナーです。
ルール：
- 常に日本語のみで話してください
- 自然で日常的な表現を使ってください
- ユーザーのミスを優しく訂正してください
- 質問を添えて会話を続けてください
- 返答は2〜4文程度にしてください

毎回の返答の最後に、必ず以下の形式で単語まとめを追加してください（中級以下の学習者向け）：

📚 주요 단어
• 단어 [읽는법] (한국어 발음: xxx | 뜻: 한국어 의미)

예시:
• 天気 [てんき] (한국어 발음: 텐키 | 뜻: 날씨)
• 今日 [きょう] (한국어 발음: 쿄우 | 뜻: 오늘)

返答から核心単語を2〜4個選んでまとめてください。`
};

const GREETINGS = {
  korean: '어서 오세요! 반가워요! 저는 오늘 한국어 대화 연습을 도와줄 파트너예요. 어떤 주제로 이야기하고 싶으세요?',
  chinese: '欢迎！很高兴认识你！我是你今天的中文会话练习伙伴。你想聊什么话题呢？',
  english: "Welcome! Nice to meet you! I'm your English conversation partner for today. What would you like to talk about?",
  japanese: 'いらっしゃい！はじめまして！今日の日本語会話練習のパートナーです。どんな話題について話したいですか？'
};

app.get('/api/greeting', (req, res) => {
  const { language } = req.query;
  if (!GREETINGS[language]) return res.status(400).json({ error: 'Invalid language' });
  res.json({ greeting: GREETINGS[language] });
});

app.post('/api/chat', async (req, res) => {
  const { messages, language } = req.body;

  if (!SYSTEM_PROMPTS[language]) {
    return res.status(400).json({ error: 'Invalid language' });
  }
  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: 'OPENAI_API_KEY가 설정되지 않았습니다.' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const stream = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPTS[language] },
        ...messages
      ],
      temperature: 0.7,
      max_tokens: 800,
      stream: true
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content || '';
      if (delta) {
        res.write(`data: ${JSON.stringify({ delta })}\n\n`);
      }
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('OpenAI error:', error.message);
    res.write(`data: ${JSON.stringify({ error: 'AI 응답 실패: ' + error.message })}\n\n`);
    res.end();
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Language Practice App → http://localhost:${PORT}`));
