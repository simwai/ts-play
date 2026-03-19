import os

filepath = 'src/components/SettingsModal.tsx'
with open(filepath, 'r') as f:
    content = f.read()

# Make the checkbox layout more consistent
content = content.replace(
    "<div className='flex flex-col gap-4'>\n              <div className='flex flex-col gap-2'>\n                <label className='text-sm font-bold text-subtext0'>\n                  Interpret ANSI Escapes\n                </label>\n                <div className='flex items-center'>\n                  <input",
    "<div className='flex flex-col gap-4'>\n              <div className='flex items-center justify-between'>\n                <label className='text-sm font-bold text-subtext0'>\n                  Interpret ANSI Escapes\n                </label>\n                <div className='flex items-center'>\n                  <input"
)

content = content.replace(
    "<div className='flex flex-col gap-2'>\n                <label className='text-sm font-bold text-subtext0'>\n                  Line Wrapping\n                </label>\n                <div className='flex items-center'>\n                  <input",
    "<div className='flex items-center justify-between'>\n                <label className='text-sm font-bold text-subtext0'>\n                  Line Wrapping\n                </label>\n                <div className='flex items-center'>\n                  <input"
)

with open(filepath, 'w') as f:
    f.write(content)
