/* The Companion: "Suggest a resource" / "Report a broken link" on course
   pages. Signed in (assets/account.js), submissions go into the suggestions
   queue for a moderator; signed out, the buttons fall back to a pre-filled
   GitHub issue so nobody is forced to make an account. */
(function () {
  'use strict';
  var COURSE = window.COURSE || {};
  var CFG = window.COMPANION_CONFIG || {};
  var A = window.CompanionAuth;
  var host = document.querySelector('#resources h2');
  if (!host || !COURSE.code) return;

  var gh = CFG.github || {};
  var repoUrl = gh.owner && gh.repo ? 'https://github.com/' + gh.owner + '/' + gh.repo : '';

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  /* buttons on the Resources heading */
  var row = el('span', 'sug-row');
  row.style.cssText = 'margin-left:auto;display:inline-flex;gap:8px;font-family:"IBM Plex Sans",sans-serif';
  var bSuggest = el('button', 'sb-chip', 'Suggest a resource');
  var bBroken = el('button', 'sb-chip', 'Report a broken link');
  bSuggest.type = bBroken.type = 'button';
  row.appendChild(bSuggest); row.appendChild(bBroken);
  host.appendChild(row);

  var form = null;

  function closeForm() { if (form) { form.remove(); form = null; } }

  function field(label, input) {
    var w = el('label', 'calc-field');
    w.style.cssText = 'display:flex;flex-direction:column;gap:3px;margin:0 0 9px';
    var l = el('span', 'cf-label', label);
    l.style.cssText = 'font:600 12.5px "IBM Plex Sans",sans-serif;color:var(--ink)';
    w.appendChild(l);
    w.appendChild(input);
    return w;
  }
  function text(placeholder) {
    var i = document.createElement('input');
    i.type = 'text'; i.placeholder = placeholder || ''; i.autocomplete = 'off';
    i.style.cssText = 'width:100%;box-sizing:border-box;padding:6px 10px;border:1px solid var(--rule);border-radius:8px;background:var(--paper);color:var(--ink);font:500 13.5px "IBM Plex Sans",sans-serif';
    return i;
  }

  function openForm(kind) {
    closeForm();
    form = el('div', 'sug-form');
    form.style.cssText = 'margin:8px 0 12px;padding:12px 14px;border:1px solid var(--rule);border-radius:12px;background:var(--paper-2);max-width:560px;font-family:"IBM Plex Sans",sans-serif;font-weight:400';
    form.appendChild(el('h3', null, kind === 'new_resource' ? 'Suggest a resource for ' + COURSE.code : 'Report a broken link in ' + COURSE.code));

    var fUrl = text('https://…');
    var fLabel = text(kind === 'new_resource' ? 'What is it? e.g. "Topic-wise notes"' : 'Which link is broken?');
    var fDesc = text(kind === 'new_resource' ? 'One line on why it helps (optional)' : 'What happens when you open it? (optional)');
    var fBy = text('Who made it? (optional)');
    var fGroup = document.createElement('select');
    fGroup.style.cssText = 'width:100%;box-sizing:border-box;padding:6px 10px;border:1px solid var(--rule);border-radius:8px;background:var(--paper);color:var(--ink);font:500 13.5px "IBM Plex Sans",sans-serif';
    ['Notes', 'Previous year questions', 'Course material', 'Practice', 'Other'].forEach(function (g) {
      var o = document.createElement('option'); o.value = o.textContent = g; fGroup.appendChild(o);
    });

    form.appendChild(field('Link', fUrl));
    form.appendChild(field(kind === 'new_resource' ? 'Label' : 'Which resource', fLabel));
    form.appendChild(field('Details', fDesc));
    if (kind === 'new_resource') {
      form.appendChild(field('Made by', fBy));
      form.appendChild(field('Where it belongs', fGroup));
    }

    var msg = el('p', 'acct-note', '');
    msg.style.cssText = 'margin:10px 0 0;font:400 12.5px/1.5 "IBM Plex Sans",sans-serif;color:var(--ink-2)';
    var actions = el('div', null);
    actions.style.cssText = 'display:flex;gap:10px;margin-top:10px;flex-wrap:wrap';
    var send = el('button', 'sb-chip', 'Send for review');
    send.type = 'button';
    var cancel = el('button', 'sb-link', 'Cancel');
    cancel.type = 'button';
    cancel.addEventListener('click', closeForm);
    actions.appendChild(send); actions.appendChild(cancel);
    form.appendChild(actions);
    form.appendChild(msg);

    var signedIn = A && A.enabled && A.user;
    if (!signedIn) {
      send.textContent = repoUrl ? 'Open a pre-filled GitHub issue' : 'Sign in to send';
      msg.textContent = A && A.enabled
        ? 'You are not signed in. Sign in (top of the sidebar) to send this straight to the review queue, or use GitHub.'
        : '';
    }

    send.addEventListener('click', function () {
      var payload = {
        url: fUrl.value.trim(), label: fLabel.value.trim(),
        desc: fDesc.value.trim()
      };
      if (kind === 'new_resource') { payload.by = fBy.value.trim(); payload.group = fGroup.value; }
      if (kind === 'new_resource' && !/^https?:\/\//.test(payload.url)) { msg.textContent = 'The link must start with http(s)://'; return; }
      if (!payload.label && !payload.url) { msg.textContent = 'Say which link this is about.'; return; }

      if (A && A.enabled && A.user && A.client) {
        send.disabled = true;
        A.client.from('suggestions').insert({
          user_id: A.user.id, course_code: COURSE.code, kind: kind, payload: payload
        }).then(function (r) {
          if (r.error) { msg.textContent = 'Could not send: ' + r.error.message; send.disabled = false; return; }
          form.innerHTML = '';
          form.appendChild(el('p', null, 'Sent. A moderator will look at it — thank you!'));
        });
      } else if (repoUrl) {
        var title = (kind === 'new_resource' ? 'Resource suggestion for ' : 'Broken link in ') +
          COURSE.code + ': ' + (payload.label || payload.url);
        var body = 'Course: ' + COURSE.code + '\nKind: ' + kind + '\n\n' +
          Object.keys(payload).map(function (k) { return payload[k] ? '- **' + k + ':** ' + payload[k] : ''; })
            .filter(Boolean).join('\n');
        window.open(repoUrl + '/issues/new?title=' + encodeURIComponent(title) + '&body=' + encodeURIComponent(body), '_blank', 'noopener');
        closeForm();
      } else if (A && A.enabled) {
        A.signIn();
      }
    });

    host.parentElement.insertBefore(form, host.nextSibling);
    fUrl.focus();
  }

  bSuggest.addEventListener('click', function () { openForm('new_resource'); });
  bBroken.addEventListener('click', function () { openForm('broken_link'); });
})();
