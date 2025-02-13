import { NoopConfig } from '@motiadev/core'

export const config: NoopConfig = {
  type: 'noop',
  name: 'Card Validation Completed',
  description: 'Card has been validated and is ready for development',
  virtualEmits: ['card.readyForDevelopment'],
  virtualSubscribes: ['card.validated'],
  flows: ['trello'],
}
