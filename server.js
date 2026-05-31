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
- 응답은 2~4문장으로 유지하세요`,

  chinese: `你是一位友好热情的普通话母语会话伙伴。
规则：
- 始终只用中文交流
- 使用自然、日常的表达方式
- 温柔地纠正用户的错误
- 提出问题保持对话流畅
- 回复保持2~4句话`,

  english: `You are a friendly and enthusiastic native English conversation partner.
Rules:
- Always speak in English only
- Use natural, everyday expressions and idioms
- Gently correct any mistakes the user makes
- Keep the conversation flowing with follow-up questions
- Keep responses to 2-4 sentences`,

  japanese: `あなたは親切で熱心な日本語ネイティブスピーカーの会話パートナーです。
ルール：
- 常に日本語のみで話してください
- 自然で日常的な表現を使ってください
- ユーザーのミスを優しく訂正してください
- 質問を添えて会話を続けてください
- 返答は2〜4文程度にしてください`
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
      max_tokens: 500,
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
