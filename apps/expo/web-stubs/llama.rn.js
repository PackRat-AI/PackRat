/**
 * Web stub for llama.rn.
 * On-device LLM inference is not supported on web.
 */
module.exports = {
  initLlama: async () => {
    throw new Error('On-device LLM is not supported on web.');
  },
  LlamaContext: class {},
  loadLlamaModelInfo: async () => {
    throw new Error('On-device LLM is not supported on web.');
  },
};
