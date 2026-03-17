setTimeout(() => {
  const isHidden = document.querySelector('.site-header-shell').classList.contains('is-hidden');
  const height = document.querySelector('.site-header-shell').offsetHeight;
  const navHeight = document.querySelector('.main-nav').offsetHeight;
  console.log("Shell is hidden:", isHidden);
  console.log("Shell total height:", height);
  console.log("Nav total height:", navHeight);
}, 500);
