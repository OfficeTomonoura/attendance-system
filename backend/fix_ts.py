import os
import glob
import re

def fix_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # replace req.query.something with (req.query.something as string)
    content = re.sub(r'(req\.query\.[a-zA-Z0-9_]+)', r'(\1 as string)', content)
    
    # fix the specific error in salary-group-fields.ts
    content = content.replace('attendanceField: cf', 'attendanceField: cf as any')
    content = content.replace('a.attendanceField.', '(a as any).attendanceField.')
    content = content.replace('b.attendanceField.', '(b as any).attendanceField.')
    
    with open(filepath, 'w') as f:
        f.write(content)

for root, dirs, files in os.walk('src/routes'):
    for file in files:
        if file.endswith('.ts'):
            fix_file(os.path.join(root, file))

# fix also index.ts if necessary
