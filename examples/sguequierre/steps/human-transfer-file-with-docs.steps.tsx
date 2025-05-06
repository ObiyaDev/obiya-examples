// human-transfer-file-with-docs.step.tsx
import React from 'react'
import { BaseHandle, Position } from 'motia/workbench'
import '@xyflow/react/dist/style.css'
 
export default function HumanTransferFileWithDocs() {
  return (
    <div className="p-4 bg-gray-800 rounded-lg border border-gray-600 text-white">
      <div className="text-sm font-medium">At this point, you should transfer the documented file from your motia project's output directory to the local directory the original file lives in.</div>
      {/* Your custom UI elements */}
      <BaseHandle type="source" position={Position.Bottom} />
    </div>
  )
}