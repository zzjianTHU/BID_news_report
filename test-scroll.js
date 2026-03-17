window.scrollTo({ top: 500, behavior: 'smooth' });
setTimeout(() => {
  const header = document.querySelector('.site-header-shell');
  console.log('Hidden class applied:', header.classList.contains('is-hidden'));
  console.log('Header transform:', window.getComputedStyle(header).transform);
}, 1000);
