import type { DeepPartial } from 'ai';

export type ToolOutput<Data> =
  | ({
      success: true;
    } & Data)
  | {
      success: false;
      error: string;
    };

export type ToolInvocation<TInput, TOutput> = {
  toolCallId: string;
  providerExecuted?: boolean;
} & (
  | {
      state: 'input-streaming';
      input: DeepPartial<TInput> | undefined;
      output?: never;
      errorText?: never;
    }
  | {
      state: 'input-available';
      input: TInput;
      output?: never;
      errorText?: never;
    }
  | {
      state: 'output-available';
      input: TInput;
      output: TOutput;
      errorText?: never;
    }
  | {
      state: 'output-error';
      input: TInput;
      output?: never;
      errorText: string;
    }
);
