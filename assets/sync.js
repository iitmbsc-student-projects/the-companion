/* The Companion: cross-device sync for watched lectures, My Term enrollments
   and saved marks. Signed out (or with no server configured) everything stays
   in localStorage exactly as before; signed in, localStorage remains the
   source the pages read, and this file mirrors it to Supabase:

   - first sign-in on a device: local progress is merged UP (union of watched
     lectures — nothing is ever un-watched by a merge);
   - on every page load: server progress is pulled and merged DOWN;
   - on every change: course.js calls CompanionSync.push(code, prog).

   Exposes window.CompanionSync:
     push(code, prog)                    write-through for one course
     getEnrollments(term) -> Promise     ['CS1001', ...]
     setEnrollments(term, codes)
     getScores(term, code) -> Promise    {Qz1: 50, ...} or null
     setScores(term, code, inputs)
*/
(function () {
  'use strict';
  var A = window.CompanionAuth;
  var PFX = 'companion-progress-';

  function lsGet(k, d) {
    try { var v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; }
  }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  /* shadow: the server's lecture keys per course, so push() only sends diffs */
  var shadow = {};
  var pushTimers = {};

  function allLocalProgress() {
    var out = {};
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf(PFX) === 0) {
          var p = lsGet(k, null);
          if (p && p.done) out[k.slice(PFX.length)] = Object.keys(p.done);
        }
      }
    } catch (e) {}
    return out;
  }

  function pullAll(client, uid) {
    return client.from('lecture_progress').select('course_code, lecture_key')
      .then(function (q) {
        (q.data || []).forEach(function (r) {
          (shadow[r.course_code] = shadow[r.course_code] || {})[r.lecture_key] = 1;
        });
        /* merge DOWN into localStorage (union) */
        Object.keys(shadow).forEach(function (code) {
          var k = PFX + code;
          var p = lsGet(k, { done: {}, last: null });
          if (!p.done) p.done = {};
          var changed = false;
          Object.keys(shadow[code]).forEach(function (key) {
            if (!p.done[key]) { p.done[key] = 1; changed = true; }
          });
          if (changed) lsSet(k, p);
        });
      });
  }

  function mergeUpOnce(client, uid) {
    var flag = 'companion-synced-' + uid;
    try { if (localStorage.getItem(flag)) return Promise.resolve(); } catch (e) {}
    var local = allLocalProgress();
    var rows = [];
    Object.keys(local).forEach(function (code) {
      local[code].forEach(function (key) {
        if (!(shadow[code] && shadow[code][key])) {
          rows.push({ user_id: uid, course_code: code, lecture_key: key });
        }
      });
    });
    var done = rows.length
      ? client.from('lecture_progress').upsert(rows, { onConflict: 'user_id,course_code,lecture_key', ignoreDuplicates: true })
      : Promise.resolve();
    return Promise.resolve(done).then(function () {
      rows.forEach(function (r) { (shadow[r.course_code] = shadow[r.course_code] || {})[r.lecture_key] = 1; });
      try { localStorage.setItem(flag, '1'); } catch (e) {}
    });
  }

  var S = window.CompanionSync = {
    /* write-through, debounced: course.js calls this from saveProg() */
    push: function (code, prog) {
      if (!A || !A.client || !A.user) return;
      clearTimeout(pushTimers[code]);
      var doneNow = {};
      Object.keys((prog && prog.done) || {}).forEach(function (k) { doneNow[k] = 1; });
      pushTimers[code] = setTimeout(function () {
        var uid = A.user && A.user.id;
        if (!uid) return;
        var sv = shadow[code] || {};
        var added = Object.keys(doneNow).filter(function (k) { return !sv[k]; });
        var removed = Object.keys(sv).filter(function (k) { return !doneNow[k]; });
        var ops = [];
        if (added.length) {
          ops.push(A.client.from('lecture_progress').upsert(
            added.map(function (k) { return { user_id: uid, course_code: code, lecture_key: k }; }),
            { onConflict: 'user_id,course_code,lecture_key', ignoreDuplicates: true }));
        }
        if (removed.length) {
          ops.push(A.client.from('lecture_progress').delete()
            .eq('course_code', code).in('lecture_key', removed));
        }
        Promise.all(ops).then(function () { shadow[code] = doneNow; }).catch(function () {});
      }, 1500);
    },

    getEnrollments: function (term) {
      var localKey = 'companion-enroll-' + term;
      if (!A || !A.client || !A.user) return Promise.resolve(lsGet(localKey, []));
      return A.client.from('enrollments').select('course_code').eq('term', term)
        .then(function (q) {
          var codes = (q.data || []).map(function (r) { return r.course_code; });
          if (codes.length) { lsSet(localKey, codes); return codes; }
          /* nothing on the server yet: adopt what this browser had */
          var local = lsGet(localKey, []);
          if (local.length) return S.setEnrollments(term, local).then(function () { return local; });
          return codes;
        });
    },
    setEnrollments: function (term, codes) {
      var localKey = 'companion-enroll-' + term;
      lsSet(localKey, codes);
      if (!A || !A.client || !A.user) return Promise.resolve();
      var uid = A.user.id;
      return A.client.from('enrollments').delete().eq('term', term)
        .then(function () {
          if (!codes.length) return;
          return A.client.from('enrollments').insert(codes.map(function (c) {
            return { user_id: uid, term: term, course_code: c };
          }));
        }).catch(function () {});
    },

    getScores: function (term, code) {
      var localKey = 'companion-scores-' + term + '-' + code;
      if (!A || !A.client || !A.user) return Promise.resolve(lsGet(localKey, null));
      return A.client.from('scores').select('inputs').eq('term', term).eq('course_code', code).maybeSingle()
        .then(function (q) {
          if (q.data && q.data.inputs) { lsSet(localKey, q.data.inputs); return q.data.inputs; }
          return lsGet(localKey, null);
        });
    },
    getDegreePlan: function () {
      var local = lsGet('companion-degree-plan', null);
      if (!A || !A.client || !A.user) return Promise.resolve(local);
      return A.client.from('degree_plans').select('track, nptel, apprenticeship, grades').maybeSingle()
        .then(function (q) {
          var row = q.data;
          if (row && row.grades && Object.keys(row.grades).length) {
            var plan = {
              grades: row.grades, track: row.track || 'ba',
              nptel: row.nptel || 0, apprenticeship: row.apprenticeship || 0
            };
            lsSet('companion-degree-plan', plan);
            return plan;
          }
          if (local && local.grades && Object.keys(local.grades).length) {
            return S.setDegreePlan(local).then(function () { return local; });
          }
          return row ? {
            grades: row.grades || {}, track: row.track || 'ba',
            nptel: row.nptel || 0, apprenticeship: row.apprenticeship || 0
          } : local;
        });
    },
    setDegreePlan: function (plan) {
      lsSet('companion-degree-plan', plan);
      if (!A || !A.client || !A.user) return Promise.resolve();
      return A.client.from('degree_plans').upsert({
        user_id: A.user.id,
        track: plan.track === 'dl' ? 'dl' : 'ba',
        nptel: Math.max(0, Math.min(8, plan.nptel || 0)),
        apprenticeship: Math.max(0, Math.min(12, plan.apprenticeship || 0)),
        grades: plan.grades || {},
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' }).catch(function () {});
    },

    setScores: function (term, code, inputs) {
      var localKey = 'companion-scores-' + term + '-' + code;
      lsSet(localKey, inputs);
      if (!A || !A.client || !A.user) return Promise.resolve();
      return A.client.from('scores').upsert({
        user_id: A.user.id, term: term, course_code: code,
        inputs: inputs, updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,term,course_code' }).catch(function () {});
    },

    /* resolves once the initial pull + first-time merge is done (or at once
       when signed out); pages that render progress may re-render after it */
    ready: Promise.resolve()
  };

  if (A && A.enabled) {
    S.ready = A.ready.then(function (client) {
      if (!client || !A.user) return;
      var uid = A.user.id;
      return pullAll(client, uid)
        .then(function () { return mergeUpOnce(client, uid); })
        .then(function () {
          /* mirror this term's enrollments into localStorage for the home card */
          var t = window.TERM_SYLLABUS && window.TERM_SYLLABUS.term;
          if (t) return S.getEnrollments(t);
        })
        .then(function () {
          try { document.dispatchEvent(new CustomEvent('companion-sync-ready')); } catch (e) {}
        });
    }).catch(function () {});
  }
})();
