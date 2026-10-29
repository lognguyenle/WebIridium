export type OpenAiMessage = { text: string };

export type OpenAiOutput = { content: OpenAiMessage[]; type: string };

export type OpenAiResponse = { output: OpenAiOutput[] };
