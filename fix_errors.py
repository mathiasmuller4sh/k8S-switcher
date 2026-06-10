import re

# 1. Fix PortForwardButton
with open('src/components/actions/PortForwardButton.tsx', 'r') as f:
    content = f.read()
# Replace double settings declaration
content = content.replace("  const { settings } = useSettings();\n  const { settings } = useSettings();", "  const { settings } = useSettings();")
# Handle cases where it might be further apart
content = re.sub(r"(const { settings } = useSettings\(\);\n.+?)const { settings } = useSettings\(\);\n", r"\1", content, flags=re.DOTALL)
with open('src/components/actions/PortForwardButton.tsx', 'w') as f:
    f.write(content)

# 2. Fix RolloutRestartButton
with open('src/components/actions/RolloutRestartButton.tsx', 'r') as f:
    content = f.read()
content = content.replace("const { settings } = useSettings();", "")
with open('src/components/actions/RolloutRestartButton.tsx', 'w') as f:
    f.write(content)

# 3. Fix NamespaceSelector.tsx title attribute on Lucide icon
with open('src/components/k8s/NamespaceSelector.tsx', 'r') as f:
    content = f.read()
content = content.replace(
    '''      {selected && (
        <Terminal 
          size={14} 
          style={{ cursor: 'pointer', color: 'var(--primary)' }} 
          onClick={handleOpenTerminal}
          title="Open Terminal in this Namespace"
        />
      )}''',
    '''      {selected && (
        <div title="Open Terminal in this Namespace" style={{ display: 'flex' }}>
          <Terminal 
            size={14} 
            style={{ cursor: 'pointer', color: 'var(--primary)' }} 
            onClick={handleOpenTerminal}
          />
        </div>
      )}'''
)
with open('src/components/k8s/NamespaceSelector.tsx', 'w') as f:
    f.write(content)

# 4. Fix useSettings.ts unused useEffect
with open('src/hooks/useSettings.ts', 'r') as f:
    content = f.read()
content = content.replace("import { useState, useEffect } from 'react';", "import { useState } from 'react';")
with open('src/hooks/useSettings.ts', 'w') as f:
    f.write(content)

print("Fixed errors.")
