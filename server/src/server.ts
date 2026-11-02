
import Fastify from 'fastify';
import cors from '@fastify/cors';

const fastify = Fastify({
  logger: true
});

// Allow the browser extension to communicate with the local backend.
await fastify.register(cors, {
  origin: true
});

// Definition structure returned by the AI.
interface WordDefinition {
  word: string;
  partOfSpeech: string;
  pronunciation: string;
  meaning: string;
  explanation: string;
  example: string;
  synonyms: string[];
  antonyms: string[];
}

// Check whether the backend is running.
fastify.get('/health', async () => {
  return {
    status: 'ok',
    message: 'Lexicon backend is running!'
  };
});

// Generate a word definition using local Ollama.
fastify.post<{
  Body: {
    word?: string;
    context?: string;
  };
}>('/define', async (request, reply) => {
  try {
    const word = request.body.word?.trim();
    const context = request.body.context?.trim() ?? '';

    // Validate the submitted word.
    if (!word) {
      return reply.code(400).send({
        success: false,
        error: 'Please provide a word.'
      });
    }

    if (word.length > 100) {
      return reply.code(400).send({
        success: false,
        error: 'Word must be 100 characters or fewer.'
      });
    }

    // Instructions sent to the AI model.
    const prompt = `
You are an expert English vocabulary teacher.

Explain the following English word in a beginner-friendly way.

Word: ${word}
Context: ${context || 'No additional context provided.'}

Return ONLY valid JSON with exactly these fields:
{
  "word": "the word",
  "partOfSpeech": "noun, verb, adjective, etc.",
  "pronunciation": "IPA pronunciation",
  "meaning": "short, clear definition",
  "explanation": "easy-to-understand explanation",
  "example": "one natural example sentence",
  "synonyms": ["synonym1", "synonym2"],
  "antonyms": ["antonym1", "antonym2"]
}

Keep the explanation simple and accurate.
Do not include Markdown or text outside the JSON.
`;

    // Send the request to Ollama running on this Mac.
    const ollamaResponse = await fetch(
      'http://127.0.0.1:11434/api/chat',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'qwen3:1.7b',
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          format: 'json',
          stream: false,
          think: false,
          options: {
            temperature: 0.2,
            num_ctx: 2048,
            num_predict: 300
          }
        })
      }
    );

    if (!ollamaResponse.ok) {
      throw new Error(
        `Ollama returned an error: ${ollamaResponse.status}`
      );
    }

    const ollamaData = await ollamaResponse.json() as {
      message?: {
        content?: string;
      };
    };

    const content = ollamaData.message?.content;

    if (!content) {
      throw new Error('Ollama returned an empty response.');
    }

    // Convert the AI's JSON response into a JavaScript object.
    const definition = JSON.parse(content) as WordDefinition;

    return {
      success: true,
      definition
    };

  } catch (error) {
    fastify.log.error(error);

    return reply.code(502).send({
      success: false,
      error: 'Could not generate the definition. Check that Ollama is running and try again.'
    });
  }
});

// Start the backend on localhost only.
try {
  await fastify.listen({
    port: 8787,
    host: '127.0.0.1'
  });
} catch (error) {
  fastify.log.error(error);
  process.exit(1);
}
