/* The Companion: the grading maths, shared by the grade calculator
   (assets/calculator.js) and My Term's reverse calculator (assets/my-term.js).
   Formulas come from data/grading.json, written by hand from the official
   grading document; see the disclaimer on calculator.html. */
(function () {
  'use strict';

  function compile(expr, names) {
    return new Function(names.join(','), 'max', 'min', 'return (' + expr + ');');
  }

  function run(fn, names, vals) {
    var args = names.map(function (n) { return vals[n] || 0; });
    return fn.apply(null, args.concat([Math.max, Math.min]));
  }

  /* the letter grade for a score T, given the bands and fail from grading.json */
  function gradeFor(bands, fail, t) {
    for (var i = 0; i < bands.length; i++) { if (t >= bands[i].min) return bands[i]; }
    return { grade: fail.grade, gp: fail.gp };
  }

  /* the id of the end-term input of a course ("F" by convention); for courses with no end-term exam, the last scored input (a viva, say) */
  function endTermId(course) {
    var ids = course.inputs.map(function (i) { return i.id; });
    if (ids.indexOf('F') >= 0) return 'F';
    var byLabel = course.inputs.filter(function (i) { return /end\s*term/i.test(i.label || ''); })[0];
    if (byLabel) return byLabel.id;
    /* lab / viva courses have no end-term exam: solve for the last scored input instead */
    var scored = course.inputs.filter(function (i) { return !i.bonus; });
    return scored.length ? scored[scored.length - 1].id : null;
  }

  /* Reverse solver: the lowest end-term score that reaches `target` (a band's
     min), with every other input fixed at `vals` and bonus inputs at 0.
     Returns a number (0 means already secured), or null if even a full-marks
     end term cannot reach it. Binary search: every formula in grading.json is
     non-decreasing in F (all weights are positive). */
  function neededFinal(course, vals, target, endId) {
    endId = endId || endTermId(course);
    if (!endId) return null;
    var names = course.inputs.map(function (i) { return i.id; });
    var fn;
    try { fn = course._fn || compile(course.formula, names); } catch (e) { return null; }
    var endInput = course.inputs.filter(function (i) { return i.id === endId; })[0];
    var maxF = (endInput && endInput.max) || 100;
    var base = {};
    course.inputs.forEach(function (inp) {
      base[inp.id] = inp.bonus ? 0 : (vals[inp.id] || 0);
    });
    function t(f) { var v = {}; names.forEach(function (n) { v[n] = base[n]; }); v[endId] = f; return run(fn, names, v); }
    if (t(maxF) < target) return null;          /* not reachable */
    if (t(0) >= target) return 0;               /* already secured */
    var lo = 0, hi = maxF;
    for (var i = 0; i < 40; i++) {
      var mid = (lo + hi) / 2;
      if (t(mid) >= target) hi = mid; else lo = mid;
    }
    return Math.min(maxF, Math.ceil(hi * 100) / 100);
  }

  window.GradingEngine = {
    compile: compile, run: run, gradeFor: gradeFor,
    endTermId: endTermId, neededFinal: neededFinal
  };
})();
