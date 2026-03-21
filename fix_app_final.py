import sys

file_path = 'src/App.tsx'
with open(file_path, 'r') as f:
    content = f.read()

# Add a ref to track if initial install has been done
search_import = "import { usePackageManager } from './hooks/usePackageManager'"
replace_import = search_import + "\nimport { runCommand } from './lib/webcontainer'"

if search_import in content:
    content = content.replace(search_import, replace_import)

search_init = """  useEffect(() => {
    getWebContainer().then(async (instance) => {
      try {
        const pkgJson = {
          name: 'playground',
          type: 'module',
          dependencies: {
            esbuild: '^0.23.1',
          },
        }
        await instance.fs.writeFile(
          'package.json',
          JSON.stringify(pkgJson, null, 2)
        )
        await instance.fs.writeFile('tsconfig.json', tsConfigString)
      } catch (error) {
        console.error('Failed to sync config files to WebContainer:', error)
      }
    })
  }, [tsConfigString])"""

# We only want to run npm install once or when package.json dependencies change significantly
# But for now, let's just make sure it's called after the first write.

replace_init = """  const isInitialSync = useRef(true);
  useEffect(() => {
    getWebContainer().then(async (instance) => {
      try {
        const pkgJson = {
          name: 'playground',
          type: 'module',
          dependencies: {
            esbuild: '^0.23.1',
          },
        }
        await instance.fs.writeFile(
          'package.json',
          JSON.stringify(pkgJson, null, 2)
        )
        await instance.fs.writeFile('tsconfig.json', tsConfigString)

        if (isInitialSync.current) {
          isInitialSync.current = false;
          addMessage('info', ['Preparing environment...']);
          const { exit } = await runCommand('npm', ['install', '--no-progress'], (out) => {
             // Optional: suppress noise during initial boot
          });
          await exit;
          addMessage('info', ['Environment ready.']);
        }
      } catch (error) {
        console.error('Failed to sync config files to WebContainer:', error)
      }
    })
  }, [tsConfigString, addMessage])"""

if search_init in content:
    content = content.replace(search_init, replace_init)
    with open(file_path, 'w') as f:
        f.write(content)
    print("Successfully patched App.tsx for initial install")
else:
    print("Could not find search_init")
    sys.exit(1)
