/* The Companion: optional sign-in (Supabase + Google).
   Without a configured server (assets/config.js) this file does nothing and
   the site behaves exactly as before. With one, it adds a small sign-in /
   sign-out control to the top bar (or the course-page sidebar) and exposes
   window.CompanionAuth for the other scripts:

     CompanionAuth.ready        -> Promise<client or null>
     CompanionAuth.client       -> the supabase client (after ready)
     CompanionAuth.user         -> the signed-in user or null
     CompanionAuth.profile      -> the profiles row or null
     CompanionAuth.onChange(fn) -> fn(user) now and on every auth change
     CompanionAuth.signIn() / CompanionAuth.signOut()
*/
(function () {
  'use strict';
  var CFG = window.COMPANION_CONFIG || {};
  var BASE = document.body.getAttribute('data-base') ||
    (/\/courses\/[^/]+$/.test(location.pathname) ? '../' : '');
  var SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/dist/umd/supabase.min.js';

  var listeners = [];
  var A = window.CompanionAuth = {
    client: null, user: null, profile: null,
    enabled: !!(CFG.supabaseUrl && CFG.supabaseAnonKey),
    onChange: function (fn) { listeners.push(fn); fn(A.user); },
    signIn: function () {
      if (!A.client) return Promise.resolve();
      return A.client.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: location.href.split('#')[0] }
      });
    },
    signOut: function () {
      if (!A.client) return Promise.resolve();
      return A.client.auth.signOut().then(function () { location.reload(); });
    }
  };

  function emit() { listeners.forEach(function (fn) { try { fn(A.user); } catch (e) {} }); }

  /* "Sign in to keep this on another device" hints only make sense when signed out. */
  listeners.push(function (u) {
    var hs = document.querySelectorAll('.signin-hint');
    for (var i = 0; i < hs.length; i++) hs[i].hidden = !!u;
  });

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src; s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  /* ---- the little control: "Sign in" / initials with a menu ---- */
  function host() {
    return document.querySelector('.topbar .topbar-in') ||   /* first row, not the scrolling links */
           document.querySelector('.sidebar .sb-bottom') ||  /* course pages */
           null;
  }
  function render() {
    var h = host();
    if (!h) return;
    var old = h.querySelector('.acct-ctl');
    if (old) old.remove();
    var el = document.createElement('span');
    el.className = 'acct-ctl';
    if (!A.user) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'acct-btn';
      b.textContent = 'Sign in';
      b.title = 'Sign in with Google to sync your progress across devices';
      b.addEventListener('click', function () { A.signIn(); });
      el.appendChild(b);
    } else {
      var a = document.createElement('a');
      a.className = 'acct-btn is-in';
      a.href = BASE + 'account.html';
      var name = (A.profile && A.profile.display_name) ||
        (A.user.user_metadata && A.user.user_metadata.full_name) || A.user.email || 'Account';
      a.textContent = String(name).trim().split(/\s+/).map(function (w) { return w[0]; }).slice(0, 2).join('').toUpperCase() || 'Me';
      a.title = name + ' — account and sync';
      el.appendChild(a);
    }
    h.appendChild(el);
  }

  A.ready = (function () {
    if (!A.enabled) return Promise.resolve(null);
    return loadScript(SUPABASE_JS).then(function () {
      A.client = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey);
      return A.client.auth.getSession().then(function (r) {
        A.user = (r.data.session && r.data.session.user) || null;
        var p = A.user
          ? A.client.from('profiles').select('*').eq('id', A.user.id).maybeSingle()
              .then(function (q) { A.profile = q.data || null; })
          : Promise.resolve();
        return p.then(function () {
          render(); emit();
          A.client.auth.onAuthStateChange(function (_event, session) {
            var was = A.user && A.user.id;
            A.user = (session && session.user) || null;
            if ((A.user && A.user.id) !== was) {
              if (A.user) {
                A.client.from('profiles').select('*').eq('id', A.user.id).maybeSingle()
                  .then(function (q) { A.profile = q.data || null; render(); });
              } else { A.profile = null; }
              render(); emit();
            }
          });
          return A.client;
        });
      });
    }).catch(function () { return null; });
  })();
})();
