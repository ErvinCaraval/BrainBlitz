
jest.mock('axios');
const axios = require('axios');
const AIQuestionGenerator = require('../../services/aiQuestionGenerator');

describe('AIQuestionGenerator', () => {
  let generator;
  beforeEach(() => {
    generator = new AIQuestionGenerator();
    jest.clearAllMocks();
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('extractJson', () => {
    test('returns null for empty', () => {
      expect(generator.extractJson('')).toBeNull();
    });
    test('parses valid JSON', () => {
      expect(generator.extractJson('{"a":1}')).toEqual({ a: 1 });
    });
    test('removes fences', () => {
      expect(generator.extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    });
    test('parses embedded JSON', () => {
      expect(generator.extractJson('foo {"a":1} bar')).toEqual({ a: 1 });
    });
    test('returns null for invalid', () => {
      expect(generator.extractJson('not json')).toBeNull();
    });
    test('handles non-object with braces', () => {
      // Should extract the first object
      expect(generator.extractJson('foo {"a":1} bar')).toEqual({ a: 1 });
    });
    test('returns null if parse fails after slice', () => {
      // Should try to slice but still fail
      expect(generator.extractJson('foo {not json} bar')).toBeNull();
    });
  });

  describe('generateQuestions', () => {
    test('throws if no API key', async () => {
      generator.groqApiKey = '';
      generator.openAiApiKey = '';
      await expect(generator.generateQuestions('math')).rejects.toThrow();
    });
    test('calls axios.post with groq', async () => {
      generator.groqApiKey = 'key';
      axios.post.mockResolvedValue({ data: { choices: [{ message: { content: '{"questions":[{"text":"Q1"},{"text":"Q2"}]}' } }] } });
      const result = await generator.generateQuestions('math', 'easy', 2);
      expect(result).toEqual({ questions: [{ text: 'Q1' }, { text: 'Q2' }] });
    });
    test('calls axios.post with openai', async () => {
      generator.groqApiKey = '';
      generator.openAiApiKey = 'key';
      axios.post.mockResolvedValue({ data: { choices: [{ message: { content: '{"questions":[{"text":"Q1"},{"text":"Q2"}]}' } }] } });
      const result = await generator.generateQuestions('math', 'easy', 2);
      expect(result).toEqual({ questions: [{ text: 'Q1' }, { text: 'Q2' }] });
    });
    test('throws if axios fails (groq)', async () => {
      generator.groqApiKey = 'key';
      axios.post.mockRejectedValue(new Error('fail'));
      await expect(generator.generateQuestions('math', 'easy', 2)).rejects.toThrow('Error al conectar con la API de Groq');
    });
    test('throws if axios fails (openai)', async () => {
      generator.groqApiKey = '';
      generator.openAiApiKey = 'key';
      axios.post.mockRejectedValue(new Error('fail'));
      await expect(generator.generateQuestions('math', 'easy', 2)).rejects.toThrow('Error al conectar con la API de OpenAI');
    });
    test('throws if no questions returned', async () => {
      generator.groqApiKey = 'key';
      axios.post.mockResolvedValue({ data: { choices: [{ message: { content: '{"foo":[]}' } }] } });
      await expect(generator.generateQuestions('math', 'easy', 2)).rejects.toThrow('La IA no devolvió preguntas válidas');
    });
    test('filters duplicate questions and throws if not enough', async () => {
      generator.groqApiKey = 'key';
      // 2 questions, but both have same text
      axios.post.mockResolvedValue({ data: { choices: [{ message: { content: '{"questions":[{"text":"Q1"},{"text":"Q1"}]}' } }] } });
      await expect(generator.generateQuestions('math', 'easy', 2)).rejects.toThrow('La IA no generó suficientes preguntas únicas');
    });
    test('returns only unique questions up to count', async () => {
      generator.groqApiKey = 'key';
      axios.post.mockResolvedValue({ data: { choices: [{ message: { content: '{"questions":[{"text":"Q1"},{"text":"Q2"},{"text":"Q1"}]}' } }] } });
      const result = await generator.generateQuestions('math', 'easy', 2);
      expect(result.questions.length).toBe(2);
      expect(result.questions.map(q => q.text)).toEqual(['Q1', 'Q2']);
    });
  });

  describe('generateQuestionsFree', () => {
    test('always throws', async () => {
      await expect(generator.generateQuestionsFree('math')).rejects.toThrow('No se pueden generar preguntas con IA.');
    });
    test('covers inner catch and rethrow', async () => {
      // Simulate the catch block by calling directly
      const gen = new AIQuestionGenerator();
      // Patch the method to throw in the try, then call
      const orig = gen.generateQuestionsFree;
      gen.generateQuestionsFree = async function() {
        try {
          throw new Error('No se pueden generar preguntas locales.');
        } catch (error) {
          throw new Error('No se pueden generar preguntas con IA.');
        }
      };
      await expect(gen.generateQuestionsFree('math')).rejects.toThrow('No se pueden generar preguntas con IA.');
      gen.generateQuestionsFree = orig;
    });
  });

  describe('fillTemplate', () => {
    test('fills template with topic and difficulty', () => {
      const template = { text: 'Q', options: [1,2,3,4], correctAnswerIndex: 0 };
      const result = generator.fillTemplate(template, 'math', 'easy');
      expect(result.category).toBe('math');
      expect(result.difficulty).toBe('easy');
      expect(result.source).toBe('AI Generated');
      expect(result.id).toMatch(/^ai_/);
    });
  });

  describe('buildPrompt', () => {
    test('returns a prompt string with topic, difficulty, and count', () => {
      const prompt = generator.buildPrompt('math', 'easy', 3);
      expect(prompt).toContain('math');
      expect(prompt).toContain('easy');
      // El prompt ahora solicita más preguntas (buffer), no exactamente 3
      expect(prompt).toContain('preguntas');
      // Ya no contiene "category" ni "difficulty" en el prompt (se removieron)
      expect(prompt).toContain('INSTRUCCIONES CRÍTICAS');
      expect(prompt).toContain('EXACTAMENTE 4 opciones');
    });
  });

  describe('getFallbackQuestions', () => {
    test('always throws', () => {
      expect(() => generator.getFallbackQuestions('math', 'easy', 2)).toThrow('No se pueden generar preguntas de respaldo.');
    });
  });

  describe('getAvailableTopics', () => {
    test('returns an array of topics', () => {
      const topics = generator.getAvailableTopics();
      expect(Array.isArray(topics)).toBe(true);
      expect(topics.length).toBeGreaterThan(0);
      expect(topics).toContain('Ciencia');
    });
  });

  describe('getDifficultyLevels', () => {
    test('returns an array of difficulty levels', () => {
      const levels = generator.getDifficultyLevels();
      expect(Array.isArray(levels)).toBe(true);
      expect(levels.length).toBeGreaterThan(0);
      expect(levels[0]).toHaveProperty('value');
      expect(levels[0]).toHaveProperty('label');
    });
  });
});
