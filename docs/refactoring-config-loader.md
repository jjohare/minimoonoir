# Config Loader Refactoring - Eliminated Hardcoded YAML Duplication

## Problem
The `src/lib/config/loader.ts` file contained a ~160 line hardcoded YAML string (`defaultConfigYaml`) that duplicated the content of `config/sections.yaml`. This created:
- Maintenance burden (two places to update)
- Risk of drift between the hardcoded string and the actual YAML file
- Unnecessary code bloat

## Solution
Replaced the hardcoded YAML string with Vite's raw import feature to load the YAML file at build time.

## Changes Made

### Before (Lines 23-161)
```typescript
// Default YAML config embedded at build time
const defaultConfigYaml = `
app:
  name: "Nostr BBS"
  version: "1.0.0"
  // ... 160 lines of hardcoded YAML ...
`;
```

### After (Line 24)
```typescript
// Import default YAML config at build time using Vite's raw import
// This eliminates duplication with config/sections.yaml
import defaultConfigYaml from '../../../config/sections.yaml?raw';
```

## How It Works

1. **Vite Raw Import**: The `?raw` suffix tells Vite to import the file content as a string at build time
2. **No Runtime Loading**: The YAML content is bundled into the JavaScript at build time (same behavior as before)
3. **Single Source of Truth**: `config/sections.yaml` is now the only source for default configuration
4. **Backwards Compatible**: The `loadConfig()` function works exactly the same way

## Benefits

- **Eliminated ~160 lines** of duplicated code
- **Single source of truth** for default configuration
- **No risk of drift** between hardcoded string and YAML file
- **Same performance** - still loads at build time, no runtime file reading
- **Works in browser and SSR** - Vite handles the import in both contexts

## Testing

The refactoring maintains all existing functionality:
- `loadConfig()` still checks localStorage first
- Falls back to default YAML config (now imported from file)
- `getDefaultConfig()` remains as programmatic fallback
- All config accessor functions unchanged

## Files Modified

- `src/lib/config/loader.ts` - Replaced hardcoded string with import

## Files Referenced

- `config/sections.yaml` - The single source of truth for default configuration
- `vite.config.ts` - Vite handles `?raw` imports automatically

## Verification

The change can be verified by:
1. Building the project: `npm run build`
2. Running type checks: `npm run typecheck`
3. Testing config loading in both browser and SSR contexts

## Notes

- Vite's `?raw` import is a standard feature and works out of the box
- No changes needed to `vite.config.ts`
- The YAML file is read at build time, not runtime
- This maintains the same security and performance characteristics as before
