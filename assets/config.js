/* The Companion: public configuration for the optional server features.
   Only PUBLIC values belong here — the Supabase URL and the anon key are safe
   to publish (every table is behind row-level security; see supabase/).
   Leave supabaseUrl empty to run the site fully static, exactly as before. */
window.COMPANION_CONFIG = {
  supabaseUrl: 'https://fyryeekwkvropkqfshea.supabase.co',     
  supabaseAnonKey: 'sb_publishable_UaS6lZuoDCFTPKW7j9rtpA_p4ydEV_h',
  // Optional view counter: the code of a free GoatCounter site (see assets/counter.js). Empty = off.
  goatcounter: '',
  github: { owner: 'iitmbsc-student-projects', repo: 'the-companion' }
};
