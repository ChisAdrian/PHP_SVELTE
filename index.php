<script>
    const svelte_script = document.createElement('script');
    svelte_script.type = 'text/javascript';
    svelte_script.defer = true;
    svelte_script.src = '../PHP_SVELTE/public/build/bundle.js';
    document.head.appendChild(svelte_script);


    const svelte_compiled_stylesheet = document.createElement('link');
    svelte_compiled_stylesheet.rel = 'stylesheet';
    svelte_compiled_stylesheet.href = '../PHP_SVELTE/public/build/bundle.css';
    document.head.appendChild(svelte_compiled_stylesheet);

</script>

<div id="svelte-app"></div>