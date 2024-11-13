
import { EngineCreateOpts, Model } from 'types/index.d'
import OpenAI from './openai'

export default class extends OpenAI {

  constructor(config: EngineCreateOpts) {
    super(config, {
      apiKey: config.apiKey,
      baseURL: 'https://api.x.ai/v1',
    })
  }

  getName(): string {
    return 'xai'
  }

  getVisionModels(): string[] {
    return []
  }
  
  async getModels(): Promise<Model[]> {
    // need an api key
    if (!this.client.apiKey) {
      return []
    }

    // do it
    return [
      { id: 'grok-beta', name: 'Grok Beta' },
    ]

  }

  protected setBaseURL() {
    // avoid override by super
  }

}
