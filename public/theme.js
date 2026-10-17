/* Applies the saved theme before the page paints. Only this light/dark preference is stored in the browser. */
(function(){try{var t=localStorage.getItem('mb_theme');if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t)}catch(e){}})();
