/* The Companion: moderation queue (moderate.html). Moderators review
   community suggestions. "Approve" calls the approve-suggestion Edge Function
   (which re-checks the role server-side and opens the GitHub PR or issue);
   "Reject" is a plain status update allowed by RLS for moderators. */
(function () {
  'use strict';
  var A = window.CompanionAuth;
  var CFG = window.COMPANION_CONFIG || {};
  var $ = function (id) { return document.getElementById(id); };
  var gate = $('mod-gate'), ui = $('mod-ui'), listEl = $('mod-list'), empty = $('mod-empty');

  if (!A || !A.enabled) { gate.textContent = 'No server is configured for this copy of the site.'; return; }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  A.ready.then(function () {
    if (!A.user) {
      gate.textContent = '';
      var b = el('button', 'cta-btn', 'Sign in');
      b.type = 'button';
      b.addEventListener('click', function () { A.signIn(); });
      gate.appendChild(document.createTextNode('Moderators only. '));
      gate.appendChild(b);
      return;
    }
    if (!A.profile || (A.profile.role !== 'moderator' && A.profile.role !== 'admin')) {
      gate.textContent = 'Your account is not a moderator. If it should be, ask an admin.';
      return;
    }
    gate.hidden = true;
    ui.hidden = false;
    load();
  });

  function load() {
    var status = $('mod-status').value;
    var course = $('mod-course').value.trim().toUpperCase();
    var q = A.client.from('suggestions')
      .select('*, profiles!suggestions_user_id_fkey(display_name, is_iitm)')
      .order('created_at', { ascending: false }).limit(100);
    if (status) q = q.eq('status', status);
    if (course) q = q.eq('course_code', course);
    q.then(function (r) {
      listEl.textContent = '';
      var rows = r.data || [];
      empty.hidden = rows.length > 0;
      rows.forEach(function (s) { listEl.appendChild(item(s)); });
    });
  }
  $('mod-status').addEventListener('change', load);
  $('mod-course').addEventListener('input', function () { clearTimeout(this._t); this._t = setTimeout(load, 300); });

  function item(s) {
    var p = s.payload || {};
    var box = el('div', 'mod-item');
    var head = el('div', 'mod-head');
    head.appendChild(el('span', 'mod-kind', s.kind.replace('_', ' ')));
    head.appendChild(el('b', null, s.course_code));
    var who = s.profiles || {};
    head.appendChild(el('span', 'mod-note', (who.display_name || 'someone') + ' · ' + new Date(s.created_at).toLocaleDateString()));
    if (who.is_iitm) head.appendChild(el('span', 'mod-badge', 'IITM verified'));
    head.appendChild(el('span', 'mod-note', s.status));
    box.appendChild(head);

    var body = el('div', 'mod-body');
    if (p.label) body.appendChild(el('div', null, p.label + (p.group ? '  ·  ' + p.group : '')));
    if (p.url) {
      var a = document.createElement('a');
      a.href = p.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = p.url;
      body.appendChild(a);
    }
    if (p.desc) body.appendChild(el('div', 'mod-note', p.desc));
    if (p.by) body.appendChild(el('div', 'mod-note', 'By ' + p.by));
    box.appendChild(body);

    if (s.pr_url) {
      var pr = document.createElement('a');
      pr.href = s.pr_url; pr.target = '_blank'; pr.rel = 'noopener'; pr.textContent = s.pr_url;
      box.appendChild(pr);
    }
    if (s.review_note) box.appendChild(el('div', 'mod-note', 'Review note: ' + s.review_note));

    if (s.status === 'pending') {
      var row = el('div', 'mod-row');
      var ok = el('button', 'sb-chip', s.kind === 'new_resource' ? 'Approve → open PR' : 'Approve → open issue');
      var no = el('button', 'sb-link', 'Reject');
      ok.type = no.type = 'button';
      var msg = el('span', 'mod-note', '');
      ok.addEventListener('click', function () {
        ok.disabled = no.disabled = true;
        msg.textContent = 'Working…';
        A.client.auth.getSession().then(function (r) {
          var token = r.data.session && r.data.session.access_token;
          return fetch(CFG.supabaseUrl + '/functions/v1/approve-suggestion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
            body: JSON.stringify({ id: s.id })
          });
        }).then(function (res) { return res.json(); }).then(function (j) {
          if (j.ok) { msg.textContent = 'Done.'; load(); }
          else { msg.textContent = j.error || 'Failed.'; ok.disabled = no.disabled = false; }
        }).catch(function () { msg.textContent = 'Network error.'; ok.disabled = no.disabled = false; });
      });
      no.addEventListener('click', function () {
        var note = prompt('Why is this rejected? (shown to the author)') || '';
        ok.disabled = no.disabled = true;
        A.client.from('suggestions').update({
          status: 'rejected', reviewer_id: A.user.id, review_note: note.slice(0, 500)
        }).eq('id', s.id).then(function (r) {
          if (r.error) { msg.textContent = r.error.message; ok.disabled = no.disabled = false; }
          else load();
        });
      });
      row.appendChild(ok); row.appendChild(no); row.appendChild(msg);
      box.appendChild(row);
    }
    return box;
  }
})();
