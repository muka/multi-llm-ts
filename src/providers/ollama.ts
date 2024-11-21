
import { EngineCreateOpts, Model, ModelsList } from 'types/index.d'
import { LLmCompletionPayload, LlmChunk, LlmCompletionOpts, LlmResponse, LlmStream } from 'types/llm.d'
import Message from '../models/message'
import LlmEngine from '../engine'
import logger from '../logger'

import { Ollama, ChatResponse, ProgressResponse } from 'ollama/dist/browser.cjs'

export default class extends LlmEngine {

  client: any
  currentOpts: LlmCompletionOpts|null = null

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  static isConfigured = (engineConfig: EngineCreateOpts): boolean => {
    return true
  }

  static isReady = (opts: EngineCreateOpts, models: ModelsList): boolean => {
    return models?.chat?.length > 0
  }

  constructor(config: EngineCreateOpts) {
    super(config)
    this.client = new Ollama({
      host: config.baseURL,
    })
  }

  getName(): string {
    return 'ollama'
  }

  getVisionModels(): string[] {
    return [ 'llama3.2-vision*', 'llava-llama3:latest', 'llava:latest', '*llava*' ]
  }

  async getModels(): Promise<Model[]> {
    try {
      const response = await this.client.list()
      return response.models.map((model: any) => {
        return {
          id: model.model,
          name: model.name,
          meta: model,
        }
      })
    } catch (error) {
      console.error('Error listing models:', error);
      return [] 
    }
  }

  async getModelInfo(model: string): Promise<any> {
    try {
      return await this.client.show({ model: model })
    } catch (error) {
      console.error('Error listing models:', error);
      return
    }
  }

  async pullModel(model: string): Promise<AsyncGenerator<ProgressResponse>|null> {
    try {
      return this.client.pull({
        model: model,
        stream: true
      })
    } catch (error) {
      console.error('Error pulling models:', error);
      return null
    }
  }

  async complete(model: string, thread: Message[], opts?: LlmCompletionOpts): Promise<LlmResponse> {

    // call
    logger.log(`[ollama] prompting model ${model}`)
    const response = await this.client.chat({
      model: model,
      messages: this.buildPayload(model, thread),
      stream: false
    });

    // return an object
    return {
      type: 'text',
      content: response.message.content,
      ...(opts?.usage ?  { usage: {
        prompt_tokens: response.prompt_eval_count,
        completion_tokens: response.eval_count,
      } } : {})
    }
  }

  async stream(model: string, thread: Message[], opts?: LlmCompletionOpts): Promise<LlmStream> {

    // model: switch to vision if needed
    model = this.selectModel(model, thread, opts)

    // save opts
    this.currentOpts = opts || null
  
    // call
    logger.log(`[ollama] prompting model ${model}`)
    const stream = this.client.chat({
      model: model,
      messages: this.buildPayload(model, thread),
      stream: true,
    })

    // done
    return stream

  }

  async stop() {
    await this.client.abort()
  }

  async *nativeChunkToLlmChunk(chunk: ChatResponse): AsyncGenerator<LlmChunk, void, void> {

    yield {
      type: 'content',
      text: chunk.message.content || '',
      done: chunk.done
    }

    if (this.currentOpts?.usage && chunk.done) {
      yield {
        type: 'usage',
        usage: {
          prompt_tokens: chunk.prompt_eval_count,
          completion_tokens: chunk.eval_count,
      }}
    } 
  
  }

  addAttachmentToPayload(message: Message, payload: LLmCompletionPayload) {
    if (message.attachment) {
      payload.images = [ message.attachment.content ]
    }
  }

}
