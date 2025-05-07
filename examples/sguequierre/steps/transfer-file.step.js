// transfer-file.step.js
const config = {
    type: 'noop',
    description: 'Transfer file step.',
    name: 'transfer-file',
    virtualEmits: ['docs-transferred'],
    virtualSubscribes: ['documentation-integrated'],
    flows: ['documentation-guardian'],
  }
   
  module.exports = { config }