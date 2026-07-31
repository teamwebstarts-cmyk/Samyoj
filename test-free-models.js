import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: 'OydSnrVw.VStevZNG6k0B7UVsAJrVfuJyRKFb0wlx',
  baseURL: 'https://inference.baseten.co/v1',
});

// Try different free models
const freeModels = [
  "inception/mercury-2",
  "sid/sid-1",
  "thinkingmachines/inkling-small"
];

for (const model of freeModels) {
  console.log(`\n=== Testing Model: ${model} ===`);
  try {
    const response = await client.chat.completions.create({
      model: model,
      messages: [{ role: "user", content: "Say hello in one word" }],
      stream: false,
      max_tokens: 50,
    });
    console.log(`✅ SUCCESS!`);
    console.log(`Response: ${response.choices[0].message.content}`);
    console.log(`Usage: ${JSON.stringify(response.usage)}`);
  } catch (error) {
    console.log(`❌ FAILED: ${error.message}`);
  }
}
