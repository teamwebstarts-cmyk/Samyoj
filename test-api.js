import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: 'OydSnrVw.VStevZNG6k0B7UVsAJrVfuJyRKFb0wlx',
  baseURL: 'https://inference.baseten.co/v1',
});

const response = await client.chat.completions.create({
  "model": "moonshotai/Kimi-K3",
  "messages": [
    {
      "role": "user",
      "content": "Implement Hello World in Python"
    }
  ],
  "stream": false,
  "top_p": 0.95,
  "max_tokens": 4096,
  "temperature": 1,
  "presence_penalty": 0,
  "frequency_penalty": 0
});

console.log(response.choices[0].message.content);
