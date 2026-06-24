import os
import glob

def fix_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # Revert prism(a as any).attendanceField. back to prisma.attendanceField.
    content = content.replace('prism(a as any).attendanceField.', 'prisma.attendanceField.')
    content = content.replace('prism(b as any).attendanceField.', 'prisma.attendanceField.')
    
    with open(filepath, 'w') as f:
        f.write(content)

for root, dirs, files in os.walk('src/routes'):
    for file in files:
        if file.endswith('.ts'):
            fix_file(os.path.join(root, file))

