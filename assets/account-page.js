/* The Companion: account.html behaviour (sign in / out, export, delete). */
(function () {
  'use strict';
  var A = window.CompanionAuth;
  var $ = function (id) { return document.getElementById(id); };
  var off = $('acct-off'), signin = $('acct-signin'), me = $('acct-me'), data = $('acct-data');

  if (!A || !A.enabled) { if (off) off.hidden = false; return; }

  function show(user) {
    signin.hidden = !!user;
    me.hidden = !user;
    data.hidden = !user;
    if (user) {
      var name = (A.profile && A.profile.display_name) ||
        (user.user_metadata && user.user_metadata.full_name) || '';
      $('acct-who').textContent = (name ? name + ' — ' : '') + (user.email || '');
      $('acct-badge').hidden = !(A.profile && A.profile.is_iitm);
    }
  }
  A.ready.then(function () { A.onChange(show); });

  $('acct-do-signin').addEventListener('click', function () { A.signIn(); });
  $('acct-signout').addEventListener('click', function () { A.signOut(); });

  function msg(t) { $('acct-msg').textContent = t; }

  $('acct-download').addEventListener('click', function () {
    if (!A.client || !A.user) return;
    msg('Collecting your data…');
    Promise.all([
      A.client.from('profiles').select('*').eq('id', A.user.id),
      A.client.from('enrollments').select('*'),
      A.client.from('lecture_progress').select('*'),
      A.client.from('scores').select('*'),
      A.client.from('suggestions').select('*').eq('user_id', A.user.id),
      A.client.from('degree_plans').select('*').maybeSingle()
    ]).then(function (r) {
      var blob = new Blob([JSON.stringify({
        exported_at: new Date().toISOString(),
        profile: r[0].data, enrollments: r[1].data,
        lecture_progress: r[2].data, scores: r[3].data, suggestions: r[4].data,
        degree_plan: r[5].data
      }, null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'companion-data.json';
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(a.href);
      msg('Downloaded.');
    }).catch(function () { msg('Could not collect your data. Try again.'); });
  });

  var sure = false, sureTimer;
  $('acct-delete').addEventListener('click', function () {
    if (!A.client || !A.user) return;
    if (!sure) {
      sure = true;
      $('acct-delete').textContent = 'Click again to delete everything';
      msg('This removes your account and all synced data. There is no undo.');
      sureTimer = setTimeout(function () {
        sure = false; $('acct-delete').textContent = 'Delete my account'; msg('');
      }, 6000);
      return;
    }
    clearTimeout(sureTimer);
    msg('Deleting…');
    A.client.rpc('delete_my_account').then(function (r) {
      if (r.error) { msg('Could not delete: ' + r.error.message); return; }
      try {
        Object.keys(localStorage).forEach(function (k) {
          if (k.indexOf('companion-synced-') === 0) localStorage.removeItem(k);
        });
      } catch (e) {}
      A.client.auth.signOut().then(function () { location.href = 'index.html'; });
    });
  });
})();
