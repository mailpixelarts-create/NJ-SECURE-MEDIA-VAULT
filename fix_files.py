import os
import re

for root, dirs, files in os.walk('src'):
    for file in files:
        if file.endswith(('.ts', '.tsx')):
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
            
            # Remove trailing empty lines
            while lines and not lines[-1].strip():
                lines.pop()
            
            # Remove garbage from the bottom
            while lines:
                last_line = lines[-1].strip()
                if (re.match(r'^\d+\.\s+[A-Z]', last_line) or 
                    last_line.startswith("Continuing") or
                    last_line in ['bash', 'json', 'yaml', 'typescript', 'javascript', 'tsx', 'ts', 'css'] or
                    last_line.startswith("---") or
                    last_line.startswith("# ") or
                    last_line.startswith("Install ")):
                    lines.pop()
                else:
                    break
            
            with open(path, 'w', encoding='utf-8') as f:
                f.writelines(lines)
