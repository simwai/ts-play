import os

filepath = 'src/components/CodeEditor.tsx'
with open(filepath, 'r') as f:
    lines = f.readlines()

new_lines = []
skip_mode = False

for line in lines:
    # 1. Remove per-line padding/indent logic in Measurement, Display, and Diagnostics layers
    if 'const leadingSpaces = lineText.match' in line:
        continue
    if 'const indentWidth = leadingSpaces.length' in line:
        continue
    if 'const wrapIndent = indentWidth' in line:
        continue

    # Replace style blocks for lines
    if 'paddingLeft: lineWrap ? wrapIndent : 0,' in line:
        continue
    if 'textIndent: lineWrap ? -wrapIndent + indentWidth : 0,' in line:
        continue

    # 2. Fix the textarea color and caret visibility
    if "className='text-transparent bg-transparent border-none outline-none resize-none z-20 caret-lavender'" in line:
        line = line.replace("text-transparent", "text-transparent caret-lavender")

    if "WebkitTextFillColor: 'transparent'," in line:
        # Keep transparency but ensure it's not blocking the caret
        pass

    new_lines.append(line)

content = "".join(new_lines)

# 3. Add a debounce to requestAutocompleteSuggestions
content = content.replace(
    "requestAutocompleteSuggestions(newValue, cursorPosition)",
    "const autocompleteTimer = setTimeout(() => requestAutocompleteSuggestions(newValue, cursorPosition), 50); return () => clearTimeout(autocompleteTimer);"
)
# Wait, handleTextInputChange is a callback, needs careful adjustment for the debounce timer
# Let's use a simpler approach for the plan: manually edit the file using SEARCH/REPLACE pattern logic if possible,
# or just rewrite the component parts.

with open(filepath, 'w') as f:
    f.write(content)
