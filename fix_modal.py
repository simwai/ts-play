import os

filepath = 'src/components/SettingsModal.tsx'
with open(filepath, 'r') as f:
    content = f.read()

# Restore IconButton ghost variant
content = content.replace(
    "size='sm'\n            variant='danger'\n            className='-mr-2'",
    "size='sm'\n            variant='ghost'\n            className='-mr-2'"
)

# Reset button is already danger (from my previous sed), but let's make sure it's correct
# Cancel button should be secondary
content = content.replace(
    "variant='danger'\n          >\n            Cancel",
    "variant='secondary'\n          >\n            Cancel"
)

with open(filepath, 'w') as f:
    f.write(content)
