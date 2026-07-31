import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: 'OydSnrVw.VStevZNG6k0B7UVsAJrVfuJyRKFb0wlx',
  baseURL: 'https://inference.baseten.co/v1',
});

// Test multiple tasks with Mercury 2
const tests = [
  {
    name: "Simple Question",
    message: "What is 2 + 2?"
  },
  {
    name: "Coding Task",
    message: "Write a Python function to calculate fibonacci numbers"
  },
  {
    name: "Long Response",
    message: "Explain quantum computing in detail (write at least 300 words)"
  },
  {
    name: "Reasoning",
    message: "If a train travels 120 km in 2 hours, what is its average speed? Show your reasoning step by step."
  }
];

for (const test of tests) {
  console.log(`\n=== Test: ${test.name} ===`);
  try {
    const response = await client.chat.completions.create({
      model: "inception/mercury-2",
      messages: [{ role: "user", content: test.message }],
      stream: false,
      max_tokens: 500,
    });
    console.log(response.choices[0].message.content);
    console.log(`\n[Tokens used: ${response.usage.total_tokens}]`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
  }
}
