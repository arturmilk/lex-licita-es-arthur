export const supabase = {
  auth: {
    signInWithPassword: async () => ({ data: { session: { user: { id: "mock-user" } } }, error: null }),
    getSession: async () => ({ data: { session: { user: { id: "mock-user" } } }, error: null }),
    signOut: async () => ({ error: null }),
  },
  from: () => ({
    select: () => ({ data: [], error: null }),
    insert: () => ({ data: [], error: null }),
    update: () => ({ data: [], error: null }),
    eq: () => ({ data: [], error: null }),
  }),
};
export const supabaseAdmin = supabase;
