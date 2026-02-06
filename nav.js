// nav.js — toggles navigation on small screens
(function(){
  function initNav(){
    const navLinks = document.getElementById('navLinks');
    const toggle = document.getElementById('navToggle');
    const hamburger = document.getElementById('hamburger');

    function toggleMenu(){
      if(toggle) toggle.classList.toggle('active');
      if(hamburger) hamburger.classList.toggle('active');
      if(navLinks) navLinks.classList.toggle('active');
    }

    if(toggle) toggle.addEventListener('click', toggleMenu);
    if(hamburger) hamburger.addEventListener('click', toggleMenu);

    // Close when clicking nav link
    document.querySelectorAll('.nav-link').forEach(link => link.addEventListener('click', ()=>{
      if(toggle) toggle.classList.remove('active');
      if(hamburger) hamburger.classList.remove('active');
      if(navLinks) navLinks.classList.remove('active');
    }));

    // Close when clicking outside
    document.addEventListener('click', (e)=>{
      const container = e.target.closest('.nav-container');
      if(!container){
        if(toggle) toggle.classList.remove('active');
        if(hamburger) hamburger.classList.remove('active');
        if(navLinks) navLinks.classList.remove('active');
      }
    });
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initNav);
  else initNav();
})();
