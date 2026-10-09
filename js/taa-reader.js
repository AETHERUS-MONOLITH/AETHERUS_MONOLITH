(function () {
  'use strict';

  // Reading aids for the TAA page. Everything here is additive: without script the page is a plain document.
  var manuscript = document.querySelector('.manuscript');
  if (!manuscript) return;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  // 1. A collapsed Changelog opens when the visitor follows a link to it or to something inside it.
  function openForHash() {
    if (!location.hash) return;
    var target;
    try { target = document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch (e) { return; }
    var details = target && target.closest('details');
    if (details && !details.open) {
      details.open = true;
      target.scrollIntoView({ block: 'start' });
    }
  }
  window.addEventListener('hashchange', openForHash);
  openForHash();

  // 2. "On this page": the top-level entries of the existing Table of Contents, with scroll-spy.
  var toc = manuscript.querySelector('nav[aria-labelledby="table-of-contents"] > ol');
  if (toc) {
    var links = Array.prototype.slice.call(toc.children).map(function (li) {
      return li.querySelector(':scope > a');
    }).filter(Boolean);

    var rail = document.createElement('nav');
    rail.className = 'toc-rail';
    rail.setAttribute('aria-label', 'On this page');
    var heading = document.createElement('h2');
    heading.textContent = 'On this page';
    var list = document.createElement('ol');
    var entries = [];

    links.forEach(function (source) {
      var id = (source.getAttribute('href') || '').replace(/^#/, '');
      var section = id && document.getElementById(id);
      if (!section) return;
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = '#' + id;
      a.textContent = source.textContent;
      li.appendChild(a);
      list.appendChild(li);
      entries.push({ id: id, el: section, link: a });
    });

    if (entries.length) {
      rail.appendChild(heading);
      rail.appendChild(list);
      manuscript.insertBefore(rail, manuscript.firstChild);
      manuscript.classList.add('has-rail');

      var current = null;
      var ticking = false;
      var setCurrent = function (entry) {
        if (entry === current) return;
        if (current) current.link.removeAttribute('aria-current');
        current = entry;
        if (current) {
          current.link.setAttribute('aria-current', 'location');
          var box = rail.getBoundingClientRect();
          var item = current.link.getBoundingClientRect();
          if (item.top < box.top || item.bottom > box.bottom) {
            current.link.scrollIntoView({ block: 'nearest' });
          }
        }
      };
      var update = function () {
        ticking = false;
        var line = window.innerHeight * 0.25;
        var active = null;
        for (var i = 0; i < entries.length; i++) {
          if (entries[i].el.getBoundingClientRect().top <= line) active = entries[i];
          else break;
        }
        setCurrent(active);
      };
      var onScroll = function () {
        if (!ticking) { ticking = true; requestAnimationFrame(update); }
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll);
      update();
    }
  }

  // 3. A quiet way back to the top once the visitor is well into the manuscript.
  var top = document.createElement('a');
  top.className = 'to-top';
  top.href = '#top';
  top.textContent = 'Back to top';
  document.body.appendChild(top);
  top.addEventListener('click', function (event) {
    event.preventDefault();
    window.scrollTo({ top: 0, behavior: reduced.matches ? 'auto' : 'smooth' });
    var link = document.querySelector('.site-link');
    if (link) link.focus({ preventScroll: true });
  });
  var toggle = function () { top.classList.toggle('is-visible', window.scrollY > window.innerHeight * 1.5); };
  window.addEventListener('scroll', toggle, { passive: true });
  toggle();
})();
