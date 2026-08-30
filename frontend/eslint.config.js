import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    // These modules intentionally expose compound component APIs or a lazy
    // route registry. They are not mixed component/helper modules, so the
    // Fast Refresh export heuristic does not model their public boundary.
    files: [
      'src/components/layout/Drawer.tsx',
      'src/components/ui/DataTable.tsx',
      'src/components/ui/DropdownMenu.tsx',
      'src/components/ui/InspectionDrawer.tsx',
      'src/components/ui/Modal.tsx',
      'src/router/routes.tsx',
    ],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
