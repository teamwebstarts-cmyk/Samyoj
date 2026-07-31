import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: 'OydSnrVw.VStevZNG6k0B7UVsAJrVfuJyRKFb0wlx',
  baseURL: 'https://inference.baseten.co/v1',
});

// List available models
try {
  const models = await client.models.list();
  console.log('Available Models:');
  console.log(JSON.stringify(models, null, 2));
} catch (error) {
  console.error('Error fetching models:', error.message);
}
