// human-transfer-file-with-docs.step.ts
import { NoopConfig } from 'motia'

export const config: NoopConfig = {
    type: 'noop',
    name: 'human-transfer-file-with-docs',
    virtualEmits: ['docs-transferred'],
    virtualSubscribes: ['documentation-integrated'],
    flows: ['documentation-guardian']
  }