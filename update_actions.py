import os
import glob
import re

actions_dir = "/Users/mmuller/dev/4sh/mmr-k8s-switcher/src/components/actions"
files = glob.glob(f"{actions_dir}/*Button.tsx")

for file in files:
    with open(file, 'r') as f:
        content = f.read()

    # Add useSettings import if not present
    if "useSettings" not in content:
        content = re.sub(
            r"(import .* from '@tauri-apps/api/core';)",
            r"\1\nimport { useSettings } from '../../hooks/useSettings';",
            content
        )

    # Add const { settings } = useSettings(); if not present
    if "useSettings();" not in content:
        content = re.sub(
            r"(const { addAction } = useActionHistory\(\);)",
            r"\1\n  const { settings } = useSettings();",
            content
        )
        content = re.sub(
            r"(const \[loading, setLoading\] = useState\(false\);)",
            r"\1\n  const { settings } = useSettings();",
            content
        )

    # Add terminalApp: settings.terminalApp to invoke arguments
    content = re.sub(
        r"(invoke\('open_(?:shell|logs|describe|logs_by_label)', \{[^}]+)",
        r"\1, terminalApp: settings.terminalApp ",
        content
    )
    content = re.sub(
        r"(invoke\('start_port_forward', \{[^}]+)",
        r"\1, terminalApp: settings.terminalApp ",
        content
    )

    with open(file, 'w') as f:
        f.write(content)
        
print("Updated action buttons.")
