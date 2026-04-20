(function () {
  var reduced =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function markVisible(el) {
    if (!el || el.classList.contains("is-visible")) return;
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        el.classList.add("is-visible");
      });
    });
  }

  var reveals = document.querySelectorAll(".reveal");
  if (!reveals.length) return;

  if (reduced) {
    reveals.forEach(markVisible);
    return;
  }

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          markVisible(entry.target);
          observer.unobserve(entry.target);
        }
      });
    },
    { rootMargin: "0px 0px -5% 0px", threshold: 0 }
  );

  reveals.forEach(function (el) {
    observer.observe(el);
  });
})();
