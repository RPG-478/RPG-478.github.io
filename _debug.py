path = r'c:\Users\aiueo\OneDrive\デスクトップ\archy\App.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Check what the split looks like in the file
idx = content.find('currentCode.split')
if idx >= 0:
    print(f'Found at {idx}: {repr(content[idx:idx+40])}')
else:
    print('Not found')

# Check the full old block character by character
start = content.find('{!isDev && (')
if start < 0:
    print('No {!isDev found')
else:
    # Get from 50 chars before to 800 chars after
    block = content[start-50:start+800]
    print(repr(block[:200]))
    print('...')
    print(repr(block[600:]))
