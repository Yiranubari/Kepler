export interface AICompletionRequest {
  readonly system: string;
  readonly user: string;
  readonly maxTokens: number;
  readonly temperature: number;
}

export interface AICompletionResponse {
  readonly text: string;
  readonly model: string;
  readonly provider: string;
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
}

export interface AIProvider {
  readonly name: string;
  readonly model: string;
  complete(request: AICompletionRequest): Promise<AICompletionResponse>;
}
