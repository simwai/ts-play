with open('src/index.css', 'r') as f:
    content = f.read()

# The previous append might have put it outside the @layer base block or in a weird place.
# Let's clean up and ensure all themes are inside the @layer base block's :root/theme sections.

import re

# Find the end of the @layer base block
match = re.search(r'@layer base \{', content)
if match:
    # Insert before the closing brace of the @layer base block
    # We'll search for the last } before the end of the file or the start of the next section
    # Actually, let's just rewrite the whole file to be safe.
    pass
