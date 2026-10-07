import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  // Declare your Neon services here
  // Data API só porque o app usa supabase-js com RLS (compatibilidade PostgREST); exige Neon Auth.
  auth: true,
  dataApi: true,
  // Branch policy: per-branch tuning
  branch: (branch) => {
    if (branch.isDefault) {
      // Default branch: no overrides, uses project defaults
      return {};
    }
    if (!branch.exists) {
      // New non-default branches: auto-expire
      // Run `neon checkout <name>` to create a new branch with these settings
      return { ttl: "7d" };
    }
    // Existing branch: no changes
    return {};
  },
});
