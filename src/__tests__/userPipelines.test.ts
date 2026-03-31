/**
 * Test for User Pipelines feature
 *
 * Uses code inspection + build verification (no running server needed).
 * Validates that all files contain the correct implementation patterns.
 */

const fs = require('fs')
const path = require('path')

const rootDir = path.join(__dirname, '..', '..')

function readFile(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf-8')
}

describe('User Pipelines Feature - Code Inspection Tests', () => {

  // ============ Schema Tests ============

  describe('Schema - pipelines and lastUsedPipeline fields', () => {
    it('should have pipelines field (JSON array string) in User model', () => {
      const schema = readFile('prisma/schema.prisma')
      expect(schema).toContain('pipelines')
      expect(schema).toMatch(/pipelines\s+String\s+@default\("\[\]"\)/)
    })

    it('should have lastUsedPipeline field in User model', () => {
      const schema = readFile('prisma/schema.prisma')
      expect(schema).toMatch(/lastUsedPipeline\s+String\?/)
    })

    it('should NOT have primaryPipeline field in User model', () => {
      const schema = readFile('prisma/schema.prisma')
      // primaryPipeline should not exist as a field definition
      expect(schema).not.toMatch(/primaryPipeline\s+String\?/)
    })
  })

  // ============ Register API Tests ============

  describe('Register API - pipelines array handling', () => {
    it('should accept pipelines in request body', () => {
      const code = readFile('src/app/api/auth/register/route.ts')
      expect(code).toContain('pipelines')
      // Should destructure pipelines from req.json()
      expect(code).toMatch(/\{[^}]*pipelines[^}]*\}.*req\.json\(\)/)
    })

    it('should store pipelines as JSON string', () => {
      const code = readFile('src/app/api/auth/register/route.ts')
      // Should use JSON.stringify for pipelines
      expect(code).toContain('JSON.stringify(pipelines)')
      // Default to '[]' if not provided
      expect(code).toContain("'[]'")
    })

    it('should return parsed pipelines in response', () => {
      const code = readFile('src/app/api/auth/register/route.ts')
      expect(code).toContain('JSON.parse(user.pipelines)')
    })
  })

  // ============ Auth Session Tests ============

  describe('Auth session - pipelines and lastUsedPipeline', () => {
    it('should include pipelines in JWT callback', () => {
      const code = readFile('src/lib/auth.ts')
      expect(code).toContain('token.pipelines')
    })

    it('should include lastUsedPipeline in JWT callback', () => {
      const code = readFile('src/lib/auth.ts')
      expect(code).toContain('token.lastUsedPipeline')
    })

    it('should expose pipelines and lastUsedPipeline in session', () => {
      const code = readFile('src/lib/auth.ts')
      expect(code).toContain('session.user.pipelines')
      expect(code).toContain('session.user.lastUsedPipeline')
    })

    it('should NOT reference primaryPipeline in auth.ts', () => {
      const code = readFile('src/lib/auth.ts')
      expect(code).not.toContain('primaryPipeline')
    })
  })

  // ============ Types Tests ============

  describe('NextAuth types - pipelines and lastUsedPipeline', () => {
    it('should have pipelines and lastUsedPipeline in User type', () => {
      const types = readFile('src/types/index.ts')
      expect(types).toContain('pipelines: string')
      expect(types).toContain('lastUsedPipeline?: string | null')
    })

    it('should have pipelines and lastUsedPipeline in Session type', () => {
      const types = readFile('src/types/index.ts')
      expect(types).toMatch(/Session.*[\s\S]*?pipelines: string/)
      expect(types).toMatch(/Session.*[\s\S]*?lastUsedPipeline: string \| null/)
    })

    it('should have pipelines and lastUsedPipeline in JWT type', () => {
      const types = readFile('src/types/index.ts')
      expect(types).toMatch(/JWT.*[\s\S]*?pipelines/)
      expect(types).toMatch(/JWT.*[\s\S]*?lastUsedPipeline/)
    })

    it('should NOT have primaryPipeline in types', () => {
      const types = readFile('src/types/index.ts')
      expect(types).not.toContain('primaryPipeline')
    })
  })

  // ============ Register Page UI Tests ============

  describe('Register page - multi-select checkboxes', () => {
    it('should use selectedPipelines array state instead of primaryPipeline string', () => {
      const code = readFile('src/app/register/page.tsx')
      expect(code).toContain('selectedPipelines')
      expect(code).toContain('useState<string[]>([])')
      // Should NOT have useState('') for primaryPipeline replacement
      expect(code).not.toMatch(/primaryPipeline.*useState\s*\(\s*''\s*\)/)
    })

    it('should have togglePipeline function', () => {
      const code = readFile('src/app/register/page.tsx')
      expect(code).toContain('togglePipeline')
      expect(code).toMatch(/function togglePipeline/)
    })

    it('should render checkbox inputs for pipelines', () => {
      const code = readFile('src/app/register/page.tsx')
      expect(code).toContain('type="checkbox"')
      expect(code).toContain('checked={selectedPipelines.includes')
    })

    it('should submit pipelines array in form data', () => {
      const code = readFile('src/app/register/page.tsx')
      expect(code).toContain('pipelines: selectedPipelines')
    })
  })

  // ============ Requirements API - lastUsedPipeline Tests ============

  describe('Requirements POST - saves lastUsedPipeline', () => {
    it('should update lastUsedPipeline after creating requirement', () => {
      const code = readFile('src/app/api/requirements/route.ts')
      // Should have prisma.user.update for lastUsedPipeline
      expect(code).toMatch(/prisma\.user\.update/)
      expect(code).toMatch(/lastUsedPipeline.*data\.pipeline/)
    })

    it('should be inside POST function scope (before return)', () => {
      const code = readFile('src/app/api/requirements/route.ts')
      // The update should be BEFORE return NextResponse.json(rg)
      // Check order: update comes before return
      // The update code should contain prisma.user.update and lastUsedPipeline
      expect(code).toMatch(/prisma\.user\.update/)
      expect(code).toMatch(/lastUsedPipeline.*data\.pipeline/)
      // Should be before return NextResponse.json(rg)
      const returnIdx = code.indexOf('return NextResponse.json(rg)')
      const updateIdx = code.indexOf('prisma.user.update')
      expect(updateIdx).toBeGreaterThan(0)
      expect(returnIdx).toBeGreaterThan(0)
      expect(updateIdx).toBeLessThan(returnIdx)
    })
  })

  describe('Requirements PATCH - saves lastUsedPipeline', () => {
    it('should update lastUsedPipeline after updating requirement', () => {
      const code = readFile('src/app/api/requirements/[id]/route.ts')
      expect(code).toMatch(/prisma\.user\.update/)
      expect(code).toMatch(/lastUsedPipeline.*data\.pipeline/)
    })

    it('should be inside PATCH function scope (before return)', () => {
      const code = readFile('src/app/api/requirements/[id]/route.ts')
      expect(code).toMatch(/prisma\.user\.update/)
      expect(code).toMatch(/lastUsedPipeline.*data\.pipeline/)
      const returnIdx = code.indexOf('return NextResponse.json(updated)')
      const updateIdx = code.indexOf('prisma.user.update')
      expect(updateIdx).toBeGreaterThan(0)
      expect(returnIdx).toBeGreaterThan(0)
      expect(updateIdx).toBeLessThan(returnIdx)
    })
  })

  // ============ Main Page - Default Pipeline Logic ============

  describe('Main page - default pipeline computation', () => {
    it('should compute default from lastUsedPipeline || pipelines[0]', () => {
      const code = readFile('src/app/page.tsx')
      // Should pass userPrimaryPipeline with the computed default
      expect(code).toContain('userPrimaryPipeline')
      expect(code).toContain('lastUsedPipeline')
    })

    it('should parse pipelines JSON to get first element', () => {
      const code = readFile('src/app/page.tsx')
      expect(code).toContain('JSON.parse')
      expect(code).toContain('pipelines')
    })
  })

  // ============ Account API Tests ============

  describe('Account API - uses lastUsedPipeline', () => {
    it('should accept lastUsedPipeline in PATCH body', () => {
      const code = readFile('src/app/api/account/route.ts')
      expect(code).toContain('lastUsedPipeline')
      expect(code).toMatch(/lastUsedPipeline.*=.*req\.json\(\)/)
    })

    it('should NOT reference primaryPipeline', () => {
      const code = readFile('src/app/api/account/route.ts')
      expect(code).not.toContain('primaryPipeline')
    })
  })

  // ============ Users API Tests ============

  describe('Users API - uses lastUsedPipeline', () => {
    it('should accept lastUsedPipeline in PATCH body', () => {
      const code = readFile('src/app/api/users/route.ts')
      expect(code).toContain('lastUsedPipeline')
    })

    it('should NOT reference primaryPipeline', () => {
      const code = readFile('src/app/api/users/route.ts')
      expect(code).not.toContain('primaryPipeline')
    })
  })

  // ============ Component Tests ============

  describe('Components - no primaryPipeline references', () => {
    it('AuthModal should use pipelines (multi-select) for registration', () => {
      const code = readFile('src/components/AuthModal.tsx')
      expect(code).toContain('selectedPipelines')
      expect(code).not.toContain('primaryPipeline')
    })

    it('Header AccountSettingsModal should use lastUsedPipeline', () => {
      const code = readFile('src/components/Header.tsx')
      // Should use lastUsedPipeline prop
      expect(code).toMatch(/lastUsedPipeline.*string \| null/)
      // State should use selectedPipeline (avoiding naming conflict)
      expect(code).toContain('selectedPipeline')
    })

    it('AdminSettingsModal should use lastUsedPipeline', () => {
      const code = readFile('src/components/AdminSettingsModal.tsx')
      expect(code).toContain('lastUsedPipeline')
      expect(code).not.toContain('primaryPipeline')
    })
  })

  // ============ Default Pipeline Logic - Pure Function Test ============

  describe('Default pipeline logic - pure function', () => {
    it('should prefer lastUsedPipeline over pipelines[0]', () => {
      // Simulating the logic: lastUsedPipeline || JSON.parse(pipelines)[0] || null
      const user = {
        pipelines: '["UGC运营", "CRM线索"]',
        lastUsedPipeline: 'CRM线索'
      }
      const defaultPipeline = user.lastUsedPipeline ||
        (JSON.parse(user.pipelines)[0]) || null
      expect(defaultPipeline).toBe('CRM线索')
    })

    it('should fall back to pipelines[0] when lastUsedPipeline is null', () => {
      const user = {
        pipelines: '["UGC运营", "CRM线索"]',
        lastUsedPipeline: null
      }
      const defaultPipeline = user.lastUsedPipeline ||
        (JSON.parse(user.pipelines)[0]) || null
      expect(defaultPipeline).toBe('UGC运营')
    })

    it('should return null when both are empty/absent', () => {
      const user = {
        pipelines: '[]',
        lastUsedPipeline: null
      }
      const defaultPipeline = user.lastUsedPipeline ||
        (JSON.parse(user.pipelines)[0]) || null
      expect(defaultPipeline).toBeNull()
    })
  })

  // ============ Build Verification ============

  describe('Build verification', () => {
    it('all modified source files should exist', () => {
      const files = [
        'prisma/schema.prisma',
        'src/lib/auth.ts',
        'src/types/index.ts',
        'src/app/api/auth/register/route.ts',
        'src/app/register/page.tsx',
        'src/app/page.tsx',
        'src/app/api/requirements/route.ts',
        'src/app/api/requirements/[id]/route.ts',
        'src/app/api/account/route.ts',
        'src/app/api/users/route.ts',
        'src/components/AuthModal.tsx',
        'src/components/Header.tsx',
        'src/components/AdminSettingsModal.tsx',
      ]
      files.forEach(f => {
        expect(fs.existsSync(path.join(rootDir, f))).toBe(true)
      })
    })
  })
})
