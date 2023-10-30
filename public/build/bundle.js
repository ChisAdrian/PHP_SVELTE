
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function validate_store(store, name) {
        if (store != null && typeof store.subscribe !== 'function') {
            throw new Error(`'${name}' is not a store with a 'subscribe' method`);
        }
    }
    function subscribe(store, ...callbacks) {
        if (store == null) {
            return noop;
        }
        const unsub = store.subscribe(...callbacks);
        return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
    }
    function component_subscribe(component, store, callback) {
        component.$$.on_destroy.push(subscribe(store, callback));
    }
    function set_store_value(store, ret, value) {
        store.set(value);
        return ret;
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        if (node.parentNode) {
            node.parentNode.removeChild(node);
        }
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function prevent_default(fn) {
        return function (event) {
            event.preventDefault();
            // @ts-ignore
            return fn.call(this, event);
        };
    }
    function stop_propagation(fn) {
        return function (event) {
            event.stopPropagation();
            // @ts-ignore
            return fn.call(this, event);
        };
    }
    function self(fn) {
        return function (event) {
            // @ts-ignore
            if (event.target === this)
                fn.call(this, event);
        };
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function set_style(node, key, value, important) {
        if (value == null) {
            node.style.removeProperty(key);
        }
        else {
            node.style.setProperty(key, value, important ? 'important' : '');
        }
    }
    function toggle_class(element, name, toggle) {
        element.classList[toggle ? 'add' : 'remove'](name);
    }
    function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, cancelable, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    /**
     * The `onMount` function schedules a callback to run as soon as the component has been mounted to the DOM.
     * It must be called during the component's initialisation (but doesn't need to live *inside* the component;
     * it can be called from an external module).
     *
     * `onMount` does not run inside a [server-side component](/docs#run-time-server-side-component-api).
     *
     * https://svelte.dev/docs#run-time-svelte-onmount
     */
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }
    // TODO figure out if we still want to support
    // shorthand events, or if we want to implement
    // a real bubbling mechanism
    function bubble(component, event) {
        const callbacks = component.$$.callbacks[event.type];
        if (callbacks) {
            // @ts-ignore
            callbacks.slice().forEach(fn => fn.call(this, event));
        }
    }

    const dirty_components = [];
    const binding_callbacks = [];
    let render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = /* @__PURE__ */ Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    function add_flush_callback(fn) {
        flush_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        // Do not reenter flush while dirty components are updated, as this can
        // result in an infinite loop. Instead, let the inner flush handle it.
        // Reentrancy is ok afterwards for bindings etc.
        if (flushidx !== 0) {
            return;
        }
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            try {
                while (flushidx < dirty_components.length) {
                    const component = dirty_components[flushidx];
                    flushidx++;
                    set_current_component(component);
                    update(component.$$);
                }
            }
            catch (e) {
                // reset dirty state to not end up in a deadlocked state and then rethrow
                dirty_components.length = 0;
                flushidx = 0;
                throw e;
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    /**
     * Useful for example to execute remaining `afterUpdate` callbacks before executing `destroy`.
     */
    function flush_render_callbacks(fns) {
        const filtered = [];
        const targets = [];
        render_callbacks.forEach((c) => fns.indexOf(c) === -1 ? filtered.push(c) : targets.push(c));
        targets.forEach((c) => c());
        render_callbacks = filtered;
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
        else if (callback) {
            callback();
        }
    }

    function bind(component, name, callback) {
        const index = component.$$.props[name];
        if (index !== undefined) {
            component.$$.bound[index] = callback;
            callback(component.$$.ctx[index]);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
                // if the component was destroyed immediately
                // it will update the `$$.on_destroy` reference to `null`.
                // the destructured on_destroy may still reference to the old array
                if (component.$$.on_destroy) {
                    component.$$.on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            flush_render_callbacks($$.after_update);
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: [],
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            if (!is_function(callback)) {
                return noop;
            }
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.59.2' }, detail), { bubbles: true }));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation, has_stop_immediate_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        if (has_stop_immediate_propagation)
            modifiers.push('stopImmediatePropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.data === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    const subscriber_queue = [];
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=} start
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = new Set();
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (const subscriber of subscribers) {
                        subscriber[1]();
                        subscriber_queue.push(subscriber, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i < subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.add(subscriber);
            if (subscribers.size === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                subscribers.delete(subscriber);
                if (subscribers.size === 0 && stop) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }

    //isLoggedIn: true for TESTING ONLY
    const userProfile = writable({ isLoggedIn: false, role: null , user : null , myPage : null});

    /* src\Login.svelte generated by Svelte v3.59.2 */
    const file$6 = "src\\Login.svelte";

    function create_fragment$6(ctx) {
    	let div1;
    	let center;
    	let div0;
    	let h3;
    	let t1;
    	let span0;
    	let t2;
    	let t3;
    	let form;
    	let input0;
    	let t4;
    	let input1;
    	let t5;
    	let button;
    	let t7;
    	let span1;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			center = element("center");
    			div0 = element("div");
    			h3 = element("h3");
    			h3.textContent = "Login";
    			t1 = space();
    			span0 = element("span");
    			t2 = text(/*messager*/ ctx[2]);
    			t3 = space();
    			form = element("form");
    			input0 = element("input");
    			t4 = space();
    			input1 = element("input");
    			t5 = space();
    			button = element("button");
    			button.textContent = "Login";
    			t7 = space();
    			span1 = element("span");
    			span1.textContent = "Please wait";
    			attr_dev(h3, "class", "svelte-toebkl");
    			add_location(h3, file$6, 54, 12, 1945);
    			set_style(span0, "background-color", "azure");
    			attr_dev(span0, "class", "svelte-toebkl");
    			add_location(span0, file$6, 55, 12, 1973);
    			attr_dev(input0, "type", "text");
    			attr_dev(input0, "name", "username");
    			attr_dev(input0, "placeholder", "Username");
    			attr_dev(input0, "id", "username");
    			input0.required = true;
    			attr_dev(input0, "class", "svelte-toebkl");
    			add_location(input0, file$6, 58, 16, 2109);
    			attr_dev(input1, "type", "password");
    			attr_dev(input1, "name", "password");
    			attr_dev(input1, "placeholder", "Password");
    			attr_dev(input1, "id", "password");
    			input1.required = true;
    			attr_dev(input1, "class", "svelte-toebkl");
    			add_location(input1, file$6, 67, 16, 2377);
    			attr_dev(button, "type", "submit");
    			button.value = "Login";
    			attr_dev(button, "class", "svelte-toebkl");
    			add_location(button, file$6, 76, 16, 2649);
    			attr_dev(form, "class", "svelte-toebkl");
    			add_location(form, file$6, 57, 12, 2045);
    			attr_dev(span1, "id", "wait");
    			attr_dev(span1, "class", "svelte-toebkl");
    			add_location(span1, file$6, 79, 12, 2737);
    			attr_dev(div0, "class", "login svelte-toebkl");
    			add_location(div0, file$6, 53, 8, 1912);
    			attr_dev(center, "class", "svelte-toebkl");
    			add_location(center, file$6, 52, 4, 1894);
    			attr_dev(div1, "class", "svelte-toebkl");
    			add_location(div1, file$6, 50, 0, 1848);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, center);
    			append_dev(center, div0);
    			append_dev(div0, h3);
    			append_dev(div0, t1);
    			append_dev(div0, span0);
    			append_dev(span0, t2);
    			append_dev(div0, t3);
    			append_dev(div0, form);
    			append_dev(form, input0);
    			set_input_value(input0, /*username*/ ctx[0]);
    			append_dev(form, t4);
    			append_dev(form, input1);
    			set_input_value(input1, /*password*/ ctx[1]);
    			append_dev(form, t5);
    			append_dev(form, button);
    			append_dev(div0, t7);
    			append_dev(div0, span1);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "input", /*input0_input_handler*/ ctx[4]),
    					listen_dev(input1, "input", /*input1_input_handler*/ ctx[5]),
    					listen_dev(form, "submit", prevent_default(/*handleSubmit*/ ctx[3]), false, true, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*messager*/ 4) set_data_dev(t2, /*messager*/ ctx[2]);

    			if (dirty & /*username*/ 1 && input0.value !== /*username*/ ctx[0]) {
    				set_input_value(input0, /*username*/ ctx[0]);
    			}

    			if (dirty & /*password*/ 2 && input1.value !== /*password*/ ctx[1]) {
    				set_input_value(input1, /*password*/ ctx[1]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$6.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$6($$self, $$props, $$invalidate) {
    	let $userProfile;
    	validate_store(userProfile, 'userProfile');
    	component_subscribe($$self, userProfile, $$value => $$invalidate(6, $userProfile = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Login', slots, []);
    	let username = "";
    	let password = "";
    	let messager = "";

    	async function handleSubmit() {
    		document.getElementById("wait").style.display = "block";
    		const data = { username, password };

    		try {
    			const response = await fetch("php_files/Login.php", {
    				method: "POST",
    				headers: { "Content-Type": "application/json" },
    				body: JSON.stringify(data)
    			});

    			if (response.ok) {
    				const jsonString = await response.text();

    				try {
    					const jsonData = JSON.parse(jsonString); // jsonString is the JSON data you want to parse

    					// You can work with the parsed JSON data here
    					if (jsonData.stat) {
    						set_store_value(userProfile, $userProfile.isLoggedIn = jsonData.stat, $userProfile);
    						set_store_value(userProfile, $userProfile.role = jsonData.role, $userProfile);
    						set_store_value(userProfile, $userProfile.user = jsonData.user, $userProfile);
    						if ($userProfile.myPage == null) set_store_value(userProfile, $userProfile.myPage = 'Home', $userProfile);
    					} else $$invalidate(2, messager = jsonData.message);
    				} catch(error) {
    					// Handle the parsing error here
    					$$invalidate(2, messager = jsonString); // !const jsonData = JSON.parse(jsonString);
    				}
    			} else {
    				$$invalidate(2, messager = jsonString); // !response.ok
    			}
    		} catch(error) {
    			$$invalidate(2, messager = error); //!  const response = await fetch("Login.php",
    		} finally {
    			document.getElementById("wait").style.display = "none";
    		}
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Login> was created with unknown prop '${key}'`);
    	});

    	function input0_input_handler() {
    		username = this.value;
    		$$invalidate(0, username);
    	}

    	function input1_input_handler() {
    		password = this.value;
    		$$invalidate(1, password);
    	}

    	$$self.$capture_state = () => ({
    		username,
    		password,
    		messager,
    		userProfile,
    		handleSubmit,
    		$userProfile
    	});

    	$$self.$inject_state = $$props => {
    		if ('username' in $$props) $$invalidate(0, username = $$props.username);
    		if ('password' in $$props) $$invalidate(1, password = $$props.password);
    		if ('messager' in $$props) $$invalidate(2, messager = $$props.messager);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		username,
    		password,
    		messager,
    		handleSubmit,
    		input0_input_handler,
    		input1_input_handler
    	];
    }

    class Login extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$6, create_fragment$6, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Login",
    			options,
    			id: create_fragment$6.name
    		});
    	}
    }

    /* src\Home.svelte generated by Svelte v3.59.2 */

    const file$5 = "src\\Home.svelte";

    function create_fragment$5(ctx) {
    	let h2;
    	let t0;
    	let br;
    	let t1;

    	const block = {
    		c: function create() {
    			h2 = element("h2");
    			t0 = text("Digital Life ");
    			br = element("br");
    			t1 = text(" Working Smarter, Not Harder");
    			add_location(br, file$5, 0, 18, 18);
    			add_location(h2, file$5, 0, 0, 0);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h2, anchor);
    			append_dev(h2, t0);
    			append_dev(h2, br);
    			append_dev(h2, t1);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$5.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$5($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Home', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Home> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class Home extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Home",
    			options,
    			id: create_fragment$5.name
    		});
    	}
    }

    /* src\JSTable.svelte generated by Svelte v3.59.2 */

    const file$4 = "src\\JSTable.svelte";

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[8] = list[i];
    	return child_ctx;
    }

    function get_each_context_1$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[11] = list[i];
    	return child_ctx;
    }

    function get_each_context_2$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[14] = list[i];
    	child_ctx[16] = i;
    	return child_ctx;
    }

    // (61:8) {#each headerArray as thh, i}
    function create_each_block_2$1(ctx) {
    	let th;
    	let t0_value = /*thh*/ ctx[14] + "";
    	let t0;
    	let t1;
    	let button0;
    	let t3;
    	let button1;
    	let t5;
    	let input;
    	let t6;
    	let mounted;
    	let dispose;

    	function click_handler() {
    		return /*click_handler*/ ctx[4](/*i*/ ctx[16]);
    	}

    	function click_handler_1() {
    		return /*click_handler_1*/ ctx[5](/*i*/ ctx[16]);
    	}

    	function input_handler() {
    		return /*input_handler*/ ctx[6](/*i*/ ctx[16]);
    	}

    	const block = {
    		c: function create() {
    			th = element("th");
    			t0 = text(t0_value);
    			t1 = space();
    			button0 = element("button");
    			button0.textContent = "↕";
    			t3 = space();
    			button1 = element("button");
    			button1.textContent = "🔍";
    			t5 = space();
    			input = element("input");
    			t6 = space();
    			set_style(button0, "font-size", "small");
    			attr_dev(button0, "class", "svelte-axu2pg");
    			toggle_class(button0, "active_class", /*i*/ ctx[16] === /*active_column*/ ctx[2]);
    			toggle_class(button0, "active-column", /*i*/ ctx[16] === /*active_column*/ ctx[2]);
    			add_location(button0, file$4, 64, 14, 1867);
    			set_style(button1, "font-size", "small");
    			add_location(button1, file$4, 68, 14, 2094);
    			attr_dev(input, "id", /*i*/ ctx[16]);
    			attr_dev(input, "class", "input-header svelte-axu2pg");
    			set_style(input, "display", "none");
    			attr_dev(input, "type", "text");
    			add_location(input, file$4, 70, 13, 2214);
    			add_location(th, file$4, 61, 10, 1816);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, th, anchor);
    			append_dev(th, t0);
    			append_dev(th, t1);
    			append_dev(th, button0);
    			append_dev(th, t3);
    			append_dev(th, button1);
    			append_dev(th, t5);
    			append_dev(th, input);
    			append_dev(th, t6);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", click_handler, false, false, false, false),
    					listen_dev(button1, "click", click_handler_1, false, false, false, false),
    					listen_dev(input, "input", input_handler, false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty & /*headerArray*/ 1 && t0_value !== (t0_value = /*thh*/ ctx[14] + "")) set_data_dev(t0, t0_value);

    			if (dirty & /*active_column*/ 4) {
    				toggle_class(button0, "active_class", /*i*/ ctx[16] === /*active_column*/ ctx[2]);
    			}

    			if (dirty & /*active_column*/ 4) {
    				toggle_class(button0, "active-column", /*i*/ ctx[16] === /*active_column*/ ctx[2]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(th);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_2$1.name,
    		type: "each",
    		source: "(61:8) {#each headerArray as thh, i}",
    		ctx
    	});

    	return block;
    }

    // (85:10) {#each trr as tcell}
    function create_each_block_1$1(ctx) {
    	let td;
    	let t_value = /*tcell*/ ctx[11] + "";
    	let t;

    	const block = {
    		c: function create() {
    			td = element("td");
    			t = text(t_value);
    			attr_dev(td, "class", "svelte-axu2pg");
    			add_location(td, file$4, 85, 12, 2607);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, td, anchor);
    			append_dev(td, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*bodyArray*/ 2 && t_value !== (t_value = /*tcell*/ ctx[11] + "")) set_data_dev(t, t_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(td);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_1$1.name,
    		type: "each",
    		source: "(85:10) {#each trr as tcell}",
    		ctx
    	});

    	return block;
    }

    // (83:6) {#each bodyArray as trr}
    function create_each_block$1(ctx) {
    	let tr;
    	let t;
    	let each_value_1 = /*trr*/ ctx[8];
    	validate_each_argument(each_value_1);
    	let each_blocks = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks[i] = create_each_block_1$1(get_each_context_1$1(ctx, each_value_1, i));
    	}

    	const block = {
    		c: function create() {
    			tr = element("tr");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t = space();
    			attr_dev(tr, "class", "data-row svelte-axu2pg");
    			add_location(tr, file$4, 83, 8, 2540);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, tr, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(tr, null);
    				}
    			}

    			append_dev(tr, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*bodyArray*/ 2) {
    				each_value_1 = /*trr*/ ctx[8];
    				validate_each_argument(each_value_1);
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1$1(ctx, each_value_1, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block_1$1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(tr, t);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value_1.length;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(tr);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$1.name,
    		type: "each",
    		source: "(83:6) {#each bodyArray as trr}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$4(ctx) {
    	let table;
    	let thead;
    	let tr;
    	let t;
    	let tbody;
    	let each_value_2 = /*headerArray*/ ctx[0];
    	validate_each_argument(each_value_2);
    	let each_blocks_1 = [];

    	for (let i = 0; i < each_value_2.length; i += 1) {
    		each_blocks_1[i] = create_each_block_2$1(get_each_context_2$1(ctx, each_value_2, i));
    	}

    	let each_value = /*bodyArray*/ ctx[1];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			table = element("table");
    			thead = element("thead");
    			tr = element("tr");

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].c();
    			}

    			t = space();
    			tbody = element("tbody");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			add_location(tr, file$4, 59, 6, 1761);
    			attr_dev(thead, "class", "sticky svelte-axu2pg");
    			add_location(thead, file$4, 58, 4, 1731);
    			attr_dev(tbody, "id", "id-tbody");
    			attr_dev(tbody, "class", "svelte-axu2pg");
    			add_location(tbody, file$4, 81, 4, 2477);
    			attr_dev(table, "class", "svelte-axu2pg");
    			add_location(table, file$4, 57, 2, 1718);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, table, anchor);
    			append_dev(table, thead);
    			append_dev(thead, tr);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				if (each_blocks_1[i]) {
    					each_blocks_1[i].m(tr, null);
    				}
    			}

    			append_dev(table, t);
    			append_dev(table, tbody);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(tbody, null);
    				}
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*filterTable, displaySearch, active_column, toggleSort, headerArray*/ 13) {
    				each_value_2 = /*headerArray*/ ctx[0];
    				validate_each_argument(each_value_2);
    				let i;

    				for (i = 0; i < each_value_2.length; i += 1) {
    					const child_ctx = get_each_context_2$1(ctx, each_value_2, i);

    					if (each_blocks_1[i]) {
    						each_blocks_1[i].p(child_ctx, dirty);
    					} else {
    						each_blocks_1[i] = create_each_block_2$1(child_ctx);
    						each_blocks_1[i].c();
    						each_blocks_1[i].m(tr, null);
    					}
    				}

    				for (; i < each_blocks_1.length; i += 1) {
    					each_blocks_1[i].d(1);
    				}

    				each_blocks_1.length = each_value_2.length;
    			}

    			if (dirty & /*bodyArray*/ 2) {
    				each_value = /*bodyArray*/ ctx[1];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$1(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(tbody, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(table);
    			destroy_each(each_blocks_1, detaching);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function filterTable(colnr) {
    	let input = document.getElementById(colnr).value.toUpperCase();
    	let rows = document.querySelectorAll('.data-row');
    	rows = Array.from(rows);

    	rows.forEach(row => {
    		const tableData = row.childNodes[colnr];
    		const txtValue = tableData.textContent || tableData.innerText;

    		if (txtValue.toUpperCase().includes(input)) {
    			row.style.display = '';
    		} else {
    			row.style.display = 'none';
    		}
    	});
    }

    function displaySearch(colid) {
    	let visibelStatus = document.getElementById(colid).style.display;

    	if (visibelStatus == 'none') {
    		document.getElementById(colid).style.display = 'block';
    	} else document.getElementById(colid).style.display = 'none'; // elem.target.classList.add('active-column')
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('JSTable', slots, []);
    	let { headerArray } = $$props;
    	let { bodyArray } = $$props;
    	let sortASC = true;
    	let active_column = 'inactive';

    	function toggleSort(col) {
    		sortASC = active_column === col ? !sortASC : true;
    		$$invalidate(2, active_column = col);
    		let rows = document.querySelectorAll('.data-row');
    		rows = Array.from(rows);

    		rows.sort((a, b) => {
    			const aVal = a.childNodes[col].textContent || a.childNodes[col].innerText;
    			const bVal = b.childNodes[col].textContent || b.childNodes[col].innerText;

    			return sortASC
    			? aVal.localeCompare(bVal)
    			: bVal.localeCompare(aVal);
    		});

    		const tbody = document.querySelector('#id-tbody');
    		tbody.innerHTML = '';
    		rows.forEach(row => tbody.appendChild(row));
    	}

    	$$self.$$.on_mount.push(function () {
    		if (headerArray === undefined && !('headerArray' in $$props || $$self.$$.bound[$$self.$$.props['headerArray']])) {
    			console.warn("<JSTable> was created without expected prop 'headerArray'");
    		}

    		if (bodyArray === undefined && !('bodyArray' in $$props || $$self.$$.bound[$$self.$$.props['bodyArray']])) {
    			console.warn("<JSTable> was created without expected prop 'bodyArray'");
    		}
    	});

    	const writable_props = ['headerArray', 'bodyArray'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<JSTable> was created with unknown prop '${key}'`);
    	});

    	const click_handler = i => toggleSort(i);
    	const click_handler_1 = i => displaySearch(i);
    	const input_handler = i => filterTable(i);

    	$$self.$$set = $$props => {
    		if ('headerArray' in $$props) $$invalidate(0, headerArray = $$props.headerArray);
    		if ('bodyArray' in $$props) $$invalidate(1, bodyArray = $$props.bodyArray);
    	};

    	$$self.$capture_state = () => ({
    		headerArray,
    		bodyArray,
    		sortASC,
    		active_column,
    		toggleSort,
    		filterTable,
    		displaySearch
    	});

    	$$self.$inject_state = $$props => {
    		if ('headerArray' in $$props) $$invalidate(0, headerArray = $$props.headerArray);
    		if ('bodyArray' in $$props) $$invalidate(1, bodyArray = $$props.bodyArray);
    		if ('sortASC' in $$props) sortASC = $$props.sortASC;
    		if ('active_column' in $$props) $$invalidate(2, active_column = $$props.active_column);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		headerArray,
    		bodyArray,
    		active_column,
    		toggleSort,
    		click_handler,
    		click_handler_1,
    		input_handler
    	];
    }

    class JSTable extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, { headerArray: 0, bodyArray: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "JSTable",
    			options,
    			id: create_fragment$4.name
    		});
    	}

    	get headerArray() {
    		throw new Error("<JSTable>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set headerArray(value) {
    		throw new Error("<JSTable>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get bodyArray() {
    		throw new Error("<JSTable>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set bodyArray(value) {
    		throw new Error("<JSTable>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    // fetchData.js

    async function fetchData(query) {
        const data = { query };
        try {
            const response = await fetch("php_files/read_query.php", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(data),
            });

            if (response.ok) {
                const jsonString = await response.text();

                try {
                    const jsonData = JSON.parse(jsonString);
                    if (jsonData.stat) {
                        const ajsTH = jsonData.Header;
                        const ajsTB = jsonData.Body;
                        return { ajsTH, ajsTB };
                    } else {
                        const messager = "jsonData.stat:" + jsonData.Header;
                        return { error: messager };
                    }
                } catch (error) {
                    const messager = "FAILED JSON:" + jsonString;
                    return { error: messager };
                }
            } else {
                return { error: jsonString };
            }
        } catch (error) {
            return { error };
        }
    }

    /* src\Editplanmanual.svelte generated by Svelte v3.59.2 */

    const file$3 = "src\\Editplanmanual.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[15] = list[i];
    	child_ctx[17] = i;
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[18] = list[i];
    	return child_ctx;
    }

    function get_each_context_2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[18] = list[i];
    	return child_ctx;
    }

    // (59:32) {#each linesArray as question}
    function create_each_block_2(ctx) {
    	let option;
    	let t0_value = /*question*/ ctx[18] + "";
    	let t0;
    	let t1;

    	const block = {
    		c: function create() {
    			option = element("option");
    			t0 = text(t0_value);
    			t1 = space();
    			option.__value = /*question*/ ctx[18];
    			option.value = option.__value;
    			attr_dev(option, "class", "svelte-11pph83");
    			add_location(option, file$3, 59, 36, 1749);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, option, anchor);
    			append_dev(option, t0);
    			append_dev(option, t1);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(option);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_2.name,
    		type: "each",
    		source: "(59:32) {#each linesArray as question}",
    		ctx
    	});

    	return block;
    }

    // (68:32) {#each refsArray as question}
    function create_each_block_1(ctx) {
    	let option;
    	let t0_value = /*question*/ ctx[18] + "";
    	let t0;
    	let t1;

    	const block = {
    		c: function create() {
    			option = element("option");
    			t0 = text(t0_value);
    			t1 = space();
    			option.__value = /*question*/ ctx[18];
    			option.value = option.__value;
    			attr_dev(option, "class", "svelte-11pph83");
    			add_location(option, file$3, 68, 36, 2185);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, option, anchor);
    			append_dev(option, t0);
    			append_dev(option, t1);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(option);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_1.name,
    		type: "each",
    		source: "(68:32) {#each refsArray as question}",
    		ctx
    	});

    	return block;
    }

    // (55:16) {#each { length: rowsCount } as _, i}
    function create_each_block(ctx) {
    	let tr;
    	let td0;
    	let select0;
    	let t0;
    	let td1;
    	let select1;
    	let t1;
    	let td2;
    	let input0;
    	let t2;
    	let td3;
    	let input1;
    	let t3;
    	let td4;
    	let input2;
    	let t4;
    	let mounted;
    	let dispose;
    	let each_value_2 = /*linesArray*/ ctx[4];
    	validate_each_argument(each_value_2);
    	let each_blocks_1 = [];

    	for (let i = 0; i < each_value_2.length; i += 1) {
    		each_blocks_1[i] = create_each_block_2(get_each_context_2(ctx, each_value_2, i));
    	}

    	let each_value_1 = /*refsArray*/ ctx[5];
    	validate_each_argument(each_value_1);
    	let each_blocks = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	const block = {
    		c: function create() {
    			tr = element("tr");
    			td0 = element("td");
    			select0 = element("select");

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].c();
    			}

    			t0 = space();
    			td1 = element("td");
    			select1 = element("select");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t1 = space();
    			td2 = element("td");
    			input0 = element("input");
    			t2 = space();
    			td3 = element("td");
    			input1 = element("input");
    			t3 = space();
    			td4 = element("td");
    			input2 = element("input");
    			t4 = space();
    			attr_dev(select0, "class", "svelte-11pph83");
    			add_location(select0, file$3, 57, 28, 1607);
    			attr_dev(td0, "class", "svelte-11pph83");
    			add_location(td0, file$3, 56, 24, 1573);
    			attr_dev(select1, "class", "svelte-11pph83");
    			add_location(select1, file$3, 66, 28, 2044);
    			attr_dev(td1, "class", "svelte-11pph83");
    			add_location(td1, file$3, 65, 24, 2010);
    			attr_dev(input0, "type", "number");
    			attr_dev(input0, "min", "1");
    			attr_dev(input0, "max", "100000");
    			attr_dev(input0, "class", "svelte-11pph83");
    			add_location(input0, file$3, 75, 28, 2480);
    			attr_dev(td2, "class", "svelte-11pph83");
    			add_location(td2, file$3, 74, 24, 2446);
    			attr_dev(input1, "type", "text");
    			attr_dev(input1, "class", "svelte-11pph83");
    			add_location(input1, file$3, 78, 28, 2615);
    			attr_dev(td3, "class", "svelte-11pph83");
    			add_location(td3, file$3, 77, 24, 2581);
    			attr_dev(input2, "type", "datetime-local");
    			attr_dev(input2, "name", "deliv-date");
    			attr_dev(input2, "class", "svelte-11pph83");
    			add_location(input2, file$3, 81, 28, 2727);
    			attr_dev(td4, "class", "svelte-11pph83");
    			add_location(td4, file$3, 80, 24, 2693);
    			attr_dev(tr, "class", "svelte-11pph83");
    			add_location(tr, file$3, 55, 20, 1543);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, tr, anchor);
    			append_dev(tr, td0);
    			append_dev(td0, select0);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				if (each_blocks_1[i]) {
    					each_blocks_1[i].m(select0, null);
    				}
    			}

    			append_dev(tr, t0);
    			append_dev(tr, td1);
    			append_dev(td1, select1);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(select1, null);
    				}
    			}

    			append_dev(tr, t1);
    			append_dev(tr, td2);
    			append_dev(td2, input0);
    			append_dev(tr, t2);
    			append_dev(tr, td3);
    			append_dev(td3, input1);
    			append_dev(tr, t3);
    			append_dev(tr, td4);
    			append_dev(td4, input2);
    			append_dev(tr, t4);

    			if (!mounted) {
    				dispose = [
    					listen_dev(select0, "change", /*change_handler*/ ctx[10], false, false, false, false),
    					listen_dev(select1, "change", /*change_handler_1*/ ctx[11], false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*linesArray*/ 16) {
    				each_value_2 = /*linesArray*/ ctx[4];
    				validate_each_argument(each_value_2);
    				let i;

    				for (i = 0; i < each_value_2.length; i += 1) {
    					const child_ctx = get_each_context_2(ctx, each_value_2, i);

    					if (each_blocks_1[i]) {
    						each_blocks_1[i].p(child_ctx, dirty);
    					} else {
    						each_blocks_1[i] = create_each_block_2(child_ctx);
    						each_blocks_1[i].c();
    						each_blocks_1[i].m(select0, null);
    					}
    				}

    				for (; i < each_blocks_1.length; i += 1) {
    					each_blocks_1[i].d(1);
    				}

    				each_blocks_1.length = each_value_2.length;
    			}

    			if (dirty & /*refsArray*/ 32) {
    				each_value_1 = /*refsArray*/ ctx[5];
    				validate_each_argument(each_value_1);
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1(ctx, each_value_1, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block_1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(select1, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value_1.length;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(tr);
    			destroy_each(each_blocks_1, detaching);
    			destroy_each(each_blocks, detaching);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(55:16) {#each { length: rowsCount } as _, i}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$3(ctx) {
    	let dialog_1;
    	let div1;
    	let div0;
    	let button0;
    	let t1;
    	let button1;
    	let t3;
    	let button2;
    	let t5;
    	let button3;
    	let t7;
    	let hr;
    	let t8;
    	let table;
    	let thead;
    	let tr;
    	let th0;
    	let t10;
    	let th1;
    	let t12;
    	let th2;
    	let t14;
    	let th3;
    	let t16;
    	let th4;
    	let t18;
    	let tbody;
    	let mounted;
    	let dispose;
    	let each_value = { length: /*rowsCount*/ ctx[3] };
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			dialog_1 = element("dialog");
    			div1 = element("div");
    			div0 = element("div");
    			button0 = element("button");
    			button0.textContent = "Save";
    			t1 = space();
    			button1 = element("button");
    			button1.textContent = "+";
    			t3 = space();
    			button2 = element("button");
    			button2.textContent = "-";
    			t5 = space();
    			button3 = element("button");
    			button3.textContent = "X";
    			t7 = space();
    			hr = element("hr");
    			t8 = space();
    			table = element("table");
    			thead = element("thead");
    			tr = element("tr");
    			th0 = element("th");
    			th0.textContent = "Linie";
    			t10 = space();
    			th1 = element("th");
    			th1.textContent = "Referinta";
    			t12 = space();
    			th2 = element("th");
    			th2.textContent = "Cantit";
    			t14 = space();
    			th3 = element("th");
    			th3.textContent = "deliv_nr";
    			t16 = space();
    			th4 = element("th");
    			th4.textContent = "deliv_date";
    			t18 = space();
    			tbody = element("tbody");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(button0, "class", "svelte-11pph83");
    			add_location(button0, file$3, 37, 8, 862);
    			attr_dev(button1, "class", "addRow svelte-11pph83");
    			add_location(button1, file$3, 38, 8, 914);
    			attr_dev(button2, "class", "removeRow svelte-11pph83");
    			add_location(button2, file$3, 39, 8, 977);
    			attr_dev(button3, "class", "close-dial svelte-11pph83");
    			add_location(button3, file$3, 40, 8, 1046);
    			attr_dev(div0, "class", "flexi svelte-11pph83");
    			add_location(div0, file$3, 36, 8, 833);
    			attr_dev(hr, "class", "svelte-11pph83");
    			add_location(hr, file$3, 42, 8, 1138);
    			attr_dev(th0, "class", "svelte-11pph83");
    			add_location(th0, file$3, 46, 20, 1226);
    			attr_dev(th1, "class", "svelte-11pph83");
    			add_location(th1, file$3, 47, 20, 1262);
    			attr_dev(th2, "class", "svelte-11pph83");
    			add_location(th2, file$3, 48, 20, 1303);
    			attr_dev(th3, "class", "svelte-11pph83");
    			add_location(th3, file$3, 49, 20, 1341);
    			attr_dev(th4, "class", "svelte-11pph83");
    			add_location(th4, file$3, 50, 20, 1381);
    			attr_dev(tr, "class", "svelte-11pph83");
    			add_location(tr, file$3, 45, 16, 1200);
    			attr_dev(thead, "class", "svelte-11pph83");
    			add_location(thead, file$3, 44, 12, 1175);
    			attr_dev(tbody, "class", "svelte-11pph83");
    			add_location(tbody, file$3, 53, 12, 1459);
    			attr_dev(table, "class", "svelte-11pph83");
    			add_location(table, file$3, 43, 8, 1154);
    			attr_dev(div1, "class", "svelte-11pph83");
    			add_location(div1, file$3, 35, 4, 793);
    			attr_dev(dialog_1, "class", "svelte-11pph83");
    			add_location(dialog_1, file$3, 29, 0, 605);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, dialog_1, anchor);
    			append_dev(dialog_1, div1);
    			append_dev(div1, div0);
    			append_dev(div0, button0);
    			append_dev(div0, t1);
    			append_dev(div0, button1);
    			append_dev(div0, t3);
    			append_dev(div0, button2);
    			append_dev(div0, t5);
    			append_dev(div0, button3);
    			append_dev(div1, t7);
    			append_dev(div1, hr);
    			append_dev(div1, t8);
    			append_dev(div1, table);
    			append_dev(table, thead);
    			append_dev(thead, tr);
    			append_dev(tr, th0);
    			append_dev(tr, t10);
    			append_dev(tr, th1);
    			append_dev(tr, t12);
    			append_dev(tr, th2);
    			append_dev(tr, t14);
    			append_dev(tr, th3);
    			append_dev(tr, t16);
    			append_dev(tr, th4);
    			append_dev(table, t18);
    			append_dev(table, tbody);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(tbody, null);
    				}
    			}

    			/*dialog_1_binding*/ ctx[12](dialog_1);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", savePlan, false, false, false, false),
    					listen_dev(button1, "click", /*addRow*/ ctx[7], false, false, false, false),
    					listen_dev(button2, "click", /*removeRow*/ ctx[6], false, false, false, false),
    					listen_dev(button3, "click", /*click_handler_1*/ ctx[9], false, false, false, false),
    					listen_dev(div1, "click", stop_propagation(/*click_handler*/ ctx[8]), false, false, true, false),
    					listen_dev(dialog_1, "close", /*close_handler*/ ctx[13], false, false, false, false),
    					listen_dev(dialog_1, "click", self(/*click_handler_2*/ ctx[14]), false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*answer, refsArray, linesArray, rowsCount*/ 60) {
    				each_value = { length: /*rowsCount*/ ctx[3] };
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(tbody, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(dialog_1);
    			destroy_each(each_blocks, detaching);
    			/*dialog_1_binding*/ ctx[12](null);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function savePlan() {
    	alert("savePlan()");
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Editplanmanual', slots, []);
    	let { showModal } = $$props;
    	let dialog; // HTMLDialogElement
    	let linesArray = ["LINE1", "LINE2", "LINE3"];
    	let refsArray = ["REF1", "REF2", "REF3"];
    	let answer = "";
    	let rowsCount = 5;

    	function removeRow() {
    		$$invalidate(3, rowsCount = rowsCount - 1);
    	}

    	function addRow() {
    		$$invalidate(3, rowsCount++, rowsCount);
    	}

    	$$self.$$.on_mount.push(function () {
    		if (showModal === undefined && !('showModal' in $$props || $$self.$$.bound[$$self.$$.props['showModal']])) {
    			console.warn("<Editplanmanual> was created without expected prop 'showModal'");
    		}
    	});

    	const writable_props = ['showModal'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Editplanmanual> was created with unknown prop '${key}'`);
    	});

    	function click_handler(event) {
    		bubble.call(this, $$self, event);
    	}

    	const click_handler_1 = () => dialog.close();
    	const change_handler = () => $$invalidate(2, answer = "");
    	const change_handler_1 = () => $$invalidate(2, answer = "");

    	function dialog_1_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			dialog = $$value;
    			$$invalidate(1, dialog);
    		});
    	}

    	const close_handler = () => $$invalidate(0, showModal = false);
    	const click_handler_2 = () => dialog.close();

    	$$self.$$set = $$props => {
    		if ('showModal' in $$props) $$invalidate(0, showModal = $$props.showModal);
    	};

    	$$self.$capture_state = () => ({
    		showModal,
    		dialog,
    		linesArray,
    		refsArray,
    		answer,
    		rowsCount,
    		savePlan,
    		removeRow,
    		addRow
    	});

    	$$self.$inject_state = $$props => {
    		if ('showModal' in $$props) $$invalidate(0, showModal = $$props.showModal);
    		if ('dialog' in $$props) $$invalidate(1, dialog = $$props.dialog);
    		if ('linesArray' in $$props) $$invalidate(4, linesArray = $$props.linesArray);
    		if ('refsArray' in $$props) $$invalidate(5, refsArray = $$props.refsArray);
    		if ('answer' in $$props) $$invalidate(2, answer = $$props.answer);
    		if ('rowsCount' in $$props) $$invalidate(3, rowsCount = $$props.rowsCount);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*dialog, showModal*/ 3) {
    			if (dialog && showModal) dialog.showModal();
    		}
    	};

    	return [
    		showModal,
    		dialog,
    		answer,
    		rowsCount,
    		linesArray,
    		refsArray,
    		removeRow,
    		addRow,
    		click_handler,
    		click_handler_1,
    		change_handler,
    		change_handler_1,
    		dialog_1_binding,
    		close_handler,
    		click_handler_2
    	];
    }

    class Editplanmanual extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, { showModal: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Editplanmanual",
    			options,
    			id: create_fragment$3.name
    		});
    	}

    	get showModal() {
    		throw new Error("<Editplanmanual>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set showModal(value) {
    		throw new Error("<Editplanmanual>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\EditPlan.svelte generated by Svelte v3.59.2 */

    const { console: console_1$1 } = globals;
    const file$2 = "src\\EditPlan.svelte";

    function create_fragment$2(ctx) {
    	let body;
    	let editplanmanual;
    	let updating_showModal;
    	let t0;
    	let div;
    	let button;
    	let t2;
    	let t3;
    	let t4;
    	let jstable;
    	let current;
    	let mounted;
    	let dispose;

    	function editplanmanual_showModal_binding(value) {
    		/*editplanmanual_showModal_binding*/ ctx[4](value);
    	}

    	let editplanmanual_props = {};

    	if (/*showModal*/ ctx[3] !== void 0) {
    		editplanmanual_props.showModal = /*showModal*/ ctx[3];
    	}

    	editplanmanual = new Editplanmanual({
    			props: editplanmanual_props,
    			$$inline: true
    		});

    	binding_callbacks.push(() => bind(editplanmanual, 'showModal', editplanmanual_showModal_binding));

    	jstable = new JSTable({
    			props: {
    				headerArray: /*jsTH*/ ctx[1],
    				bodyArray: /*jsTB*/ ctx[2]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			body = element("body");
    			create_component(editplanmanual.$$.fragment);
    			t0 = space();
    			div = element("div");
    			button = element("button");
    			button.textContent = "show modal";
    			t2 = space();
    			t3 = text(/*messager*/ ctx[0]);
    			t4 = space();
    			create_component(jstable.$$.fragment);
    			add_location(button, file$2, 41, 6, 875);
    			set_style(div, "height", "88vh");
    			set_style(div, "overflow", "auto");
    			add_location(div, file$2, 40, 4, 824);
    			add_location(body, file$2, 35, 0, 749);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, body, anchor);
    			mount_component(editplanmanual, body, null);
    			append_dev(body, t0);
    			append_dev(body, div);
    			append_dev(div, button);
    			append_dev(div, t2);
    			append_dev(div, t3);
    			append_dev(div, t4);
    			mount_component(jstable, div, null);
    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*click_handler*/ ctx[5], false, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			const editplanmanual_changes = {};

    			if (!updating_showModal && dirty & /*showModal*/ 8) {
    				updating_showModal = true;
    				editplanmanual_changes.showModal = /*showModal*/ ctx[3];
    				add_flush_callback(() => updating_showModal = false);
    			}

    			editplanmanual.$set(editplanmanual_changes);
    			if (!current || dirty & /*messager*/ 1) set_data_dev(t3, /*messager*/ ctx[0]);
    			const jstable_changes = {};
    			if (dirty & /*jsTH*/ 2) jstable_changes.headerArray = /*jsTH*/ ctx[1];
    			if (dirty & /*jsTB*/ 4) jstable_changes.bodyArray = /*jsTB*/ ctx[2];
    			jstable.$set(jstable_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(editplanmanual.$$.fragment, local);
    			transition_in(jstable.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(editplanmanual.$$.fragment, local);
    			transition_out(jstable.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(body);
    			destroy_component(editplanmanual);
    			destroy_component(jstable);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('EditPlan', slots, []);
    	let messager = "";
    	let jsTH = ["Please Wait", ""];
    	let jsTB = [["Please", "Wait"]];
    	let query = "SELECT * FROM `pfollow`.`ebtd_events` LIMIT 10;";

    	onMount(async () => {
    		const { ajsTH, ajsTB, error } = await fetchData(query);

    		if (error) {
    			$$invalidate(0, messager = error);
    			console.log(messager);
    		} else {
    			$$invalidate(1, jsTH = ajsTH);
    			$$invalidate(2, jsTB = ajsTB);
    		} // You can use jsTH and jsTB here
    	});

    	let showModal = false;
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$1.warn(`<EditPlan> was created with unknown prop '${key}'`);
    	});

    	function editplanmanual_showModal_binding(value) {
    		showModal = value;
    		$$invalidate(3, showModal);
    	}

    	const click_handler = () => $$invalidate(3, showModal = true);

    	$$self.$capture_state = () => ({
    		onMount,
    		userProfile,
    		JsTable: JSTable,
    		fetchData,
    		Editplanmanual,
    		messager,
    		jsTH,
    		jsTB,
    		query,
    		showModal
    	});

    	$$self.$inject_state = $$props => {
    		if ('messager' in $$props) $$invalidate(0, messager = $$props.messager);
    		if ('jsTH' in $$props) $$invalidate(1, jsTH = $$props.jsTH);
    		if ('jsTB' in $$props) $$invalidate(2, jsTB = $$props.jsTB);
    		if ('query' in $$props) query = $$props.query;
    		if ('showModal' in $$props) $$invalidate(3, showModal = $$props.showModal);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		messager,
    		jsTH,
    		jsTB,
    		showModal,
    		editplanmanual_showModal_binding,
    		click_handler
    	];
    }

    class EditPlan extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "EditPlan",
    			options,
    			id: create_fragment$2.name
    		});
    	}
    }

    async function aslogout() {
        try {
            const response = await fetch("php_files/logout.php", {
                method: "POST", // You can use POST or GET, depending on your setup
            });

            if (response.ok) {
                console.log("User logged out");
                return true;
            } else {
                console.error("Logout failed");
                return false;
            }
        } catch (error) {
            console.error("Network error:", error);
            return false;
        }
    }

    /* src\Virtual.svelte generated by Svelte v3.59.2 */

    const { console: console_1 } = globals;
    const file$1 = "src\\Virtual.svelte";

    // (29:4) {#if jsTH}
    function create_if_block$1(ctx) {
    	let jstable;
    	let current;

    	jstable = new JSTable({
    			props: {
    				headerArray: /*jsTH*/ ctx[1],
    				bodyArray: /*jsTB*/ ctx[2]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(jstable.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(jstable, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const jstable_changes = {};
    			if (dirty & /*jsTH*/ 2) jstable_changes.headerArray = /*jsTH*/ ctx[1];
    			if (dirty & /*jsTB*/ 4) jstable_changes.bodyArray = /*jsTB*/ ctx[2];
    			jstable.$set(jstable_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(jstable.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(jstable.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(jstable, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(29:4) {#if jsTH}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let body;
    	let t0;
    	let t1;
    	let textarea;
    	let t2;
    	let button;
    	let t4;
    	let div;
    	let current;
    	let mounted;
    	let dispose;
    	let if_block = /*jsTH*/ ctx[1] && create_if_block$1(ctx);

    	const block = {
    		c: function create() {
    			body = element("body");
    			t0 = text(/*messager*/ ctx[0]);
    			t1 = space();
    			textarea = element("textarea");
    			t2 = space();
    			button = element("button");
    			button.textContent = "Fetch Data";
    			t4 = space();
    			div = element("div");
    			if (if_block) if_block.c();
    			attr_dev(textarea, "class", "svelte-1m2fn6l");
    			add_location(textarea, file$1, 25, 2, 506);
    			add_location(button, file$1, 26, 2, 539);
    			set_style(div, "height", "75vh");
    			set_style(div, "overflow", "auto");
    			add_location(div, file$1, 27, 2, 598);
    			add_location(body, file$1, 23, 0, 482);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, body, anchor);
    			append_dev(body, t0);
    			append_dev(body, t1);
    			append_dev(body, textarea);
    			set_input_value(textarea, /*sql*/ ctx[3]);
    			append_dev(body, t2);
    			append_dev(body, button);
    			append_dev(body, t4);
    			append_dev(body, div);
    			if (if_block) if_block.m(div, null);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(textarea, "input", /*textarea_input_handler*/ ctx[5]),
    					listen_dev(button, "click", /*fetchDataOnClick*/ ctx[4], false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (!current || dirty & /*messager*/ 1) set_data_dev(t0, /*messager*/ ctx[0]);

    			if (dirty & /*sql*/ 8) {
    				set_input_value(textarea, /*sql*/ ctx[3]);
    			}

    			if (/*jsTH*/ ctx[1]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*jsTH*/ 2) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block$1(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(div, null);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(body);
    			if (if_block) if_block.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Virtual', slots, []);
    	let messager = "";
    	let jsTH;
    	let jsTB;
    	let sql = "SELECT * FROM `pfollow`.`ebtd_events`";

    	async function fetchDataOnClick() {
    		const { ajsTH, ajsTB, error } = await fetchData(sql);

    		if (error) {
    			$$invalidate(0, messager = error);
    			console.log(messager);
    		} else {
    			$$invalidate(1, jsTH = ajsTH);
    			$$invalidate(2, jsTB = ajsTB);
    			$$invalidate(0, messager = "");
    		}
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1.warn(`<Virtual> was created with unknown prop '${key}'`);
    	});

    	function textarea_input_handler() {
    		sql = this.value;
    		$$invalidate(3, sql);
    	}

    	$$self.$capture_state = () => ({
    		JsTable: JSTable,
    		fetchData,
    		messager,
    		jsTH,
    		jsTB,
    		sql,
    		fetchDataOnClick
    	});

    	$$self.$inject_state = $$props => {
    		if ('messager' in $$props) $$invalidate(0, messager = $$props.messager);
    		if ('jsTH' in $$props) $$invalidate(1, jsTH = $$props.jsTH);
    		if ('jsTB' in $$props) $$invalidate(2, jsTB = $$props.jsTB);
    		if ('sql' in $$props) $$invalidate(3, sql = $$props.sql);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [messager, jsTH, jsTB, sql, fetchDataOnClick, textarea_input_handler];
    }

    class Virtual extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Virtual",
    			options,
    			id: create_fragment$1.name
    		});
    	}
    }

    /* src\App.svelte generated by Svelte v3.59.2 */
    const file = "src\\App.svelte";

    // (23:1) {:else}
    function create_else_block(ctx) {
    	let ul;
    	let li0;
    	let a0;
    	let t1;
    	let li1;
    	let a1;
    	let t3;
    	let li2;
    	let a2;
    	let t4_value = /*$userProfile*/ ctx[0].user + "";
    	let t4;
    	let t5;
    	let t6;
    	let t7;
    	let if_block1_anchor;
    	let current;
    	let mounted;
    	let dispose;
    	let if_block0 = /*$userProfile*/ ctx[0].myPage == "Home" && create_if_block_2(ctx);
    	let if_block1 = /*$userProfile*/ ctx[0].myPage == "Virtual" && create_if_block_1(ctx);

    	const block = {
    		c: function create() {
    			ul = element("ul");
    			li0 = element("li");
    			a0 = element("a");
    			a0.textContent = "Home";
    			t1 = space();
    			li1 = element("li");
    			a1 = element("a");
    			a1.textContent = "Virtual";
    			t3 = space();
    			li2 = element("li");
    			a2 = element("a");
    			t4 = text(t4_value);
    			t5 = text("👈");
    			t6 = space();
    			if (if_block0) if_block0.c();
    			t7 = space();
    			if (if_block1) if_block1.c();
    			if_block1_anchor = empty();
    			attr_dev(a0, "href", "/");
    			attr_dev(a0, "class", "svelte-3n2v6v");
    			add_location(a0, file, 25, 4, 480);
    			attr_dev(li0, "class", "svelte-3n2v6v");
    			add_location(li0, file, 24, 3, 471);
    			attr_dev(a1, "href", "/");
    			attr_dev(a1, "class", "svelte-3n2v6v");
    			add_location(a1, file, 41, 4, 752);
    			attr_dev(li1, "class", "svelte-3n2v6v");
    			add_location(li1, file, 40, 3, 743);
    			attr_dev(a2, "href", "/");
    			attr_dev(a2, "class", "svelte-3n2v6v");
    			add_location(a2, file, 49, 4, 898);
    			attr_dev(li2, "id", "loggoff");
    			attr_dev(li2, "class", "svelte-3n2v6v");
    			add_location(li2, file, 48, 3, 876);
    			attr_dev(ul, "id", "menu");
    			attr_dev(ul, "class", "svelte-3n2v6v");
    			add_location(ul, file, 23, 2, 453);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, ul, anchor);
    			append_dev(ul, li0);
    			append_dev(li0, a0);
    			append_dev(ul, t1);
    			append_dev(ul, li1);
    			append_dev(li1, a1);
    			append_dev(ul, t3);
    			append_dev(ul, li2);
    			append_dev(li2, a2);
    			append_dev(a2, t4);
    			append_dev(a2, t5);
    			insert_dev(target, t6, anchor);
    			if (if_block0) if_block0.m(target, anchor);
    			insert_dev(target, t7, anchor);
    			if (if_block1) if_block1.m(target, anchor);
    			insert_dev(target, if_block1_anchor, anchor);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(a0, "click", prevent_default(/*click_handler*/ ctx[2]), false, true, false, false),
    					listen_dev(a1, "click", prevent_default(/*click_handler_1*/ ctx[3]), false, true, false, false),
    					listen_dev(a2, "click", prevent_default(/*call_aslogout*/ ctx[1]), false, true, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if ((!current || dirty & /*$userProfile*/ 1) && t4_value !== (t4_value = /*$userProfile*/ ctx[0].user + "")) set_data_dev(t4, t4_value);

    			if (/*$userProfile*/ ctx[0].myPage == "Home") {
    				if (if_block0) {
    					if (dirty & /*$userProfile*/ 1) {
    						transition_in(if_block0, 1);
    					}
    				} else {
    					if_block0 = create_if_block_2(ctx);
    					if_block0.c();
    					transition_in(if_block0, 1);
    					if_block0.m(t7.parentNode, t7);
    				}
    			} else if (if_block0) {
    				group_outros();

    				transition_out(if_block0, 1, 1, () => {
    					if_block0 = null;
    				});

    				check_outros();
    			}

    			if (/*$userProfile*/ ctx[0].myPage == "Virtual") {
    				if (if_block1) {
    					if (dirty & /*$userProfile*/ 1) {
    						transition_in(if_block1, 1);
    					}
    				} else {
    					if_block1 = create_if_block_1(ctx);
    					if_block1.c();
    					transition_in(if_block1, 1);
    					if_block1.m(if_block1_anchor.parentNode, if_block1_anchor);
    				}
    			} else if (if_block1) {
    				group_outros();

    				transition_out(if_block1, 1, 1, () => {
    					if_block1 = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block0);
    			transition_in(if_block1);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block0);
    			transition_out(if_block1);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(ul);
    			if (detaching) detach_dev(t6);
    			if (if_block0) if_block0.d(detaching);
    			if (detaching) detach_dev(t7);
    			if (if_block1) if_block1.d(detaching);
    			if (detaching) detach_dev(if_block1_anchor);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(23:1) {:else}",
    		ctx
    	});

    	return block;
    }

    // (21:1) {#if $userProfile.isLoggedIn === false}
    function create_if_block(ctx) {
    	let login;
    	let current;
    	login = new Login({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(login.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(login, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(login.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(login.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(login, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(21:1) {#if $userProfile.isLoggedIn === false}",
    		ctx
    	});

    	return block;
    }

    // (56:2) {#if $userProfile.myPage == "Home"}
    function create_if_block_2(ctx) {
    	let home;
    	let current;
    	home = new Home({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(home.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(home, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(home.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(home.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(home, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(56:2) {#if $userProfile.myPage == \\\"Home\\\"}",
    		ctx
    	});

    	return block;
    }

    // (64:2) {#if $userProfile.myPage == "Virtual"}
    function create_if_block_1(ctx) {
    	let virtual;
    	let current;
    	virtual = new Virtual({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(virtual.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(virtual, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(virtual.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(virtual.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(virtual, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(64:2) {#if $userProfile.myPage == \\\"Virtual\\\"}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let main;
    	let current_block_type_index;
    	let if_block;
    	let current;
    	const if_block_creators = [create_if_block, create_else_block];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*$userProfile*/ ctx[0].isLoggedIn === false) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			main = element("main");
    			if_block.c();
    			add_location(main, file, 19, 0, 381);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			if_blocks[current_block_type_index].m(main, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				} else {
    					if_block.p(ctx, dirty);
    				}

    				transition_in(if_block, 1);
    				if_block.m(main, null);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			if_blocks[current_block_type_index].d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let $userProfile;
    	validate_store(userProfile, 'userProfile');
    	component_subscribe($$self, userProfile, $$value => $$invalidate(0, $userProfile = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);

    	async function call_aslogout() {
    		let logres = await aslogout();
    		if (logres) set_store_value(userProfile, $userProfile.isLoggedIn = false, $userProfile);
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	const click_handler = () => set_store_value(userProfile, $userProfile.myPage = "Home", $userProfile);
    	const click_handler_1 = () => set_store_value(userProfile, $userProfile.myPage = "Virtual", $userProfile);

    	$$self.$capture_state = () => ({
    		userProfile,
    		Login,
    		Home,
    		EditPlan,
    		aslogout,
    		Virtual,
    		call_aslogout,
    		$userProfile
    	});

    	return [$userProfile, call_aslogout, click_handler, click_handler_1];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
        target: document.body,
       /* props: {
            name: 'world'
        }*/
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
