import { Injectable, Logger, ServiceUnavailableException, BadGatewayException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ParsedExpense, parseExpenseJson } from '@split/shared';
import { z } from 'zod';
import { buildExpenseParsePrompt } from './expense-parse.prompt';

export interface AIProvider {
  name: string;
  parseExpense(text: string, systemPrompt: string): Promise<string>;
}

export class RateLimitError extends Error {
  constructor(provider: string) {
    super(`Rate limit hit on ${provider}`);
    this.name = 'RateLimitError';
  }
}

/** Complex multi-line expenses need room; 512 truncates JSON mid-object (causes parse errors). */
const PARSE_MAX_OUTPUT_TOKENS = 2048;

@Injectable()
export class GeminiProvider implements AIProvider {
  name = 'gemini';

  constructor(private config: ConfigService) {}

  async parseExpense(text: string, systemPrompt: string): Promise<string> {
    const apiKey = this.config.get('GEMINI_API_KEY');
    if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

    const url =
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text }] }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
          maxOutputTokens: PARSE_MAX_OUTPUT_TOKENS,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      let message = errText;
      try {
        const parsed = JSON.parse(errText) as { error?: { message?: string } };
        message = parsed.error?.message ?? errText;
      } catch {
        /* keep raw body */
      }

      if (response.status === 429) {
        if (message.includes('limit: 0')) {
          throw new RateLimitError(this.name);
        }
        throw new RateLimitError(this.name);
      }
      throw new Error(`Gemini API error: ${response.status} ${message}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  }
}

@Injectable()
export class GrokProvider implements AIProvider {
  name = 'grok';

  constructor(private config: ConfigService) {}

  private getApiKey(): string | undefined {
    const grokKey = this.config.get<string>('GROK_API_KEY');
    if (grokKey) return grokKey;
    const groqKey = this.config.get<string>('GROQ_API_KEY');
    if (groqKey?.startsWith('xai-')) return groqKey;
    return undefined;
  }

  async parseExpense(text: string, systemPrompt: string): Promise<string> {
    const apiKey = this.getApiKey();
    if (!apiKey) throw new Error('GROK_API_KEY not configured');

    const model = this.config.get('GROK_MODEL') ?? 'grok-3-mini';

    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text },
        ],
        temperature: 0.1,
        max_tokens: PARSE_MAX_OUTPUT_TOKENS,
        response_format: { type: 'json_object' },
      }),
    });

    if (response.status === 429) throw new RateLimitError(this.name);
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Grok API error: ${response.status} ${err}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content ?? '';
  }
}

@Injectable()
export class GroqProvider implements AIProvider {
  name = 'groq';

  constructor(private config: ConfigService) {}

  async parseExpense(text: string, systemPrompt: string): Promise<string> {
    const apiKey = this.config.get('GROQ_API_KEY');
    if (!apiKey) throw new Error('GROQ_API_KEY not configured');

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text },
        ],
        temperature: 0.1,
        max_tokens: PARSE_MAX_OUTPUT_TOKENS,
        response_format: { type: 'json_object' },
      }),
    });

    if (response.status === 429) throw new RateLimitError(this.name);
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Groq API error: ${response.status} ${err}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content ?? '';
  }
}

@Injectable()
export class OpenRouterProvider implements AIProvider {
  name = 'openrouter';

  constructor(private config: ConfigService) {}

  async parseExpense(text: string, systemPrompt: string): Promise<string> {
    const apiKey = this.config.get('OPENROUTER_API_KEY');
    if (!apiKey) throw new Error('OPENROUTER_API_KEY not configured');

    const primaryModel = this.config.get('OPENROUTER_MODEL') ?? 'google/gemini-2.5-flash';
    const fallbackModels = ['meta-llama/llama-3.1-8b-instruct'];
    const models = [primaryModel, ...fallbackModels.filter((m) => m !== primaryModel)];

    const body = {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text },
      ],
      temperature: 0.1,
      max_tokens: PARSE_MAX_OUTPUT_TOKENS,
      response_format: { type: 'json_object' },
    };

    let lastError = 'OpenRouter request failed';

    for (const model of models) {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://split.app',
          'X-Title': 'Split Expense App',
        },
        body: JSON.stringify({ ...body, model }),
      });

      if (response.status === 429) throw new RateLimitError(this.name);
      if (!response.ok) {
        lastError = await response.text();
        if (response.status === 402 || response.status === 404) continue;
        throw new Error(`OpenRouter API error: ${response.status} ${lastError}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content ?? '';
      if (content.trim()) return content;
      lastError = 'empty response';
    }

    throw new Error(`OpenRouter API error: ${lastError}`);
  }
}

@Injectable()
export class AIService implements OnModuleInit {
  private readonly logger = new Logger(AIService.name);
  private providers: AIProvider[] = [];

  constructor(
    private readonly gemini: GeminiProvider,
    private readonly grok: GrokProvider,
    private readonly groq: GroqProvider,
    private readonly openrouter: OpenRouterProvider,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const candidates: { provider: AIProvider; enabled: boolean }[] = [
      { provider: this.gemini, enabled: !!this.config.get('GEMINI_API_KEY') },
      {
        provider: this.grok,
        enabled: !!(this.config.get('GROK_API_KEY') || this.config.get('GROQ_API_KEY')?.startsWith('xai-')),
      },
      {
        provider: this.groq,
        enabled: !!this.config.get('GROQ_API_KEY') && !this.config.get('GROQ_API_KEY')?.startsWith('xai-'),
      },
      { provider: this.openrouter, enabled: !!this.config.get('OPENROUTER_API_KEY') },
    ];

    this.providers = candidates.filter((c) => c.enabled).map((c) => c.provider);

    if (this.providers.length === 0) {
      this.logger.warn(
        'No AI provider API keys configured. Set GEMINI_API_KEY (and optionally GROK_API_KEY / OPENROUTER_API_KEY) in apps/api/.env',
      );
    } else {
      this.logger.log(`AI fallback chain: ${this.providers.map((p) => p.name).join(' → ')}`);
    }
  }

  sanitizeInput(text: string): string {
    return text
      .slice(0, 2000)
      .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]')
      .replace(/\b\d{16}\b/g, '[CARD]')
      .trim();
  }

  async parseExpense(
    text: string,
    context?: { memberNames?: string[]; defaultCurrency?: string; speakerName?: string },
  ): Promise<ParsedExpense> {
    if (this.providers.length === 0) {
      throw new ServiceUnavailableException(
        'AI expense parsing is not configured. Add GEMINI_API_KEY (and optionally GROK_API_KEY / OPENROUTER_API_KEY) to apps/api/.env and restart the API.',
      );
    }

    const sanitized = this.sanitizeInput(text);
    const prompt = buildExpenseParsePrompt(context);

    const errors: string[] = [];

    for (const provider of this.providers) {
      try {
        const raw = await provider.parseExpense(sanitized, prompt);
        if (!raw.trim()) {
          errors.push(`${provider.name}: empty response`);
          continue;
        }
        return parseExpenseJson(raw);
      } catch (err) {
        if (err instanceof z.ZodError) {
          this.logger.warn(
            `AI provider ${provider.name} invalid JSON shape: ${err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
          );
          errors.push(`${provider.name}: invalid JSON shape`);
          continue;
        }
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`${provider.name}: ${message}`);
        this.logger.warn(`AI provider ${provider.name} failed: ${message}`);
        continue;
      }
    }

    throw new BadGatewayException(
      errors.length > 0 ? `AI parsing failed: ${errors.join('; ')}` : 'All AI providers failed',
    );
  }
}
