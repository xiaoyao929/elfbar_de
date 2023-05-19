/** vim: et:ts=4:sw=4:sts=4
 * @license RequireJS 2.1.11 Copyright (c) 2010-2014, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/requirejs for details
 */
//Not using strict: uneven strict support in browsers, #392, and causes
//problems with requirejs.exec()/transpiler plugins that may not be strict.
/*jslint regexp: true, nomen: true, sloppy: true */
/*global window, navigator, document, importScripts, setTimeout, opera */

var requirejs, require, define;
(function (global) {
    var req, s, head, baseElement, dataMain, src,
        interactiveScript, currentlyAddingScript, mainScript, subPath,
        version = '2.1.11',
        commentRegExp = /(\/\*([\s\S]*?)\*\/|([^:]|^)\/\/(.*)$)/mg,
        cjsRequireRegExp = /[^.]\s*require\s*\(\s*["']([^'"\s]+)["']\s*\)/g,
        jsSuffixRegExp = /\.js$/,
        currDirRegExp = /^\.\//,
        op = Object.prototype,
        ostring = op.toString,
        hasOwn = op.hasOwnProperty,
        ap = Array.prototype,
        apsp = ap.splice,
        isBrowser = !!(typeof window !== 'undefined' && typeof navigator !== 'undefined' && window.document),
        isWebWorker = !isBrowser && typeof importScripts !== 'undefined',
        //PS3 indicates loaded and complete, but need to wait for complete
        //specifically. Sequence is 'loading', 'loaded', execution,
        // then 'complete'. The UA check is unfortunate, but not sure how
        //to feature test w/o causing perf issues.
        readyRegExp = isBrowser && navigator.platform === 'PLAYSTATION 3' ?
                      /^complete$/ : /^(complete|loaded)$/,
        defContextName = '_',
        //Oh the tragedy, detecting opera. See the usage of isOpera for reason.
        isOpera = typeof opera !== 'undefined' && opera.toString() === '[object Opera]',
        contexts = {},
        cfg = {},
        globalDefQueue = [],
        useInteractive = false;

    function isFunction(it) {
        return ostring.call(it) === '[object Function]';
    }

    function isArray(it) {
        return ostring.call(it) === '[object Array]';
    }

    /**
     * Helper function for iterating over an array. If the func returns
     * a true value, it will break out of the loop.
     */
    function each(ary, func) {
        if (ary) {
            var i;
            for (i = 0; i < ary.length; i += 1) {
                if (ary[i] && func(ary[i], i, ary)) {
                    break;
                }
            }
        }
    }

    /**
     * Helper function for iterating over an array backwards. If the func
     * returns a true value, it will break out of the loop.
     */
    function eachReverse(ary, func) {
        if (ary) {
            var i;
            for (i = ary.length - 1; i > -1; i -= 1) {
                if (ary[i] && func(ary[i], i, ary)) {
                    break;
                }
            }
        }
    }

    function hasProp(obj, prop) {
        return hasOwn.call(obj, prop);
    }

    function getOwn(obj, prop) {
        return hasProp(obj, prop) && obj[prop];
    }

    /**
     * Cycles over properties in an object and calls a function for each
     * property value. If the function returns a truthy value, then the
     * iteration is stopped.
     */
    function eachProp(obj, func) {
        var prop;
        for (prop in obj) {
            if (hasProp(obj, prop)) {
                if (func(obj[prop], prop)) {
                    break;
                }
            }
        }
    }

    /**
     * Simple function to mix in properties from source into target,
     * but only if target does not already have a property of the same name.
     */
    function mixin(target, source, force, deepStringMixin) {
        if (source) {
            eachProp(source, function (value, prop) {
                if (force || !hasProp(target, prop)) {
                    if (deepStringMixin && typeof value === 'object' && value &&
                        !isArray(value) && !isFunction(value) &&
                        !(value instanceof RegExp)) {

                        if (!target[prop]) {
                            target[prop] = {};
                        }
                        mixin(target[prop], value, force, deepStringMixin);
                    } else {
                        target[prop] = value;
                    }
                }
            });
        }
        return target;
    }

    //Similar to Function.prototype.bind, but the 'this' object is specified
    //first, since it is easier to read/figure out what 'this' will be.
    function bind(obj, fn) {
        return function () {
            return fn.apply(obj, arguments);
        };
    }

    function scripts() {
        return document.getElementsByTagName('script');
    }

    function defaultOnError(err) {
        throw err;
    }

    //Allow getting a global that is expressed in
    //dot notation, like 'a.b.c'.
    function getGlobal(value) {
        if (!value) {
            return value;
        }
        var g = global;
        each(value.split('.'), function (part) {
            g = g[part];
        });
        return g;
    }

    /**
     * Constructs an error with a pointer to an URL with more information.
     * @param {String} id the error ID that maps to an ID on a web page.
     * @param {String} message human readable error.
     * @param {Error} [err] the original error, if there is one.
     *
     * @returns {Error}
     */
    function makeError(id, msg, err, requireModules) {
        var e = new Error(msg + '\nhttp://requirejs.org/docs/errors.html#' + id);
        e.requireType = id;
        e.requireModules = requireModules;
        if (err) {
            e.originalError = err;
        }
        return e;
    }

    if (typeof define !== 'undefined') {
        //If a define is already in play via another AMD loader,
        //do not overwrite.
        return;
    }

    if (typeof requirejs !== 'undefined') {
        if (isFunction(requirejs)) {
            //Do not overwrite and existing requirejs instance.
            return;
        }
        cfg = requirejs;
        requirejs = undefined;
    }

    //Allow for a require config object
    if (typeof require !== 'undefined' && !isFunction(require)) {
        //assume it is a config object.
        cfg = require;
        require = undefined;
    }

    function newContext(contextName) {
        var inCheckLoaded, Module, context, handlers,
            checkLoadedTimeoutId,
            config = {
                //Defaults. Do not set a default for map
                //config to speed up normalize(), which
                //will run faster if there is no default.
                waitSeconds: 7,
                baseUrl: './',
                paths: {},
                bundles: {},
                pkgs: {},
                shim: {},
                config: {}
            },
            registry = {},
            //registry of just enabled modules, to speed
            //cycle breaking code when lots of modules
            //are registered, but not activated.
            enabledRegistry = {},
            undefEvents = {},
            defQueue = [],
            defined = {},
            urlFetched = {},
            bundlesMap = {},
            requireCounter = 1,
            unnormalizedCounter = 1;

        /**
         * Trims the . and .. from an array of path segments.
         * It will keep a leading path segment if a .. will become
         * the first path segment, to help with module name lookups,
         * which act like paths, but can be remapped. But the end result,
         * all paths that use this function should look normalized.
         * NOTE: this method MODIFIES the input array.
         * @param {Array} ary the array of path segments.
         */
        function trimDots(ary) {
            var i, part, length = ary.length;
            for (i = 0; i < length; i++) {
                part = ary[i];
                if (part === '.') {
                    ary.splice(i, 1);
                    i -= 1;
                } else if (part === '..') {
                    if (i === 1 && (ary[2] === '..' || ary[0] === '..')) {
                        //End of the line. Keep at least one non-dot
                        //path segment at the front so it can be mapped
                        //correctly to disk. Otherwise, there is likely
                        //no path mapping for a path starting with '..'.
                        //This can still fail, but catches the most reasonable
                        //uses of ..
                        break;
                    } else if (i > 0) {
                        ary.splice(i - 1, 2);
                        i -= 2;
                    }
                }
            }
        }

        /**
         * Given a relative module name, like ./something, normalize it to
         * a real name that can be mapped to a path.
         * @param {String} name the relative name
         * @param {String} baseName a real name that the name arg is relative
         * to.
         * @param {Boolean} applyMap apply the map config to the value. Should
         * only be done if this normalization is for a dependency ID.
         * @returns {String} normalized name
         */
        function normalize(name, baseName, applyMap) {
            var pkgMain, mapValue, nameParts, i, j, nameSegment, lastIndex,
                foundMap, foundI, foundStarMap, starI,
                baseParts = baseName && baseName.split('/'),
                normalizedBaseParts = baseParts,
                map = config.map,
                starMap = map && map['*'];

            //Adjust any relative paths.
            if (name && name.charAt(0) === '.') {
                //If have a base name, try to normalize against it,
                //otherwise, assume it is a top-level require that will
                //be relative to baseUrl in the end.
                if (baseName) {
                    //Convert baseName to array, and lop off the last part,
                    //so that . matches that 'directory' and not name of the baseName's
                    //module. For instance, baseName of 'one/two/three', maps to
                    //'one/two/three.js', but we want the directory, 'one/two' for
                    //this normalization.
                    normalizedBaseParts = baseParts.slice(0, baseParts.length - 1);
                    name = name.split('/');
                    lastIndex = name.length - 1;

                    // If wanting node ID compatibility, strip .js from end
                    // of IDs. Have to do this here, and not in nameToUrl
                    // because node allows either .js or non .js to map
                    // to same file.
                    if (config.nodeIdCompat && jsSuffixRegExp.test(name[lastIndex])) {
                        name[lastIndex] = name[lastIndex].replace(jsSuffixRegExp, '');
                    }

                    name = normalizedBaseParts.concat(name);
                    trimDots(name);
                    name = name.join('/');
                } else if (name.indexOf('./') === 0) {
                    // No baseName, so this is ID is resolved relative
                    // to baseUrl, pull off the leading dot.
                    name = name.substring(2);
                }
            }

            //Apply map config if available.
            if (applyMap && map && (baseParts || starMap)) {
                nameParts = name.split('/');

                outerLoop: for (i = nameParts.length; i > 0; i -= 1) {
                    nameSegment = nameParts.slice(0, i).join('/');

                    if (baseParts) {
                        //Find the longest baseName segment match in the config.
                        //So, do joins on the biggest to smallest lengths of baseParts.
                        for (j = baseParts.length; j > 0; j -= 1) {
                            mapValue = getOwn(map, baseParts.slice(0, j).join('/'));

                            //baseName segment has config, find if it has one for
                            //this name.
                            if (mapValue) {
                                mapValue = getOwn(mapValue, nameSegment);
                                if (mapValue) {
                                    //Match, update name to the new value.
                                    foundMap = mapValue;
                                    foundI = i;
                                    break outerLoop;
                                }
                            }
                        }
                    }

                    //Check for a star map match, but just hold on to it,
                    //if there is a shorter segment match later in a matching
                    //config, then favor over this star map.
                    if (!foundStarMap && starMap && getOwn(starMap, nameSegment)) {
                        foundStarMap = getOwn(starMap, nameSegment);
                        starI = i;
                    }
                }

                if (!foundMap && foundStarMap) {
                    foundMap = foundStarMap;
                    foundI = starI;
                }

                if (foundMap) {
                    nameParts.splice(0, foundI, foundMap);
                    name = nameParts.join('/');
                }
            }

            // If the name points to a package's name, use
            // the package main instead.
            pkgMain = getOwn(config.pkgs, name);

            return pkgMain ? pkgMain : name;
        }

        function removeScript(name) {
            if (isBrowser) {
                each(scripts(), function (scriptNode) {
                    if (scriptNode.getAttribute('data-requiremodule') === name &&
                            scriptNode.getAttribute('data-requirecontext') === context.contextName) {
                        scriptNode.parentNode.removeChild(scriptNode);
                        return true;
                    }
                });
            }
        }

        function hasPathFallback(id) {
            var pathConfig = getOwn(config.paths, id);
            if (pathConfig && isArray(pathConfig) && pathConfig.length > 1) {
                //Pop off the first array value, since it failed, and
                //retry
                pathConfig.shift();
                context.require.undef(id);
                context.require([id]);
                return true;
            }
        }

        //Turns a plugin!resource to [plugin, resource]
        //with the plugin being undefined if the name
        //did not have a plugin prefix.
        function splitPrefix(name) {
            var prefix,
                index = name ? name.indexOf('!') : -1;
            if (index > -1) {
                prefix = name.substring(0, index);
                name = name.substring(index + 1, name.length);
            }
            return [prefix, name];
        }

        /**
         * Creates a module mapping that includes plugin prefix, module
         * name, and path. If parentModuleMap is provided it will
         * also normalize the name via require.normalize()
         *
         * @param {String} name the module name
         * @param {String} [parentModuleMap] parent module map
         * for the module name, used to resolve relative names.
         * @param {Boolean} isNormalized: is the ID already normalized.
         * This is true if this call is done for a define() module ID.
         * @param {Boolean} applyMap: apply the map config to the ID.
         * Should only be true if this map is for a dependency.
         *
         * @returns {Object}
         */
        function makeModuleMap(name, parentModuleMap, isNormalized, applyMap) {
            var url, pluginModule, suffix, nameParts,
                prefix = null,
                parentName = parentModuleMap ? parentModuleMap.name : null,
                originalName = name,
                isDefine = true,
                normalizedName = '';

            //If no name, then it means it is a require call, generate an
            //internal name.
            if (!name) {
                isDefine = false;
                name = '_@r' + (requireCounter += 1);
            }

            nameParts = splitPrefix(name);
            prefix = nameParts[0];
            name = nameParts[1];

            if (prefix) {
                prefix = normalize(prefix, parentName, applyMap);
                pluginModule = getOwn(defined, prefix);
            }

            //Account for relative paths if there is a base name.
            if (name) {
                if (prefix) {
                    if (pluginModule && pluginModule.normalize) {
                        //Plugin is loaded, use its normalize method.
                        normalizedName = pluginModule.normalize(name, function (name) {
                            return normalize(name, parentName, applyMap);
                        });
                    } else {
                        normalizedName = normalize(name, parentName, applyMap);
                    }
                } else {
                    //A regular module.
                    normalizedName = normalize(name, parentName, applyMap);

                    //Normalized name may be a plugin ID due to map config
                    //application in normalize. The map config values must
                    //already be normalized, so do not need to redo that part.
                    nameParts = splitPrefix(normalizedName);
                    prefix = nameParts[0];
                    normalizedName = nameParts[1];
                    isNormalized = true;

                    url = context.nameToUrl(normalizedName);
                }
            }

            //If the id is a plugin id that cannot be determined if it needs
            //normalization, stamp it with a unique ID so two matching relative
            //ids that may conflict can be separate.
            suffix = prefix && !pluginModule && !isNormalized ?
                     '_unnormalized' + (unnormalizedCounter += 1) :
                     '';

            return {
                prefix: prefix,
                name: normalizedName,
                parentMap: parentModuleMap,
                unnormalized: !!suffix,
                url: url,
                originalName: originalName,
                isDefine: isDefine,
                id: (prefix ?
                        prefix + '!' + normalizedName :
                        normalizedName) + suffix
            };
        }

        function getModule(depMap) {
            var id = depMap.id,
                mod = getOwn(registry, id);

            if (!mod) {
                mod = registry[id] = new context.Module(depMap);
            }

            return mod;
        }

        function on(depMap, name, fn) {
            var id = depMap.id,
                mod = getOwn(registry, id);

            if (hasProp(defined, id) &&
                    (!mod || mod.defineEmitComplete)) {
                if (name === 'defined') {
                    fn(defined[id]);
                }
            } else {
                mod = getModule(depMap);
                if (mod.error && name === 'error') {
                    fn(mod.error);
                } else {
                    mod.on(name, fn);
                }
            }
        }

        function onError(err, errback) {
            var ids = err.requireModules,
                notified = false;

            if (errback) {
                errback(err);
            } else {
                each(ids, function (id) {
                    var mod = getOwn(registry, id);
                    if (mod) {
                        //Set error on module, so it skips timeout checks.
                        mod.error = err;
                        if (mod.events.error) {
                            notified = true;
                            mod.emit('error', err);
                        }
                    }
                });

                if (!notified) {
                    req.onError(err);
                }
            }
        }

        /**
         * Internal method to transfer globalQueue items to this context's
         * defQueue.
         */
        function takeGlobalQueue() {
            //Push all the globalDefQueue items into the context's defQueue
            if (globalDefQueue.length) {
                //Array splice in the values since the context code has a
                //local var ref to defQueue, so cannot just reassign the one
                //on context.
                apsp.apply(defQueue,
                           [defQueue.length, 0].concat(globalDefQueue));
                globalDefQueue = [];
            }
        }

        handlers = {
            'require': function (mod) {
                if (mod.require) {
                    return mod.require;
                } else {
                    return (mod.require = context.makeRequire(mod.map));
                }
            },
            'exports': function (mod) {
                mod.usingExports = true;
                if (mod.map.isDefine) {
                    if (mod.exports) {
                        return (defined[mod.map.id] = mod.exports);
                    } else {
                        return (mod.exports = defined[mod.map.id] = {});
                    }
                }
            },
            'module': function (mod) {
                if (mod.module) {
                    return mod.module;
                } else {
                    return (mod.module = {
                        id: mod.map.id,
                        uri: mod.map.url,
                        config: function () {
                            return  getOwn(config.config, mod.map.id) || {};
                        },
                        exports: mod.exports || (mod.exports = {})
                    });
                }
            }
        };

        function cleanRegistry(id) {
            //Clean up machinery used for waiting modules.
            delete registry[id];
            delete enabledRegistry[id];
        }

        function breakCycle(mod, traced, processed) {
            var id = mod.map.id;

            if (mod.error) {
                mod.emit('error', mod.error);
            } else {
                traced[id] = true;
                each(mod.depMaps, function (depMap, i) {
                    var depId = depMap.id,
                        dep = getOwn(registry, depId);

                    //Only force things that have not completed
                    //being defined, so still in the registry,
                    //and only if it has not been matched up
                    //in the module already.
                    if (dep && !mod.depMatched[i] && !processed[depId]) {
                        if (getOwn(traced, depId)) {
                            mod.defineDep(i, defined[depId]);
                            mod.check(); //pass false?
                        } else {
                            breakCycle(dep, traced, processed);
                        }
                    }
                });
                processed[id] = true;
            }
        }

        function checkLoaded() {
            var err, usingPathFallback,
                waitInterval = config.waitSeconds * 1000,
                //It is possible to disable the wait interval by using waitSeconds of 0.
                expired = waitInterval && (context.startTime + waitInterval) < new Date().getTime(),
                noLoads = [],
                reqCalls = [],
                stillLoading = false,
                needCycleCheck = true;

            //Do not bother if this call was a result of a cycle break.
            if (inCheckLoaded) {
                return;
            }

            inCheckLoaded = true;

            //Figure out the state of all the modules.
            eachProp(enabledRegistry, function (mod) {
                var map = mod.map,
                    modId = map.id;

                //Skip things that are not enabled or in error state.
                if (!mod.enabled) {
                    return;
                }

                if (!map.isDefine) {
                    reqCalls.push(mod);
                }

                if (!mod.error) {
                    //If the module should be executed, and it has not
                    //been inited and time is up, remember it.
                    if (!mod.inited && expired) {
                        if (hasPathFallback(modId)) {
                            usingPathFallback = true;
                            stillLoading = true;
                        } else {
                            noLoads.push(modId);
                            removeScript(modId);
                        }
                    } else if (!mod.inited && mod.fetched && map.isDefine) {
                        stillLoading = true;
                        if (!map.prefix) {
                            //No reason to keep looking for unfinished
                            //loading. If the only stillLoading is a
                            //plugin resource though, keep going,
                            //because it may be that a plugin resource
                            //is waiting on a non-plugin cycle.
                            return (needCycleCheck = false);
                        }
                    }
                }
            });

            if (expired && noLoads.length) {
                //If wait time expired, throw error of unloaded modules.
                err = makeError('timeout', 'Load timeout for modules: ' + noLoads, null, noLoads);
                err.contextName = context.contextName;
                return onError(err);
            }

            //Not expired, check for a cycle.
            if (needCycleCheck) {
                each(reqCalls, function (mod) {
                    breakCycle(mod, {}, {});
                });
            }

            //If still waiting on loads, and the waiting load is something
            //other than a plugin resource, or there are still outstanding
            //scripts, then just try back later.
            if ((!expired || usingPathFallback) && stillLoading) {
                //Something is still waiting to load. Wait for it, but only
                //if a timeout is not already in effect.
                if ((isBrowser || isWebWorker) && !checkLoadedTimeoutId) {
                    checkLoadedTimeoutId = setTimeout(function () {
                        checkLoadedTimeoutId = 0;
                        checkLoaded();
                    }, 50);
                }
            }

            inCheckLoaded = false;
        }

        Module = function (map) {
            this.events = getOwn(undefEvents, map.id) || {};
            this.map = map;
            this.shim = getOwn(config.shim, map.id);
            this.depExports = [];
            this.depMaps = [];
            this.depMatched = [];
            this.pluginMaps = {};
            this.depCount = 0;

            /* this.exports this.factory
               this.depMaps = [],
               this.enabled, this.fetched
            */
        };

        Module.prototype = {
            init: function (depMaps, factory, errback, options) {
                options = options || {};

                //Do not do more inits if already done. Can happen if there
                //are multiple define calls for the same module. That is not
                //a normal, common case, but it is also not unexpected.
                if (this.inited) {
                    return;
                }

                this.factory = factory;

                if (errback) {
                    //Register for errors on this module.
                    this.on('error', errback);
                } else if (this.events.error) {
                    //If no errback already, but there are error listeners
                    //on this module, set up an errback to pass to the deps.
                    errback = bind(this, function (err) {
                        this.emit('error', err);
                    });
                }

                //Do a copy of the dependency array, so that
                //source inputs are not modified. For example
                //"shim" deps are passed in here directly, and
                //doing a direct modification of the depMaps array
                //would affect that config.
                this.depMaps = depMaps && depMaps.slice(0);

                this.errback = errback;

                //Indicate this module has be initialized
                this.inited = true;

                this.ignore = options.ignore;

                //Could have option to init this module in enabled mode,
                //or could have been previously marked as enabled. However,
                //the dependencies are not known until init is called. So
                //if enabled previously, now trigger dependencies as enabled.
                if (options.enabled || this.enabled) {
                    //Enable this module and dependencies.
                    //Will call this.check()
                    this.enable();
                } else {
                    this.check();
                }
            },

            defineDep: function (i, depExports) {
                //Because of cycles, defined callback for a given
                //export can be called more than once.
                if (!this.depMatched[i]) {
                    this.depMatched[i] = true;
                    this.depCount -= 1;
                    this.depExports[i] = depExports;
                }
            },

            fetch: function () {
                if (this.fetched) {
                    return;
                }
                this.fetched = true;

                context.startTime = (new Date()).getTime();

                var map = this.map;

                //If the manager is for a plugin managed resource,
                //ask the plugin to load it now.
                if (this.shim) {
                    context.makeRequire(this.map, {
                        enableBuildCallback: true
                    })(this.shim.deps || [], bind(this, function () {
                        return map.prefix ? this.callPlugin() : this.load();
                    }));
                } else {
                    //Regular dependency.
                    return map.prefix ? this.callPlugin() : this.load();
                }
            },

            load: function () {
                var url = this.map.url;

                //Regular dependency.
                if (!urlFetched[url]) {
                    urlFetched[url] = true;
                    context.load(this.map.id, url);
                }
            },

            /**
             * Checks if the module is ready to define itself, and if so,
             * define it.
             */
            check: function () {
                if (!this.enabled || this.enabling) {
                    return;
                }

                var err, cjsModule,
                    id = this.map.id,
                    depExports = this.depExports,
                    exports = this.exports,
                    factory = this.factory;

                if (!this.inited) {
                    this.fetch();
                } else if (this.error) {
                    this.emit('error', this.error);
                } else if (!this.defining) {
                    //The factory could trigger another require call
                    //that would result in checking this module to
                    //define itself again. If already in the process
                    //of doing that, skip this work.
                    this.defining = true;

                    if (this.depCount < 1 && !this.defined) {
                        if (isFunction(factory)) {
                            //If there is an error listener, favor passing
                            //to that instead of throwing an error. However,
                            //only do it for define()'d  modules. require
                            //errbacks should not be called for failures in
                            //their callbacks (#699). However if a global
                            //onError is set, use that.
                            if ((this.events.error && this.map.isDefine) ||
                                req.onError !== defaultOnError) {
                                try {
                                    exports = context.execCb(id, factory, depExports, exports);
                                } catch (e) {
                                    err = e;
                                }
                            } else {
                                exports = context.execCb(id, factory, depExports, exports);
                            }

                            // Favor return value over exports. If node/cjs in play,
                            // then will not have a return value anyway. Favor
                            // module.exports assignment over exports object.
                            if (this.map.isDefine && exports === undefined) {
                                cjsModule = this.module;
                                if (cjsModule) {
                                    exports = cjsModule.exports;
                                } else if (this.usingExports) {
                                    //exports already set the defined value.
                                    exports = this.exports;
                                }
                            }

                            if (err) {
                                err.requireMap = this.map;
                                err.requireModules = this.map.isDefine ? [this.map.id] : null;
                                err.requireType = this.map.isDefine ? 'define' : 'require';
                                return onError((this.error = err));
                            }

                        } else {
                            //Just a literal value
                            exports = factory;
                        }

                        this.exports = exports;

                        if (this.map.isDefine && !this.ignore) {
                            defined[id] = exports;

                            if (req.onResourceLoad) {
                                req.onResourceLoad(context, this.map, this.depMaps);
                            }
                        }

                        //Clean up
                        cleanRegistry(id);

                        this.defined = true;
                    }

                    //Finished the define stage. Allow calling check again
                    //to allow define notifications below in the case of a
                    //cycle.
                    this.defining = false;

                    if (this.defined && !this.defineEmitted) {
                        this.defineEmitted = true;
                        this.emit('defined', this.exports);
                        this.defineEmitComplete = true;
                    }

                }
            },

            callPlugin: function () {
                var map = this.map,
                    id = map.id,
                    //Map already normalized the prefix.
                    pluginMap = makeModuleMap(map.prefix);

                //Mark this as a dependency for this plugin, so it
                //can be traced for cycles.
                this.depMaps.push(pluginMap);

                on(pluginMap, 'defined', bind(this, function (plugin) {
                    var load, normalizedMap, normalizedMod,
                        bundleId = getOwn(bundlesMap, this.map.id),
                        name = this.map.name,
                        parentName = this.map.parentMap ? this.map.parentMap.name : null,
                        localRequire = context.makeRequire(map.parentMap, {
                            enableBuildCallback: true
                        });

                    //If current map is not normalized, wait for that
                    //normalized name to load instead of continuing.
                    if (this.map.unnormalized) {
                        //Normalize the ID if the plugin allows it.
                        if (plugin.normalize) {
                            name = plugin.normalize(name, function (name) {
                                return normalize(name, parentName, true);
                            }) || '';
                        }

                        //prefix and name should already be normalized, no need
                        //for applying map config again either.
                        normalizedMap = makeModuleMap(map.prefix + '!' + name,
                                                      this.map.parentMap);
                        on(normalizedMap,
                            'defined', bind(this, function (value) {
                                this.init([], function () { return value; }, null, {
                                    enabled: true,
                                    ignore: true
                                });
                            }));

                        normalizedMod = getOwn(registry, normalizedMap.id);
                        if (normalizedMod) {
                            //Mark this as a dependency for this plugin, so it
                            //can be traced for cycles.
                            this.depMaps.push(normalizedMap);

                            if (this.events.error) {
                                normalizedMod.on('error', bind(this, function (err) {
                                    this.emit('error', err);
                                }));
                            }
                            normalizedMod.enable();
                        }

                        return;
                    }

                    //If a paths config, then just load that file instead to
                    //resolve the plugin, as it is built into that paths layer.
                    if (bundleId) {
                        this.map.url = context.nameToUrl(bundleId);
                        this.load();
                        return;
                    }

                    load = bind(this, function (value) {
                        this.init([], function () { return value; }, null, {
                            enabled: true
                        });
                    });

                    load.error = bind(this, function (err) {
                        this.inited = true;
                        this.error = err;
                        err.requireModules = [id];

                        //Remove temp unnormalized modules for this module,
                        //since they will never be resolved otherwise now.
                        eachProp(registry, function (mod) {
                            if (mod.map.id.indexOf(id + '_unnormalized') === 0) {
                                cleanRegistry(mod.map.id);
                            }
                        });

                        onError(err);
                    });

                    //Allow plugins to load other code without having to know the
                    //context or how to 'complete' the load.
                    load.fromText = bind(this, function (text, textAlt) {
                        /*jslint evil: true */
                        var moduleName = map.name,
                            moduleMap = makeModuleMap(moduleName),
                            hasInteractive = useInteractive;

                        //As of 2.1.0, support just passing the text, to reinforce
                        //fromText only being called once per resource. Still
                        //support old style of passing moduleName but discard
                        //that moduleName in favor of the internal ref.
                        if (textAlt) {
                            text = textAlt;
                        }

                        //Turn off interactive script matching for IE for any define
                        //calls in the text, then turn it back on at the end.
                        if (hasInteractive) {
                            useInteractive = false;
                        }

                        //Prime the system by creating a module instance for
                        //it.
                        getModule(moduleMap);

                        //Transfer any config to this other module.
                        if (hasProp(config.config, id)) {
                            config.config[moduleName] = config.config[id];
                        }

                        try {
                            req.exec(text);
                        } catch (e) {
                            return onError(makeError('fromtexteval',
                                             'fromText eval for ' + id +
                                            ' failed: ' + e,
                                             e,
                                             [id]));
                        }

                        if (hasInteractive) {
                            useInteractive = true;
                        }

                        //Mark this as a dependency for the plugin
                        //resource
                        this.depMaps.push(moduleMap);

                        //Support anonymous modules.
                        context.completeLoad(moduleName);

                        //Bind the value of that module to the value for this
                        //resource ID.
                        localRequire([moduleName], load);
                    });

                    //Use parentName here since the plugin's name is not reliable,
                    //could be some weird string with no path that actually wants to
                    //reference the parentName's path.
                    plugin.load(map.name, localRequire, load, config);
                }));

                context.enable(pluginMap, this);
                this.pluginMaps[pluginMap.id] = pluginMap;
            },

            enable: function () {
                enabledRegistry[this.map.id] = this;
                this.enabled = true;

                //Set flag mentioning that the module is enabling,
                //so that immediate calls to the defined callbacks
                //for dependencies do not trigger inadvertent load
                //with the depCount still being zero.
                this.enabling = true;

                //Enable each dependency
                each(this.depMaps, bind(this, function (depMap, i) {
                    var id, mod, handler;

                    if (typeof depMap === 'string') {
                        //Dependency needs to be converted to a depMap
                        //and wired up to this module.
                        depMap = makeModuleMap(depMap,
                                               (this.map.isDefine ? this.map : this.map.parentMap),
                                               false,
                                               !this.skipMap);
                        this.depMaps[i] = depMap;

                        handler = getOwn(handlers, depMap.id);

                        if (handler) {
                            this.depExports[i] = handler(this);
                            return;
                        }

                        this.depCount += 1;

                        on(depMap, 'defined', bind(this, function (depExports) {
                            this.defineDep(i, depExports);
                            this.check();
                        }));

                        if (this.errback) {
                            on(depMap, 'error', bind(this, this.errback));
                        }
                    }

                    id = depMap.id;
                    mod = registry[id];

                    //Skip special modules like 'require', 'exports', 'module'
                    //Also, don't call enable if it is already enabled,
                    //important in circular dependency cases.
                    if (!hasProp(handlers, id) && mod && !mod.enabled) {
                        context.enable(depMap, this);
                    }
                }));

                //Enable each plugin that is used in
                //a dependency
                eachProp(this.pluginMaps, bind(this, function (pluginMap) {
                    var mod = getOwn(registry, pluginMap.id);
                    if (mod && !mod.enabled) {
                        context.enable(pluginMap, this);
                    }
                }));

                this.enabling = false;

                this.check();
            },

            on: function (name, cb) {
                var cbs = this.events[name];
                if (!cbs) {
                    cbs = this.events[name] = [];
                }
                cbs.push(cb);
            },

            emit: function (name, evt) {
                each(this.events[name], function (cb) {
                    cb(evt);
                });
                if (name === 'error') {
                    //Now that the error handler was triggered, remove
                    //the listeners, since this broken Module instance
                    //can stay around for a while in the registry.
                    delete this.events[name];
                }
            }
        };

        function callGetModule(args) {
            //Skip modules already defined.
            if (!hasProp(defined, args[0])) {
                getModule(makeModuleMap(args[0], null, true)).init(args[1], args[2]);
            }
        }

        function removeListener(node, func, name, ieName) {
            //Favor detachEvent because of IE9
            //issue, see attachEvent/addEventListener comment elsewhere
            //in this file.
            if (node.detachEvent && !isOpera) {
                //Probably IE. If not it will throw an error, which will be
                //useful to know.
                if (ieName) {
                    node.detachEvent(ieName, func);
                }
            } else {
                node.removeEventListener(name, func, false);
            }
        }

        /**
         * Given an event from a script node, get the requirejs info from it,
         * and then removes the event listeners on the node.
         * @param {Event} evt
         * @returns {Object}
         */
        function getScriptData(evt) {
            //Using currentTarget instead of target for Firefox 2.0's sake. Not
            //all old browsers will be supported, but this one was easy enough
            //to support and still makes sense.
            var node = evt.currentTarget || evt.srcElement;

            //Remove the listeners once here.
            removeListener(node, context.onScriptLoad, 'load', 'onreadystatechange');
            removeListener(node, context.onScriptError, 'error');

            return {
                node: node,
                id: node && node.getAttribute('data-requiremodule')
            };
        }

        function intakeDefines() {
            var args;

            //Any defined modules in the global queue, intake them now.
            takeGlobalQueue();

            //Make sure any remaining defQueue items get properly processed.
            while (defQueue.length) {
                args = defQueue.shift();
                if (args[0] === null) {
                    return onError(makeError('mismatch', 'Mismatched anonymous define() module: ' + args[args.length - 1]));
                } else {
                    //args are id, deps, factory. Should be normalized by the
                    //define() function.
                    callGetModule(args);
                }
            }
        }

        context = {
            config: config,
            contextName: contextName,
            registry: registry,
            defined: defined,
            urlFetched: urlFetched,
            defQueue: defQueue,
            Module: Module,
            makeModuleMap: makeModuleMap,
            nextTick: req.nextTick,
            onError: onError,

            /**
             * Set a configuration for the context.
             * @param {Object} cfg config object to integrate.
             */
            configure: function (cfg) {
                //Make sure the baseUrl ends in a slash.
                if (cfg.baseUrl) {
                    if (cfg.baseUrl.charAt(cfg.baseUrl.length - 1) !== '/') {
                        cfg.baseUrl += '/';
                    }
                }

                //Save off the paths since they require special processing,
                //they are additive.
                var shim = config.shim,
                    objs = {
                        paths: true,
                        bundles: true,
                        config: true,
                        map: true
                    };

                eachProp(cfg, function (value, prop) {
                    if (objs[prop]) {
                        if (!config[prop]) {
                            config[prop] = {};
                        }
                        mixin(config[prop], value, true, true);
                    } else {
                        config[prop] = value;
                    }
                });

                //Reverse map the bundles
                if (cfg.bundles) {
                    eachProp(cfg.bundles, function (value, prop) {
                        each(value, function (v) {
                            if (v !== prop) {
                                bundlesMap[v] = prop;
                            }
                        });
                    });
                }

                //Merge shim
                if (cfg.shim) {
                    eachProp(cfg.shim, function (value, id) {
                        //Normalize the structure
                        if (isArray(value)) {
                            value = {
                                deps: value
                            };
                        }
                        if ((value.exports || value.init) && !value.exportsFn) {
                            value.exportsFn = context.makeShimExports(value);
                        }
                        shim[id] = value;
                    });
                    config.shim = shim;
                }

                //Adjust packages if necessary.
                if (cfg.packages) {
                    each(cfg.packages, function (pkgObj) {
                        var location, name;

                        pkgObj = typeof pkgObj === 'string' ? { name: pkgObj } : pkgObj;

                        name = pkgObj.name;
                        location = pkgObj.location;
                        if (location) {
                            config.paths[name] = pkgObj.location;
                        }

                        //Save pointer to main module ID for pkg name.
                        //Remove leading dot in main, so main paths are normalized,
                        //and remove any trailing .js, since different package
                        //envs have different conventions: some use a module name,
                        //some use a file name.
                        config.pkgs[name] = pkgObj.name + '/' + (pkgObj.main || 'main')
                                     .replace(currDirRegExp, '')
                                     .replace(jsSuffixRegExp, '');
                    });
                }

                //If there are any "waiting to execute" modules in the registry,
                //update the maps for them, since their info, like URLs to load,
                //may have changed.
                eachProp(registry, function (mod, id) {
                    //If module already has init called, since it is too
                    //late to modify them, and ignore unnormalized ones
                    //since they are transient.
                    if (!mod.inited && !mod.map.unnormalized) {
                        mod.map = makeModuleMap(id);
                    }
                });

                //If a deps array or a config callback is specified, then call
                //require with those args. This is useful when require is defined as a
                //config object before require.js is loaded.
                if (cfg.deps || cfg.callback) {
                    context.require(cfg.deps || [], cfg.callback);
                }
            },

            makeShimExports: function (value) {
                function fn() {
                    var ret;
                    if (value.init) {
                        ret = value.init.apply(global, arguments);
                    }
                    return ret || (value.exports && getGlobal(value.exports));
                }
                return fn;
            },

            makeRequire: function (relMap, options) {
                options = options || {};

                function localRequire(deps, callback, errback) {
                    var id, map, requireMod;

                    if (options.enableBuildCallback && callback && isFunction(callback)) {
                        callback.__requireJsBuild = true;
                    }

                    if (typeof deps === 'string') {
                        if (isFunction(callback)) {
                            //Invalid call
                            return onError(makeError('requireargs', 'Invalid require call'), errback);
                        }

                        //If require|exports|module are requested, get the
                        //value for them from the special handlers. Caveat:
                        //this only works while module is being defined.
                        if (relMap && hasProp(handlers, deps)) {
                            return handlers[deps](registry[relMap.id]);
                        }

                        //Synchronous access to one module. If require.get is
                        //available (as in the Node adapter), prefer that.
                        if (req.get) {
                            return req.get(context, deps, relMap, localRequire);
                        }

                        //Normalize module name, if it contains . or ..
                        map = makeModuleMap(deps, relMap, false, true);
                        id = map.id;

                        if (!hasProp(defined, id)) {
                            return onError(makeError('notloaded', 'Module name "' +
                                        id +
                                        '" has not been loaded yet for context: ' +
                                        contextName +
                                        (relMap ? '' : '. Use require([])')));
                        }
                        return defined[id];
                    }

                    //Grab defines waiting in the global queue.
                    intakeDefines();

                    //Mark all the dependencies as needing to be loaded.
                    context.nextTick(function () {
                        //Some defines could have been added since the
                        //require call, collect them.
                        intakeDefines();

                        requireMod = getModule(makeModuleMap(null, relMap));

                        //Store if map config should be applied to this require
                        //call for dependencies.
                        requireMod.skipMap = options.skipMap;

                        requireMod.init(deps, callback, errback, {
                            enabled: true
                        });

                        checkLoaded();
                    });

                    return localRequire;
                }

                mixin(localRequire, {
                    isBrowser: isBrowser,

                    /**
                     * Converts a module name + .extension into an URL path.
                     * *Requires* the use of a module name. It does not support using
                     * plain URLs like nameToUrl.
                     */
                    toUrl: function (moduleNamePlusExt) {
                        var ext,
                            index = moduleNamePlusExt.lastIndexOf('.'),
                            segment = moduleNamePlusExt.split('/')[0],
                            isRelative = segment === '.' || segment === '..';

                        //Have a file extension alias, and it is not the
                        //dots from a relative path.
                        if (index !== -1 && (!isRelative || index > 1)) {
                            ext = moduleNamePlusExt.substring(index, moduleNamePlusExt.length);
                            moduleNamePlusExt = moduleNamePlusExt.substring(0, index);
                        }

                        return context.nameToUrl(normalize(moduleNamePlusExt,
                                                relMap && relMap.id, true), ext,  true);
                    },

                    defined: function (id) {
                        return hasProp(defined, makeModuleMap(id, relMap, false, true).id);
                    },

                    specified: function (id) {
                        id = makeModuleMap(id, relMap, false, true).id;
                        return hasProp(defined, id) || hasProp(registry, id);
                    }
                });

                //Only allow undef on top level require calls
                if (!relMap) {
                    localRequire.undef = function (id) {
                        //Bind any waiting define() calls to this context,
                        //fix for #408
                        takeGlobalQueue();

                        var map = makeModuleMap(id, relMap, true),
                            mod = getOwn(registry, id);

                        removeScript(id);

                        delete defined[id];
                        delete urlFetched[map.url];
                        delete undefEvents[id];

                        //Clean queued defines too. Go backwards
                        //in array so that the splices do not
                        //mess up the iteration.
                        eachReverse(defQueue, function(args, i) {
                            if(args[0] === id) {
                                defQueue.splice(i, 1);
                            }
                        });

                        if (mod) {
                            //Hold on to listeners in case the
                            //module will be attempted to be reloaded
                            //using a different config.
                            if (mod.events.defined) {
                                undefEvents[id] = mod.events;
                            }

                            cleanRegistry(id);
                        }
                    };
                }

                return localRequire;
            },

            /**
             * Called to enable a module if it is still in the registry
             * awaiting enablement. A second arg, parent, the parent module,
             * is passed in for context, when this method is overridden by
             * the optimizer. Not shown here to keep code compact.
             */
            enable: function (depMap) {
                var mod = getOwn(registry, depMap.id);
                if (mod) {
                    getModule(depMap).enable();
                }
            },

            /**
             * Internal method used by environment adapters to complete a load event.
             * A load event could be a script load or just a load pass from a synchronous
             * load call.
             * @param {String} moduleName the name of the module to potentially complete.
             */
            completeLoad: function (moduleName) {
                var found, args, mod,
                    shim = getOwn(config.shim, moduleName) || {},
                    shExports = shim.exports;

                takeGlobalQueue();

                while (defQueue.length) {
                    args = defQueue.shift();
                    if (args[0] === null) {
                        args[0] = moduleName;
                        //If already found an anonymous module and bound it
                        //to this name, then this is some other anon module
                        //waiting for its completeLoad to fire.
                        if (found) {
                            break;
                        }
                        found = true;
                    } else if (args[0] === moduleName) {
                        //Found matching define call for this script!
                        found = true;
                    }

                    callGetModule(args);
                }

                //Do this after the cycle of callGetModule in case the result
                //of those calls/init calls changes the registry.
                mod = getOwn(registry, moduleName);

                if (!found && !hasProp(defined, moduleName) && mod && !mod.inited) {
                    if (config.enforceDefine && (!shExports || !getGlobal(shExports))) {
                        if (hasPathFallback(moduleName)) {
                            return;
                        } else {
                            return onError(makeError('nodefine',
                                             'No define call for ' + moduleName,
                                             null,
                                             [moduleName]));
                        }
                    } else {
                        //A script that does not call define(), so just simulate
                        //the call for it.
                        callGetModule([moduleName, (shim.deps || []), shim.exportsFn]);
                    }
                }

                checkLoaded();
            },

            /**
             * Converts a module name to a file path. Supports cases where
             * moduleName may actually be just an URL.
             * Note that it **does not** call normalize on the moduleName,
             * it is assumed to have already been normalized. This is an
             * internal API, not a public one. Use toUrl for the public API.
             */
            nameToUrl: function (moduleName, ext, skipExt) {
                var paths, syms, i, parentModule, url,
                    parentPath, bundleId,
                    pkgMain = getOwn(config.pkgs, moduleName);

                if (pkgMain) {
                    moduleName = pkgMain;
                }

                bundleId = getOwn(bundlesMap, moduleName);

                if (bundleId) {
                    return context.nameToUrl(bundleId, ext, skipExt);
                }

                //If a colon is in the URL, it indicates a protocol is used and it is just
                //an URL to a file, or if it starts with a slash, contains a query arg (i.e. ?)
                //or ends with .js, then assume the user meant to use an url and not a module id.
                //The slash is important for protocol-less URLs as well as full paths.
                if (req.jsExtRegExp.test(moduleName)) {
                    //Just a plain path, not module name lookup, so just return it.
                    //Add extension if it is included. This is a bit wonky, only non-.js things pass
                    //an extension, this method probably needs to be reworked.
                    url = moduleName + (ext || '');
                } else {
                    //A module that needs to be converted to a path.
                    paths = config.paths;

                    syms = moduleName.split('/');
                    //For each module name segment, see if there is a path
                    //registered for it. Start with most specific name
                    //and work up from it.
                    for (i = syms.length; i > 0; i -= 1) {
                        parentModule = syms.slice(0, i).join('/');

                        parentPath = getOwn(paths, parentModule);
                        if (parentPath) {
                            //If an array, it means there are a few choices,
                            //Choose the one that is desired
                            if (isArray(parentPath)) {
                                parentPath = parentPath[0];
                            }
                            syms.splice(0, i, parentPath);
                            break;
                        }
                    }

                    //Join the path parts together, then figure out if baseUrl is needed.
                    url = syms.join('/');
                    url += (ext || (/^data\:|\?/.test(url) || skipExt ? '' : '.js'));
                    url = (url.charAt(0) === '/' || url.match(/^[\w\+\.\-]+:/) ? '' : config.baseUrl) + url;
                }

                return config.urlArgs ? url +
                                        ((url.indexOf('?') === -1 ? '?' : '&') +
                                         config.urlArgs) : url;
            },

            //Delegates to req.load. Broken out as a separate function to
            //allow overriding in the optimizer.
            load: function (id, url) {
                req.load(context, id, url);
            },

            /**
             * Executes a module callback function. Broken out as a separate function
             * solely to allow the build system to sequence the files in the built
             * layer in the right sequence.
             *
             * @private
             */
            execCb: function (name, callback, args, exports) {
                return callback.apply(exports, args);
            },

            /**
             * callback for script loads, used to check status of loading.
             *
             * @param {Event} evt the event from the browser for the script
             * that was loaded.
             */
            onScriptLoad: function (evt) {
                //Using currentTarget instead of target for Firefox 2.0's sake. Not
                //all old browsers will be supported, but this one was easy enough
                //to support and still makes sense.
                if (evt.type === 'load' ||
                        (readyRegExp.test((evt.currentTarget || evt.srcElement).readyState))) {
                    //Reset interactive script so a script node is not held onto for
                    //to long.
                    interactiveScript = null;

                    //Pull out the name of the module and the context.
                    var data = getScriptData(evt);
                    context.completeLoad(data.id);
                }
            },

            /**
             * Callback for script errors.
             */
            onScriptError: function (evt) {
                var data = getScriptData(evt);
                if (!hasPathFallback(data.id)) {
                    return onError(makeError('scripterror', 'Script error for: ' + data.id, evt, [data.id]));
                }
            }
        };

        context.require = context.makeRequire();
        return context;
    }

    /**
     * Main entry point.
     *
     * If the only argument to require is a string, then the module that
     * is represented by that string is fetched for the appropriate context.
     *
     * If the first argument is an array, then it will be treated as an array
     * of dependency string names to fetch. An optional function callback can
     * be specified to execute when all of those dependencies are available.
     *
     * Make a local req variable to help Caja compliance (it assumes things
     * on a require that are not standardized), and to give a short
     * name for minification/local scope use.
     */
    req = requirejs = function (deps, callback, errback, optional) {

        //Find the right context, use default
        var context, config,
            contextName = defContextName;

        // Determine if have config object in the call.
        if (!isArray(deps) && typeof deps !== 'string') {
            // deps is a config object
            config = deps;
            if (isArray(callback)) {
                // Adjust args if there are dependencies
                deps = callback;
                callback = errback;
                errback = optional;
            } else {
                deps = [];
            }
        }

        if (config && config.context) {
            contextName = config.context;
        }

        context = getOwn(contexts, contextName);
        if (!context) {
            context = contexts[contextName] = req.s.newContext(contextName);
        }

        if (config) {
            context.configure(config);
        }

        return context.require(deps, callback, errback);
    };

    /**
     * Support require.config() to make it easier to cooperate with other
     * AMD loaders on globally agreed names.
     */
    req.config = function (config) {
        return req(config);
    };

    /**
     * Execute something after the current tick
     * of the event loop. Override for other envs
     * that have a better solution than setTimeout.
     * @param  {Function} fn function to execute later.
     */
    req.nextTick = typeof setTimeout !== 'undefined' ? function (fn) {
        setTimeout(fn, 4);
    } : function (fn) { fn(); };

    /**
     * Export require as a global, but only if it does not already exist.
     */
    if (!require) {
        require = req;
    }

    req.version = version;

    //Used to filter out dependencies that are already paths.
    req.jsExtRegExp = /^\/|:|\?|\.js$/;
    req.isBrowser = isBrowser;
    s = req.s = {
        contexts: contexts,
        newContext: newContext
    };

    //Create default context.
    req({});

    //Exports some context-sensitive methods on global require.
    each([
        'toUrl',
        'undef',
        'defined',
        'specified'
    ], function (prop) {
        //Reference from contexts instead of early binding to default context,
        //so that during builds, the latest instance of the default context
        //with its config gets used.
        req[prop] = function () {
            var ctx = contexts[defContextName];
            return ctx.require[prop].apply(ctx, arguments);
        };
    });

    if (isBrowser) {
        head = s.head = document.getElementsByTagName('head')[0];
        //If BASE tag is in play, using appendChild is a problem for IE6.
        //When that browser dies, this can be removed. Details in this jQuery bug:
        //http://dev.jquery.com/ticket/2709
        baseElement = document.getElementsByTagName('base')[0];
        if (baseElement) {
            head = s.head = baseElement.parentNode;
        }
    }

    /**
     * Any errors that require explicitly generates will be passed to this
     * function. Intercept/override it if you want custom error handling.
     * @param {Error} err the error object.
     */
    req.onError = defaultOnError;

    /**
     * Creates the node for the load command. Only used in browser envs.
     */
    req.createNode = function (config, moduleName, url) {
        var node = config.xhtml ?
                document.createElementNS('http://www.w3.org/1999/xhtml', 'html:script') :
                document.createElement('script');
        node.type = config.scriptType || 'text/javascript';
        node.charset = 'utf-8';
        node.async = true;
        return node;
    };

    /**
     * Does the request to load a module for the browser case.
     * Make this a separate function to allow other environments
     * to override it.
     *
     * @param {Object} context the require context to find state.
     * @param {String} moduleName the name of the module.
     * @param {Object} url the URL to the module.
     */
    req.load = function (context, moduleName, url) {
        var config = (context && context.config) || {},
            node;
        if (isBrowser) {
            //In the browser so use a script tag
            node = req.createNode(config, moduleName, url);

            node.setAttribute('data-requirecontext', context.contextName);
            node.setAttribute('data-requiremodule', moduleName);

            //Set up load listener. Test attachEvent first because IE9 has
            //a subtle issue in its addEventListener and script onload firings
            //that do not match the behavior of all other browsers with
            //addEventListener support, which fire the onload event for a
            //script right after the script execution. See:
            //https://connect.microsoft.com/IE/feedback/details/648057/script-onload-event-is-not-fired-immediately-after-script-execution
            //UNFORTUNATELY Opera implements attachEvent but does not follow the script
            //script execution mode.
            if (node.attachEvent &&
                    //Check if node.attachEvent is artificially added by custom script or
                    //natively supported by browser
                    //read https://github.com/jrburke/requirejs/issues/187
                    //if we can NOT find [native code] then it must NOT natively supported.
                    //in IE8, node.attachEvent does not have toString()
                    //Note the test for "[native code" with no closing brace, see:
                    //https://github.com/jrburke/requirejs/issues/273
                    !(node.attachEvent.toString && node.attachEvent.toString().indexOf('[native code') < 0) &&
                    !isOpera) {
                //Probably IE. IE (at least 6-8) do not fire
                //script onload right after executing the script, so
                //we cannot tie the anonymous define call to a name.
                //However, IE reports the script as being in 'interactive'
                //readyState at the time of the define call.
                useInteractive = true;

                node.attachEvent('onreadystatechange', context.onScriptLoad);
                //It would be great to add an error handler here to catch
                //404s in IE9+. However, onreadystatechange will fire before
                //the error handler, so that does not help. If addEventListener
                //is used, then IE will fire error before load, but we cannot
                //use that pathway given the connect.microsoft.com issue
                //mentioned above about not doing the 'script execute,
                //then fire the script load event listener before execute
                //next script' that other browsers do.
                //Best hope: IE10 fixes the issues,
                //and then destroys all installs of IE 6-9.
                //node.attachEvent('onerror', context.onScriptError);
            } else {
                node.addEventListener('load', context.onScriptLoad, false);
                node.addEventListener('error', context.onScriptError, false);
            }
            node.src = url;

            //For some cache cases in IE 6-8, the script executes before the end
            //of the appendChild execution, so to tie an anonymous define
            //call to the module name (which is stored on the node), hold on
            //to a reference to this node, but clear after the DOM insertion.
            currentlyAddingScript = node;
            if (baseElement) {
                head.insertBefore(node, baseElement);
            } else {
                head.appendChild(node);
            }
            currentlyAddingScript = null;

            return node;
        } else if (isWebWorker) {
            try {
                //In a web worker, use importScripts. This is not a very
                //efficient use of importScripts, importScripts will block until
                //its script is downloaded and evaluated. However, if web workers
                //are in play, the expectation that a build has been done so that
                //only one script needs to be loaded anyway. This may need to be
                //reevaluated if other use cases become common.
                importScripts(url);

                //Account for anonymous modules
                context.completeLoad(moduleName);
            } catch (e) {
                context.onError(makeError('importscripts',
                                'importScripts failed for ' +
                                    moduleName + ' at ' + url,
                                e,
                                [moduleName]));
            }
        }
    };

    function getInteractiveScript() {
        if (interactiveScript && interactiveScript.readyState === 'interactive') {
            return interactiveScript;
        }

        eachReverse(scripts(), function (script) {
            if (script.readyState === 'interactive') {
                return (interactiveScript = script);
            }
        });
        return interactiveScript;
    }

    //Look for a data-main script attribute, which could also adjust the baseUrl.
    if (isBrowser && !cfg.skipDataMain) {
        //Figure out baseUrl. Get it from the script tag with require.js in it.
        eachReverse(scripts(), function (script) {
            //Set the 'head' where we can append children by
            //using the script's parent.
            if (!head) {
                head = script.parentNode;
            }

            //Look for a data-main attribute to set main script for the page
            //to load. If it is there, the path to data main becomes the
            //baseUrl, if it is not already set.
            dataMain = script.getAttribute('data-main');
            if (dataMain) {
                //Preserve dataMain in case it is a path (i.e. contains '?')
                mainScript = dataMain;

                //Set final baseUrl if there is not already an explicit one.
                if (!cfg.baseUrl) {
                    //Pull off the directory of data-main for use as the
                    //baseUrl.
                    src = mainScript.split('/');
                    mainScript = src.pop();
                    subPath = src.length ? src.join('/')  + '/' : './';

                    cfg.baseUrl = subPath;
                }

                //Strip off any trailing .js since mainScript is now
                //like a module name.
                mainScript = mainScript.replace(jsSuffixRegExp, '');

                 //If mainScript is still a path, fall back to dataMain
                if (req.jsExtRegExp.test(mainScript)) {
                    mainScript = dataMain;
                }

                //Put the data-main script in the files to load.
                cfg.deps = cfg.deps ? cfg.deps.concat(mainScript) : [mainScript];

                return true;
            }
        });
    }

    /**
     * The function that handles definitions of modules. Differs from
     * require() in that a string for the module should be the first argument,
     * and the function to execute after dependencies are loaded should
     * return a value to define the module corresponding to the first argument's
     * name.
     */
    define = function (name, deps, callback) {
        var node, context;

        //Allow for anonymous modules
        if (typeof name !== 'string') {
            //Adjust args appropriately
            callback = deps;
            deps = name;
            name = null;
        }

        //This module may not have dependencies
        if (!isArray(deps)) {
            callback = deps;
            deps = null;
        }

        //If no name, and callback is a function, then figure out if it a
        //CommonJS thing with dependencies.
        if (!deps && isFunction(callback)) {
            deps = [];
            //Remove comments from the callback string,
            //look for require calls, and pull them into the dependencies,
            //but only if there are function args.
            if (callback.length) {
                callback
                    .toString()
                    .replace(commentRegExp, '')
                    .replace(cjsRequireRegExp, function (match, dep) {
                        deps.push(dep);
                    });

                //May be a CommonJS thing even without require calls, but still
                //could use exports, and module. Avoid doing exports and module
                //work though if it just needs require.
                //REQUIRES the function to expect the CommonJS variables in the
                //order listed below.
                deps = (callback.length === 1 ? ['require'] : ['require', 'exports', 'module']).concat(deps);
            }
        }

        //If in IE 6-8 and hit an anonymous define() call, do the interactive
        //work.
        if (useInteractive) {
            node = currentlyAddingScript || getInteractiveScript();
            if (node) {
                if (!name) {
                    name = node.getAttribute('data-requiremodule');
                }
                context = contexts[node.getAttribute('data-requirecontext')];
            }
        }

        //Always save off evaluating the def call until the script onload handler.
        //This allows multiple modules to be in a file without prematurely
        //tracing dependencies, and allows for anonymous module support,
        //where the module name is not known until the script onload event
        //occurs. If no context, use the global queue, and get it processed
        //in the onscript load callback.
        (context ? context.defQueue : globalDefQueue).push([name, deps, callback]);
    };

    define.amd = {
        jQuery: true
    };


    /**
     * Executes the text. Normally just uses eval, but can be modified
     * to use a better, environment-specific call. Only used for transpiling
     * loader plugins, not for plain JS modules.
     * @param {String} text the text to execute/evaluate.
     */
    req.exec = function (text) {
        /*jslint evil: true */
        return eval(text);
    };

    //Set up with config info.
    req(cfg);
}(this));;/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */
define('mixins', [
    'module'
], function (module) {
    'use strict';

    var contexts = require.s.contexts,
        defContextName = '_',
        defContext = contexts[defContextName],
        unbundledContext = require.s.newContext('$'),
        defaultConfig = defContext.config,
        unbundledConfig = {
            baseUrl: defaultConfig.baseUrl,
            paths: defaultConfig.paths,
            shim: defaultConfig.shim,
            config: defaultConfig.config,
            map: defaultConfig.map
        },
        rjsMixins;

    /**
     * Prepare a separate context where modules are not assigned to bundles
     * so we are able to get their true path and corresponding mixins.
     */
    unbundledContext.configure(unbundledConfig);

    /**
     * Checks if specified string contains
     * a plugin spacer '!' substring.
     *
     * @param {String} name - Name, path or alias of a module.
     * @returns {Boolean}
     */
    function hasPlugin(name) {
        return !!~name.indexOf('!');
    }

    /**
     * Adds 'mixins!' prefix to the specified string.
     *
     * @param {String} name - Name, path or alias of a module.
     * @returns {String} Modified name.
     */
    function addPlugin(name) {
        return 'mixins!' + name;
    }

    /**
     * Removes base url from the provided string.
     *
     * @param {String} url - Url to be processed.
     * @param {Object} config - Contexts' configuration object.
     * @returns {String} String without base url.
     */
    function removeBaseUrl(url, config) {
        var baseUrl = config.baseUrl || '',
            index = url.indexOf(baseUrl);

        if (~index) {
            url = url.substring(baseUrl.length - index);
        }

        return url;
    }

    /**
     * Extracts url (without baseUrl prefix)
     * from a module name ignoring the fact that it may be bundled.
     *
     * @param {String} name - Name, path or alias of a module.
     * @param {Object} config - Context's configuration.
     * @returns {String}
     */
    function getPath(name, config) {
        var url = unbundledContext.require.toUrl(name);

        return removeBaseUrl(url, config);
    }

    /**
     * Checks if specified string represents a relative path (../).
     *
     * @param {String} name - Name, path or alias of a module.
     * @returns {Boolean}
     */
    function isRelative(name) {
        return !!~name.indexOf('./');
    }

    /**
     * Iteratively calls mixins passing to them
     * current value of a 'target' parameter.
     *
     * @param {*} target - Value to be modified.
     * @param {...Function} mixins - List of mixins to apply.
     * @returns {*} Modified 'target' value.
     */
    function applyMixins(target) {
        var mixins = Array.prototype.slice.call(arguments, 1);

        mixins.forEach(function (mixin) {
            target = mixin(target);
        });

        return target;
    }

    rjsMixins = {

        /**
         * Loads specified module along with its' mixins.
         * This method is called for each module defined with "mixins!" prefix
         * in its name that was added by processNames method.
         *
         * @param {String} name - Module to be loaded.
         * @param {Function} req - Local "require" function to use to load other modules.
         * @param {Function} onLoad - A function to call with the value for name.
         * @param {Object} config - RequireJS configuration object.
         */
        load: function (name, req, onLoad, config) {
            var path     = getPath(name, config),
                mixins   = this.getMixins(path),
                deps     = [name].concat(mixins);

            req(deps, function () {
                onLoad(applyMixins.apply(null, arguments));
            });
        },

        /**
         * Retrieves list of mixins associated with a specified module.
         *
         * @param {String} path - Path to the module (without base URL).
         * @returns {Array} An array of paths to mixins.
         */
        getMixins: function (path) {
            var config = module.config() || {},
                mixins;

            // Fix for when urlArgs is set.
            if (path.indexOf('?') !== -1) {
                path = path.substring(0, path.indexOf('?'));
            }
            mixins = config[path] || {};

            return Object.keys(mixins).filter(function (mixin) {
                return mixins[mixin] !== false;
            });
        },

        /**
         * Checks if specified module has associated with it mixins.
         *
         * @param {String} path - Path to the module (without base URL).
         * @returns {Boolean}
         */
        hasMixins: function (path) {
            return this.getMixins(path).length;
        },

        /**
         * Modifies provided names prepending to them
         * the 'mixins!' plugin prefix if it's necessary.
         *
         * @param {(Array|String)} names - Module names, paths or aliases.
         * @param {Object} context - Current RequireJS context.
         * @returns {Array|String}
         */
        processNames: function (names, context) {
            var config = context.config;

            /**
             * Prepends 'mixin' plugin to a single name.
             *
             * @param {String} name
             * @returns {String}
             */
            function processName(name) {
                var path = getPath(name, config);

                if (!hasPlugin(name) && (isRelative(name) || rjsMixins.hasMixins(path))) {
                    return addPlugin(name);
                }

                return name;
            }

            return typeof names !== 'string' ?
                names.map(processName) :
                processName(names);
        }
    };

    return rjsMixins;
});

require([
    'mixins'
], function (mixins) {
    'use strict';

    var contexts = require.s.contexts,
        defContextName = '_',
        defContext = contexts[defContextName],
        originalContextRequire = defContext.require,
        processNames = mixins.processNames;

    /**
     * Wrap default context's require function which gets called every time
     * module is requested using require call. The upside of this approach
     * is that deps parameter is already normalized and guaranteed to be an array.
     */
    defContext.require = function (deps, callback, errback) {
        deps = processNames(deps, defContext);

        return originalContextRequire(deps, callback, errback);
    };

    /**
     * Copy properties of original 'require' method.
     */
    Object.keys(originalContextRequire).forEach(function (key) {
        defContext.require[key] = originalContextRequire[key];
    });

    /**
     * Wrap shift method from context's definitions queue.
     * Items are added to the queue when a new module is defined and taken
     * from it every time require call happens.
     */
    defContext.defQueue.shift = function () {
        var queueItem = Array.prototype.shift.call(this);

        queueItem[1] = processNames(queueItem[1], defContext);

        return queueItem;
    };
});
;(function(require){
(function() {
/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

var config = {
    config: {
        mixins: {
            'Magento_ReleaseNotification/js/modal/component': {
                'Magento_AdminAnalytics/js/release-notification/modal/component-mixin': true
            }
        }
    }
};

require.config(config);
})();
(function() {
/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

var config = {
    'shim': {
        'extjs/ext-tree': [
            'prototype'
        ],
        'extjs/ext-tree-checkbox': [
            'extjs/ext-tree',
            'extjs/defaults'
        ],
        'jquery/editableMultiselect/js/jquery.editable': [
            'jquery'
        ]
    },
    'bundles': {
        'js/theme': [
            'globalNavigation',
            'globalSearch',
            'modalPopup',
            'useDefault',
            'loadingPopup',
            'collapsable'
        ]
    },
    'map': {
        '*': {
            'translateInline':                    'mage/translate-inline',
            'form':                               'mage/backend/form',
            'button':                             'mage/backend/button',
            'accordion':                          'mage/accordion',
            'actionLink':                         'mage/backend/action-link',
            'validation':                         'mage/backend/validation',
            'notification':                       'mage/backend/notification',
            'loader':                             'mage/loader_old',
            'loaderAjax':                         'mage/loader_old',
            'floatingHeader':                     'mage/backend/floating-header',
            'suggest':                            'mage/backend/suggest',
            'mediabrowser':                       'jquery/jstree/jquery.jstree',
            'tabs':                               'mage/backend/tabs',
            'treeSuggest':                        'mage/backend/tree-suggest',
            'calendar':                           'mage/calendar',
            'dropdown':                           'mage/dropdown_old',
            'collapsible':                        'mage/collapsible',
            'menu':                               'mage/backend/menu',
            'jstree':                             'jquery/jstree/jquery.jstree',
            'details':                            'jquery/jquery.details',
            'jquery-ui-modules/widget':           'jquery/ui',
            'jquery-ui-modules/core':             'jquery/ui',
            'jquery-ui-modules/accordion':        'jquery/ui',
            'jquery-ui-modules/autocomplete':     'jquery/ui',
            'jquery-ui-modules/button':           'jquery/ui',
            'jquery-ui-modules/datepicker':       'jquery/ui',
            'jquery-ui-modules/dialog':           'jquery/ui',
            'jquery-ui-modules/draggable':        'jquery/ui',
            'jquery-ui-modules/droppable':        'jquery/ui',
            'jquery-ui-modules/effect-blind':     'jquery/ui',
            'jquery-ui-modules/effect-bounce':    'jquery/ui',
            'jquery-ui-modules/effect-clip':      'jquery/ui',
            'jquery-ui-modules/effect-drop':      'jquery/ui',
            'jquery-ui-modules/effect-explode':   'jquery/ui',
            'jquery-ui-modules/effect-fade':      'jquery/ui',
            'jquery-ui-modules/effect-fold':      'jquery/ui',
            'jquery-ui-modules/effect-highlight': 'jquery/ui',
            'jquery-ui-modules/effect-scale':     'jquery/ui',
            'jquery-ui-modules/effect-pulsate':   'jquery/ui',
            'jquery-ui-modules/effect-shake':     'jquery/ui',
            'jquery-ui-modules/effect-slide':     'jquery/ui',
            'jquery-ui-modules/effect-transfer':  'jquery/ui',
            'jquery-ui-modules/effect':           'jquery/ui',
            'jquery-ui-modules/menu':             'jquery/ui',
            'jquery-ui-modules/mouse':            'jquery/ui',
            'jquery-ui-modules/position':         'jquery/ui',
            'jquery-ui-modules/progressbar':      'jquery/ui',
            'jquery-ui-modules/resizable':        'jquery/ui',
            'jquery-ui-modules/selectable':       'jquery/ui',
            'jquery-ui-modules/slider':           'jquery/ui',
            'jquery-ui-modules/sortable':         'jquery/ui',
            'jquery-ui-modules/spinner':          'jquery/ui',
            'jquery-ui-modules/tabs':             'jquery/ui',
            'jquery-ui-modules/tooltip':          'jquery/ui'
        }
    },
    'deps': [
        'js/theme',
        'mage/backend/bootstrap',
        'mage/adminhtml/globals'
    ],
    'paths': {
        'jquery/ui': 'jquery/jquery-ui-1.9.2'
    }
};

require.config(config);
})();
(function() {
/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

var config = {
    'waitSeconds': 0,
    'map': {
        '*': {
            'ko': 'knockoutjs/knockout',
            'knockout': 'knockoutjs/knockout',
            'mageUtils': 'mage/utils/main',
            'rjsResolver': 'mage/requirejs/resolver'
        }
    },
    'shim': {
        'jquery/jquery-migrate': ['jquery'],
        'jquery/jstree/jquery.hotkeys': ['jquery'],
        'jquery/hover-intent': ['jquery'],
        'mage/adminhtml/backup': ['prototype'],
        'mage/captcha': ['prototype'],
        'mage/new-gallery': ['jquery'],
        'mage/webapi': ['jquery'],
        'jquery/ui': ['jquery'],
        'MutationObserver': ['es6-collections'],
        'matchMedia': {
            'exports': 'mediaCheck'
        },
        'magnifier/magnifier': ['jquery']
    },
    'paths': {
        'jquery/validate': 'jquery/jquery.validate',
        'jquery/hover-intent': 'jquery/jquery.hoverIntent',
        'jquery/file-uploader': 'jquery/fileUploader/jquery.fileuploader',
        'prototype': 'legacy-build.min',
        'jquery/jquery-storageapi': 'jquery/jquery.storageapi.min',
        'text': 'mage/requirejs/text',
        'domReady': 'requirejs/domReady',
        'spectrum': 'jquery/spectrum/spectrum',
        'tinycolor': 'jquery/spectrum/tinycolor',
        'jquery-ui-modules': 'jquery/ui-modules'
    },
    'deps': [
        'jquery/jquery-migrate'
    ],
    'config': {
        'mixins': {
            'jquery/jstree/jquery.jstree': {
                'mage/backend/jstree-mixin': true
            },
            'jquery': {
                'jquery/patches/jquery': true
            }
        },
        'text': {
            'headers': {
                'X-Requested-With': 'XMLHttpRequest'
            }
        }
    }
};

require(['jquery'], function ($) {
    'use strict';

    $.noConflict();
});

require.config(config);
})();
(function() {
/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

var config = {
    map: {
        '*': {
            'mediaUploader':  'Magento_Backend/js/media-uploader',
            'mage/translate': 'Magento_Backend/js/translate'
        }
    }
};

require.config(config);
})();
(function() {
/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

var config = {
    map: {
        '*': {
            eavInputTypes: 'Magento_Eav/js/input-types'
        }
    }
};

require.config(config);
})();
(function() {
/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

var config = {
    paths: {
        'customer/template': 'Magento_Customer/templates'
    },
    map: {
        '*': {
            addressTabs:            'Magento_Customer/edit/tab/js/addresses',
            dataItemDeleteButton:   'Magento_Customer/edit/tab/js/addresses',
            observableInputs:       'Magento_Customer/edit/tab/js/addresses'
        }
    }
};

require.config(config);
})();
(function() {
/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

var config = {
    map: {
        '*': {
            systemMessageDialog: 'Magento_AdminNotification/system/notification',
            toolbarEntry:   'Magento_AdminNotification/toolbar_entry'
        }
    }
};

require.config(config);
})();
(function() {
/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

var config = {
    map: {
        '*': {
            folderTree: 'Magento_Cms/js/folder-tree'
        }
    }
};

require.config(config);
})();
(function() {
/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

var config = {
    map: {
        '*': {
            priceBox:             'Magento_Catalog/js/price-box',
            priceOptionDate:      'Magento_Catalog/js/price-option-date',
            priceOptionFile:      'Magento_Catalog/js/price-option-file',
            priceOptions:         'Magento_Catalog/js/price-options',
            priceUtils:           'Magento_Catalog/js/price-utils'
        }
    }
};

require.config(config);
})();
(function() {
/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

var config = {
    map: {
        '*': {
            categoryForm:         'Magento_Catalog/catalog/category/form',
            newCategoryDialog:    'Magento_Catalog/js/new-category-dialog',
            categoryTree:         'Magento_Catalog/js/category-tree',
            productGallery:       'Magento_Catalog/js/product-gallery',
            baseImage:            'Magento_Catalog/catalog/base-image-uploader',
            productAttributes:    'Magento_Catalog/catalog/product-attributes',
            categoryCheckboxTree: 'Magento_Catalog/js/category-checkbox-tree'
        }
    },
    deps: [
        'Magento_Catalog/catalog/product'
    ],
    config: {
        mixins: {
            'Magento_Catalog/js/components/use-parent-settings/select': {
                'Magento_Catalog/js/components/use-parent-settings/toggle-disabled-mixin': true
            },
            'Magento_Catalog/js/components/use-parent-settings/textarea': {
                'Magento_Catalog/js/components/use-parent-settings/toggle-disabled-mixin': true
            },
            'Magento_Catalog/js/components/use-parent-settings/single-checkbox': {
                'Magento_Catalog/js/components/use-parent-settings/toggle-disabled-mixin': true
            }
        }
    }
};

require.config(config);
})();
(function() {
/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

var config = {
    map: {
        '*': {
            escaper: 'Magento_Security/js/escaper'
        }
    }
};

require.config(config);
})();
(function() {
/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

var config = {
    map: {
        '*': {
            popupWindow:            'mage/popup-window',
            confirmRedirect:        'Magento_Security/js/confirm-redirect'
        }
    }
};

require.config(config);
})();
(function() {
/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

var config = {
    map: {
        '*': {
            orderEditDialog: 'Magento_Sales/order/edit/message'
        }
    }
};

require.config(config);
})();
(function() {
/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

var config = {
    map: {
        '*': {
            rolesTree: 'Magento_User/js/roles-tree',
            deleteUserAccount: 'Magento_User/js/delete-user-account'
        }
    }
};

require.config(config);
})();
(function() {
/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

var config = {
    paths: {
        'jquery/jquery-storageapi': 'Magento_Cookie/js/jquery.storageapi.extended'
    }
};

require.config(config);
})();
(function() {
/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

var config = {
    map: {
        '*': {
            integration: 'Magento_Integration/js/integration'
        }
    }
};

require.config(config);
})();
(function() {
/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

var config = {
    map: {
        '*': {
            testConnection: 'Magento_AdvancedSearch/js/testconnection'
        }
    }
};

require.config(config);
})();
(function() {
/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

var config = {
    shim: {
        'tiny_mce_4/tinymce.min': {
            exports: 'tinyMCE'
        }
    },
    paths: {
        'ui/template': 'Magento_Ui/templates'
    },
    map: {
        '*': {
            uiElement:      'Magento_Ui/js/lib/core/element/element',
            uiCollection:   'Magento_Ui/js/lib/core/collection',
            uiComponent:    'Magento_Ui/js/lib/core/collection',
            uiClass:        'Magento_Ui/js/lib/core/class',
            uiEvents:       'Magento_Ui/js/lib/core/events',
            uiRegistry:     'Magento_Ui/js/lib/registry/registry',
            consoleLogger:  'Magento_Ui/js/lib/logger/console-logger',
            uiLayout:       'Magento_Ui/js/core/renderer/layout',
            buttonAdapter:  'Magento_Ui/js/form/button-adapter',
            tinymce4:       'tiny_mce_4/tinymce.min',
            wysiwygAdapter: 'mage/adminhtml/wysiwyg/tiny_mce/tinymce4Adapter'
        }
    }
};

require.config(config);
})();
(function() {
/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

var config = {
    map: {
        '*': {
            groupedProduct: 'Magento_GroupedProduct/js/grouped-product'
        }
    }
};

require.config(config);
})();
(function() {
/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

var config = {
    config: {
        mixins: {
            'Magento_ConfigurableProduct/js/components/dynamic-rows-configurable': {
                'Magento_InventoryConfigurableProductAdminUi/js/dynamic-rows-configurable-mixin': true
            }
        }
    }
};

require.config(config);
})();
(function() {
/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

var config = {
    map: {
        '*': {
            transparent: 'Magento_Payment/js/transparent',
            'Magento_Payment/transparent': 'Magento_Payment/js/transparent'
        }
    }
};

require.config(config);
})();
(function() {
/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

var config = {
    map: {
        '*': {
            newVideoDialog:  'Magento_ProductVideo/js/new-video-dialog',
            openVideoModal:  'Magento_ProductVideo/js/video-modal'
        }
    }
};

require.config(config);
})();
(function() {
/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

var config = {
    shim: {
        acceptjs: {
            exports: 'Accept'
        },
        acceptjssandbox: {
            exports: 'Accept'
        }
    },
    paths: {
        acceptjssandbox: 'https://jstest.authorize.net/v1/Accept',
        acceptjs: 'https://js.authorize.net/v1/Accept'
    }
};

require.config(config);
})();
(function() {
/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

var config = {
    map: {
        '*': {
            swatchesProductAttributes: 'Magento_Swatches/js/product-attributes'
        }
    }
};

require.config(config);
})();
(function() {
/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

var config = {
    shim: {
        'Magento_Tinymce3/tiny_mce/tiny_mce_src': {
            'exports': 'tinymce'
        }
    },
    map: {
        '*': {
            'tinymceDeprecated': 'Magento_Tinymce3/tiny_mce/tiny_mce_src'
        }
    }
};

require.config(config);
})();
(function() {
/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

var config = {
    map: {
        '*': {
            fptAttribute: 'Magento_Weee/js/fpt-attribute'
        }
    }
};

require.config(config);
})();
(function() {
var config = {
    'paths': {
        'fancybox': 'Dotdigitalgroup_Email/js/node_modules/fancybox/jquery.fancybox.pack'
    },
    'shim': {
        'fancybox': {
            exports: 'fancybox',
            'deps': ['jquery']
        }
    }
};

require.config(config);
})();
(function() {
/**
 * Mageplaza
 *
 * NOTICE OF LICENSE
 *
 * This source file is subject to the mageplaza.com license that is
 * available through the world-wide-web at this URL:
 * https://www.mageplaza.com/LICENSE.txt
 *
 * DISCLAIMER
 *
 * Do not edit or add to this file if you wish to upgrade this extension to newer
 * version in the future.
 *
 * @category    Mageplaza
 * @package     Mageplaza_Core
 * @copyright   Copyright (c) Mageplaza (https://www.mageplaza.com/)
 * @license     https://www.mageplaza.com/LICENSE.txt
 */

var config = {
    paths: {
        'mageplaza/core/jquery/popup': 'Mageplaza_Core/js/jquery.magnific-popup.min',
        'mageplaza/core/owl.carousel': 'Mageplaza_Core/js/owl.carousel.min',
        'mageplaza/core/bootstrap': 'Mageplaza_Core/js/bootstrap.min',
        mpIonRangeSlider: 'Mageplaza_Core/js/ion.rangeSlider.min',
        touchPunch: 'Mageplaza_Core/js/jquery.ui.touch-punch.min',
        mpDevbridgeAutocomplete: 'Mageplaza_Core/js/jquery.autocomplete.min'
    },
    shim: {
        "mageplaza/core/jquery/popup": ["jquery"],
        "mageplaza/core/owl.carousel": ["jquery"],
        "mageplaza/core/bootstrap": ["jquery"],
        mpIonRangeSlider: ["jquery"],
        mpDevbridgeAutocomplete: ["jquery"],
        touchPunch: ['jquery', 'jquery/ui']
    }
};

require.config(config);
})();
(function() {
/**
 * Mageplaza
 *
 * NOTICE OF LICENSE
 *
 * This source file is subject to the Mageplaza.com license that is
 * available through the world-wide-web at this URL:
 * https://www.mageplaza.com/LICENSE.txt
 *
 * DISCLAIMER
 *
 * Do not edit or add to this file if you wish to upgrade this extension to newer
 * version in the future.
 *
 * @category    Mageplaza
 * @package     Mageplaza_Smtp
 * @copyright   Copyright (c) Mageplaza (https://www.mageplaza.com/)
 * @license     https://www.mageplaza.com/LICENSE.txt
 */
var config = {
    paths: {
        'mageplaza/testemail': 'Mageplaza_Smtp/js/testemail',
        'mageplaza/provider': 'Mageplaza_Smtp/js/provider'
    }
};

require.config(config);
})();
(function() {
var config = {
    paths: {
        'jquery_chosen': 'Smartwave_Dailydeals/js/chosen.jquery.min'
    },
    shim: {
        'jquery_chosen': {
            deps: ['jquery']
        }
    }
};

require.config(config);
})();



})(require);;/**
 * BSS Commerce Co.
 *
 * NOTICE OF LICENSE
 *
 * This source file is subject to the EULA
 * that is bundled with this package in the file LICENSE.txt.
 * It is also available through the world-wide-web at this URL:
 * http://bsscommerce.com/Bss-Commerce-License.txt
 *
 * @category   BSS
 * @package    Bss_RefundRequest
 * @author     Extension Team
 * @copyright  Copyright (c) 2017-2018 BSS Commerce Co. ( http://bsscommerce.com )
 * @license    http://bsscommerce.com/Bss-Commerce-License.txt
 */
require([
        'jquery',
        'mage/translate',
        'jquery/validate'],
    function($){
        $.validator.addMethod(
            'validate-comma-separated-emails', function (emaillist) {
                emaillist = emaillist.trim();
                if (emaillist.charAt(0) == ',' || emaillist.charAt(emaillist.length - 1) == ',') {
                    return false;
                }
                var emails = emaillist.split(',');
                var invalidEmails = [];
                var i;
                for (i = 0; i < emails.length; i++) {
                    var email = emails[i].trim();
                    if (email.length == 0) {
                        return false
                    } else {
                        if (!Validation.get('validate-email').test(email)) {
                            invalidEmails.push(email);
                        }
                    }
                }
                if (invalidEmails.length) {
                    return false;
                }
                return true;
            },
            $.mage.__('One or more admin email has an invalid email form, xample: john@gmail.com.'));
    }
);
;require(['jquery', 'domReady!'], function ($) {
    'use strict';

    $(document).ready(function () {

        /**
         * Update url params
         * @param {String} uri
         * @param {String} key
         * @param {String} value
         * @returns {String}
         */
        function updateUrlParameter(uri, key, value) {
            var re = new RegExp('([?&])' + key + '=.*?(&|$)', 'i'),
                separator = uri.indexOf('?') !== -1 ? '&' : '?';

            if (uri.match(re)) {
                uri = uri.replace(re, '$1' + key + '=' + value + '$2');
            } else {
                uri = uri + separator + key + '=' + value;
            }

            return uri;
        }

        /**
         * Change urls
         * @param {String} value
         */
        function changeUrls(value) {
            var elmToChange =
                [
                    '#row_connector_developer_settings_sync_settings_reset_orders',
                    '#row_connector_developer_settings_sync_settings_reset_reviews',
                    '#row_connector_developer_settings_sync_settings_reset_wishlists',
                    '#row_connector_developer_settings_sync_settings_reset_catalog'
                ];

            if ($('#row_connector_developer_settings_sync_settings_reset_quotes').length) {
                elmToChange.push('#row_connector_developer_settings_sync_settings_reset_quotes');
            }

            $.each(elmToChange, function (k, v) {
                var button = $(v).find('button'),
                    str = button.attr('onclick'),
                    updatedUrl = updateUrlParameter(str, value, encodeURIComponent($('#' + value).val()));

                button.attr('onclick', updatedUrl);
            });
        }

        /**
         * Observe change on given element
         * @param {String} value
         */
        function observeChange(value) {
            $('#' + value).change(function () {
                changeUrls(value);
            });
        }

        /**
         * Init
         */
        function start() {
            var elmToObserve = ['from', 'to'];

            $.each(elmToObserve, function (key, value) {
                observeChange(value);
            });
        }

        start();
    });
});
;/*!
 * colpick Color Picker
 * https://github.com/mrgrain/colpick
 *
 * Copyright 2013, 2015 Moritz Kornher, Jose Vargas, Stefan Petre
 * Released under the MIT license and GPLv2 license
 * https://github.com/mrgrain/colpick/blob/master/LICENSE
 */
require(['jquery'], (function ($) {
    var colpick = function () {
        var
            tpl = '<div class="colpick"><div class="colpick_color"><div class="colpick_color_overlay1"><div class="colpick_color_overlay2"><div class="colpick_selector_outer"><div class="colpick_selector_inner"></div></div></div></div></div><div class="colpick_hue"><div class="colpick_hue_arrs"><div class="colpick_hue_larr"></div><div class="colpick_hue_rarr"></div></div></div><div class="colpick_new_color"></div><div class="colpick_current_color"></div><div class="colpick_hex_field"><div class="colpick_field_letter">#</div><input type="text" maxlength="6" size="6" /></div><div class="colpick_rgb_r colpick_field"><div class="colpick_field_letter">R</div><input type="text" maxlength="3" size="3" /><div class="colpick_field_arrs"><div class="colpick_field_uarr"></div><div class="colpick_field_darr"></div></div></div><div class="colpick_rgb_g colpick_field"><div class="colpick_field_letter">G</div><input type="text" maxlength="3" size="3" /><div class="colpick_field_arrs"><div class="colpick_field_uarr"></div><div class="colpick_field_darr"></div></div></div><div class="colpick_rgb_b colpick_field"><div class="colpick_field_letter">B</div><input type="text" maxlength="3" size="3" /><div class="colpick_field_arrs"><div class="colpick_field_uarr"></div><div class="colpick_field_darr"></div></div></div><div class="colpick_hsb_h colpick_field"><div class="colpick_field_letter">H</div><input type="text" maxlength="3" size="3" /><div class="colpick_field_arrs"><div class="colpick_field_uarr"></div><div class="colpick_field_darr"></div></div></div><div class="colpick_hsb_s colpick_field"><div class="colpick_field_letter">S</div><input type="text" maxlength="3" size="3" /><div class="colpick_field_arrs"><div class="colpick_field_uarr"></div><div class="colpick_field_darr"></div></div></div><div class="colpick_hsb_b colpick_field"><div class="colpick_field_letter">B</div><input type="text" maxlength="3" size="3" /><div class="colpick_field_arrs"><div class="colpick_field_uarr"></div><div class="colpick_field_darr"></div></div></div><div class="colpick_submit"></div></div>',
            defaults = {
                showEvent: 'click',
                onShow: function () {
                },
                onBeforeShow: function () {
                },
                onHide: function () {
                },
                onChange: function () {
                },
                onSubmit: function () {
                },
                colorScheme: 'light',
                color: 'auto',
                livePreview: true,
                flat: false,
                layout: 'full',
                submit: 1,
                submitText: 'OK',
                height: 156,
                polyfill: false,
                styles: false
            },
        //Fill the inputs of the plugin
            fillRGBFields = function (hsb, cal) {
                var rgb = hsbToRgb(hsb);
                $(cal).data('colpick').fields
                    .eq(1).val(rgb.r).end()
                    .eq(2).val(rgb.g).end()
                    .eq(3).val(rgb.b).end();
            },
            fillHSBFields = function (hsb, cal) {
                $(cal).data('colpick').fields
                    .eq(4).val(Math.round(hsb.h)).end()
                    .eq(5).val(Math.round(hsb.s)).end()
                    .eq(6).val(Math.round(hsb.b)).end();
            },
            fillHexFields = function (hsb, cal) {
                $(cal).data('colpick').fields.eq(0).val(hsbToHex(hsb));
            },
        //Set the round selector position
            setSelector = function (hsb, cal) {
                $(cal).data('colpick').selector.css('backgroundColor', '#' + hsbToHex({h: hsb.h, s: 100, b: 100}));
                $(cal).data('colpick').selectorIndic.css({
                    left: parseInt($(cal).data('colpick').height * hsb.s / 100, 10),
                    top: parseInt($(cal).data('colpick').height * (100 - hsb.b) / 100, 10)
                });
            },
        //Set the hue selector position
            setHue = function (hsb, cal) {
                $(cal).data('colpick').hue.css('top', parseInt($(cal).data('colpick').height - $(cal).data('colpick').height * hsb.h / 360, 10));
            },
        //Set current and new colors
            setCurrentColor = function (hsb, cal) {
                $(cal).data('colpick').currentColor.css('backgroundColor', '#' + hsbToHex(hsb));
            },
            setNewColor = function (hsb, cal) {
                $(cal).data('colpick').newColor.css('backgroundColor', '#' + hsbToHex(hsb));
            },
        //Called when the new color is changed
            change = function () {
                var cal = $(this).parent().parent(), col;
                if (this.parentNode.className.indexOf('_hex') > 0) {
                    cal.data('colpick').color = col = hexToHsb(fixHex(this.value));
                    fillRGBFields(col, cal.get(0));
                    fillHSBFields(col, cal.get(0));
                } else if (this.parentNode.className.indexOf('_hsb') > 0) {
                    cal.data('colpick').color = col = fixHSB({
                        h: parseInt(cal.data('colpick').fields.eq(4).val(), 10),
                        s: parseInt(cal.data('colpick').fields.eq(5).val(), 10),
                        b: parseInt(cal.data('colpick').fields.eq(6).val(), 10)
                    });
                    fillRGBFields(col, cal.get(0));
                    fillHexFields(col, cal.get(0));
                } else {
                    cal.data('colpick').color = col = rgbToHsb(fixRGB({
                        r: parseInt(cal.data('colpick').fields.eq(1).val(), 10),
                        g: parseInt(cal.data('colpick').fields.eq(2).val(), 10),
                        b: parseInt(cal.data('colpick').fields.eq(3).val(), 10)
                    }));
                    fillHexFields(col, cal.get(0));
                    fillHSBFields(col, cal.get(0));
                }
                setSelector(col, cal.get(0));
                setHue(col, cal.get(0));
                setNewColor(col, cal.get(0));
                cal.data('colpick').onChange.apply(cal.parent(), [col, hsbToHex(col), hsbToRgb(col), cal.data('colpick').el, 0]);
            },
        //Change style on blur and on focus of inputs
            blur = function () {
                $(this).parent().removeClass('colpick_focus');
            },
            focus = function () {
                $(this).parent().parent().data('colpick').fields.parent().removeClass('colpick_focus');
                $(this).parent().addClass('colpick_focus');
            },
        //Increment/decrement arrows functions
            downIncrement = function (ev) {
                ev.preventDefault ? ev.preventDefault() : ev.returnValue = false;
                var field = $(this).parent().find('input').focus();
                var current = {
                    el: $(this).parent().addClass('colpick_slider'),
                    max: this.parentNode.className.indexOf('_hsb_h') > 0 ? 360 : (this.parentNode.className.indexOf('_hsb') > 0 ? 100 : 255),
                    y: ev.pageY,
                    field: field,
                    val: parseInt(field.val(), 10),
                    preview: $(this).parent().parent().data('colpick').livePreview
                };
                $(document).mouseup(current, upIncrement);
                $(document).mousemove(current, moveIncrement);
            },
            moveIncrement = function (ev) {
                ev.data.field.val(Math.max(0, Math.min(ev.data.max, parseInt(ev.data.val - ev.pageY + ev.data.y, 10))));
                if (ev.data.preview) {
                    change.apply(ev.data.field.get(0), [true]);
                }
                return false;
            },
            upIncrement = function (ev) {
                change.apply(ev.data.field.get(0), [true]);
                ev.data.el.removeClass('colpick_slider').find('input').focus();
                $(document).off('mouseup', upIncrement);
                $(document).off('mousemove', moveIncrement);
                return false;
            },
        //Hue slider functions
            downHue = function (ev) {
                ev.preventDefault ? ev.preventDefault() : ev.returnValue = false;
                var current = {
                    cal: $(this).parent(),
                    y: $(this).offset().top
                };
                $(document).on('mouseup touchend', current, upHue);
                $(document).on('mousemove touchmove', current, moveHue);

                var pageY = ((ev.type == 'touchstart') ? ev.originalEvent.changedTouches[0].pageY : ev.pageY );
                change.apply(
                    current.cal.data('colpick')
                        .fields.eq(4).val(parseInt(360 * (current.cal.data('colpick').height - (pageY - current.y)) / current.cal.data('colpick').height, 10))
                        .get(0),
                    [current.cal.data('colpick').livePreview]
                );
                return false;
            },
            moveHue = function (ev) {
                var pageY = ((ev.type == 'touchmove') ? ev.originalEvent.changedTouches[0].pageY : ev.pageY );
                change.apply(
                    ev.data.cal.data('colpick')
                        .fields.eq(4).val(parseInt(360 * (ev.data.cal.data('colpick').height - Math.max(0, Math.min(ev.data.cal.data('colpick').height, (pageY - ev.data.y)))) / ev.data.cal.data('colpick').height, 10))
                        .get(0),
                    [ev.data.preview]
                );
                return false;
            },
            upHue = function (ev) {
                fillRGBFields(ev.data.cal.data('colpick').color, ev.data.cal.get(0));
                fillHexFields(ev.data.cal.data('colpick').color, ev.data.cal.get(0));
                $(document).off('mouseup touchend', upHue);
                $(document).off('mousemove touchmove', moveHue);
                return false;
            },
        //Color selector functions
            downSelector = function (ev) {
                ev.preventDefault ? ev.preventDefault() : ev.returnValue = false;
                var current = {
                    cal: $(this).parent(),
                    pos: $(this).offset()
                };
                current.preview = current.cal.data('colpick').livePreview;

                $(document).on('mouseup touchend', current, upSelector);
                $(document).on('mousemove touchmove', current, moveSelector);

                var pageX, pageY;
                if (ev.type == 'touchstart') {
                    pageX = ev.originalEvent.changedTouches[0].pageX;
                    pageY = ev.originalEvent.changedTouches[0].pageY;
                } else {
                    pageX = ev.pageX;
                    pageY = ev.pageY;
                }

                change.apply(
                    current.cal.data('colpick').fields
                        .eq(6).val(parseInt(100 * (current.cal.data('colpick').height - (pageY - current.pos.top)) / current.cal.data('colpick').height, 10)).end()
                        .eq(5).val(parseInt(100 * (pageX - current.pos.left) / current.cal.data('colpick').height, 10))
                        .get(0),
                    [current.preview]
                );
                return false;
            },
            moveSelector = function (ev) {
                var pageX, pageY;
                if (ev.type == 'touchmove') {
                    pageX = ev.originalEvent.changedTouches[0].pageX;
                    pageY = ev.originalEvent.changedTouches[0].pageY;
                } else {
                    pageX = ev.pageX;
                    pageY = ev.pageY;
                }

                change.apply(
                    ev.data.cal.data('colpick').fields
                        .eq(6).val(parseInt(100 * (ev.data.cal.data('colpick').height - Math.max(0, Math.min(ev.data.cal.data('colpick').height, (pageY - ev.data.pos.top)))) / ev.data.cal.data('colpick').height, 10)).end()
                        .eq(5).val(parseInt(100 * (Math.max(0, Math.min(ev.data.cal.data('colpick').height, (pageX - ev.data.pos.left)))) / ev.data.cal.data('colpick').height, 10))
                        .get(0),
                    [ev.data.preview]
                );
                return false;
            },
            upSelector = function (ev) {
                fillRGBFields(ev.data.cal.data('colpick').color, ev.data.cal.get(0));
                fillHexFields(ev.data.cal.data('colpick').color, ev.data.cal.get(0));
                $(document).off('mouseup touchend', upSelector);
                $(document).off('mousemove touchmove', moveSelector);
                return false;
            },
        //Submit button
            clickSubmit = function () {
                var cal = $(this).parent();
                var col = cal.data('colpick').color;
                cal.data('colpick').origColor = col;
                setCurrentColor(col, cal.get(0));
                cal.data('colpick').onSubmit(col, hsbToHex(col), hsbToRgb(col), cal.data('colpick').el);
            },
        //Show/hide the color picker
            show = function (ev) {
                if (ev) {
                    // Prevent the trigger of any direct parent
                    ev.stopPropagation();
                }
                var cal = $('#' + $(this).data('colpickId'));
                if (ev && !cal.data('colpick').polyfill) {
                    ev.preventDefault();
                }
                cal.data('colpick').onBeforeShow.apply(this, [cal.get(0)]);
                var pos = $(this).offset();
                var top = pos.top + this.offsetHeight;
                var left = pos.left;
                var viewPort = getViewport();
                var calW = cal.width();
                if (left + calW > viewPort.l + viewPort.w) {
                    left -= calW;
                }
                cal.css({left: left + 'px', top: top + 'px'});
                if (cal.data('colpick').onShow.apply(this, [cal.get(0)]) != false) {
                    cal.show();
                }
                //Hide when user clicks outside
                $('html').mousedown({cal: cal}, hide);
                cal.mousedown(function (ev) {
                    ev.stopPropagation();
                })
            },
            hide = function (ev) {
                var cal = $('#' + $(this).data('colpickId'));
                if (ev) {
                    cal = ev.data.cal;
                }
                if (cal.data('colpick').onHide.apply(this, [cal.get(0)]) != false) {
                    cal.hide();
                }
                $('html').off('mousedown', hide);
            },
            getViewport = function () {
                var m = document.compatMode == 'CSS1Compat';
                return {
                    l: window.pageXOffset || (m ? document.documentElement.scrollLeft : document.body.scrollLeft),
                    w: window.innerWidth || (m ? document.documentElement.clientWidth : document.body.clientWidth)
                };
            },
        //Fix the values if the user enters a negative or high value
            fixHSB = function (hsb) {
                return {
                    h: Math.min(360, Math.max(0, hsb.h)),
                    s: Math.min(100, Math.max(0, hsb.s)),
                    b: Math.min(100, Math.max(0, hsb.b))
                };
            },
            fixRGB = function (rgb) {
                return {
                    r: Math.min(255, Math.max(0, rgb.r)),
                    g: Math.min(255, Math.max(0, rgb.g)),
                    b: Math.min(255, Math.max(0, rgb.b))
                };
            },
            fixHex = function (hex) {
                var len = 6 - hex.length;
                if (len == 3) {
                    var e = [];
                    for (var j = 0; j < len; j++) {
                        e.push(hex[j]);
                        e.push(hex[j]);
                    }
                    hex = e.join('');
                } else {
                    if (len > 0) {
                        var o = [];
                        for (var i = 0; i < len; i++) {
                            o.push('0');
                        }
                        o.push(hex);
                        hex = o.join('');
                    }
                }
                return hex;
            },
            restoreOriginal = function () {
                var cal = $(this).parent();
                var col = cal.data('colpick').origColor;
                cal.data('colpick').color = col;
                fillRGBFields(col, cal.get(0));
                fillHexFields(col, cal.get(0));
                fillHSBFields(col, cal.get(0));
                setSelector(col, cal.get(0));
                setHue(col, cal.get(0));
                setNewColor(col, cal.get(0));
            };
        return {
            init: function (opt) {
                opt = $.extend({}, defaults, opt || {});
                //Set color
                if (opt.color === 'auto') {
                } else if (typeof opt.color == 'string') {
                    opt.color = hexToHsb(opt.color);
                } else if (opt.color.r != undefined && opt.color.g != undefined && opt.color.b != undefined) {
                    opt.color = rgbToHsb(opt.color);
                } else if (opt.color.h != undefined && opt.color.s != undefined && opt.color.b != undefined) {
                    opt.color = fixHSB(opt.color);
                } else {
                    return this;
                }

                //For each selected DOM element
                return this.each(function () {
                    //If the element does not have an ID
                    if (!$(this).data('colpickId')) {
                        var options = $.extend({}, opt);
                        //Color
                        if (opt.color === 'auto') {
                            options.color = $(this).val() ? hexToHsb($(this).val()) : {h: 0, s: 0, b: 0};
                        }
                        options.origColor = options.color;

                        //Polyfill
                        if (typeof opt.polyfill == 'function') {
                            options.polyfill = opt.polyfill(this);
                        }
                        if (options.polyfill && $(this).is('input') && this.type === "color") {
                            return;
                        }

                        //Generate and assign a random ID
                        var id = 'collorpicker_' + parseInt(Math.random() * 1000);
                        $(this).data('colpickId', id);
                        //Set the tpl's ID and get the HTML
                        var cal = $(tpl).attr('id', id);
                        //Add class according to layout
                        cal.addClass('colpick_' + options.layout + (options.submit ? '' : ' colpick_' + options.layout + '_ns'));
                        //Add class if the color scheme is not default
                        if (options.colorScheme != 'light') {
                            cal.addClass('colpick_' + options.colorScheme);
                        }
                        //Setup submit button
                        cal.find('div.colpick_submit').html(options.submitText).click(clickSubmit);
                        //Setup input fields
                        options.fields = cal.find('input').change(change).blur(blur).focus(focus);
                        cal.find('div.colpick_field_arrs').mousedown(downIncrement).end().find('div.colpick_current_color').click(restoreOriginal);
                        //Setup hue selector
                        options.selector = cal.find('div.colpick_color').on('mousedown touchstart', downSelector);
                        options.selectorIndic = options.selector.find('div.colpick_selector_outer');
                        //Store parts of the plugin
                        options.el = this;
                        options.hue = cal.find('div.colpick_hue_arrs');
                        var huebar = options.hue.parent();
                        //Paint the hue bar
                        var UA = navigator.userAgent.toLowerCase();
                        var isIE = navigator.appName === 'Microsoft Internet Explorer';
                        var IEver = isIE ? parseFloat(UA.match(/msie ([0-9]*[\.0-9]+)/)[1]) : 0;
                        var ngIE = ( isIE && IEver < 10 );
                        var stops = ['#ff0000', '#ff0080', '#ff00ff', '#8000ff', '#0000ff', '#0080ff', '#00ffff', '#00ff80', '#00ff00', '#80ff00', '#ffff00', '#ff8000', '#ff0000'];
                        if (ngIE) {
                            var i, div;
                            for (i = 0; i <= 11; i++) {
                                div = $('<div></div>').attr('style', 'height:8.333333%; filter:progid:DXImageTransform.Microsoft.gradient(GradientType=0,startColorstr=' + stops[i] + ', endColorstr=' + stops[i + 1] + '); -ms-filter: "progid:DXImageTransform.Microsoft.gradient(GradientType=0,startColorstr=' + stops[i] + ', endColorstr=' + stops[i + 1] + ')";');
                                huebar.append(div);
                            }
                        } else {
                            var stopList = stops.join(',');
                            huebar.attr('style', 'background:-webkit-linear-gradient(top,' + stopList + '); background: -o-linear-gradient(top,' + stopList + '); background: -ms-linear-gradient(top,' + stopList + '); background:-moz-linear-gradient(top,' + stopList + '); -webkit-linear-gradient(top,' + stopList + '); background:linear-gradient(to bottom,' + stopList + '); ');
                        }
                        cal.find('div.colpick_hue').on('mousedown touchstart', downHue);
                        options.newColor = cal.find('div.colpick_new_color');
                        options.currentColor = cal.find('div.colpick_current_color');
                        //Store options and fill with default color
                        cal.data('colpick', options);
                        fillRGBFields(options.color, cal.get(0));
                        fillHSBFields(options.color, cal.get(0));
                        fillHexFields(options.color, cal.get(0));
                        setHue(options.color, cal.get(0));
                        setSelector(options.color, cal.get(0));
                        setCurrentColor(options.color, cal.get(0));
                        setNewColor(options.color, cal.get(0));
                        //Append to body if flat=false, else show in place
                        if (options.flat) {
                            cal.appendTo(options.appendTo || this).show();
                            cal.css(options.styles || {
                                position: 'relative',
                                display: 'block'
                            });
                        } else {
                            cal.appendTo(options.appendTo || document.body);
                            $(this).on(options.showEvent, show);
                            cal.css(options.styles || {
                                position: 'absolute'
                            });
                        }
                    }
                });
            },
            //Shows the picker
            showPicker: function () {
                return this.each(function () {
                    if ($(this).data('colpickId')) {
                        show.apply(this);
                    }
                });
            },
            //Hides the picker
            hidePicker: function () {
                return this.each(function () {
                    if ($(this).data('colpickId')) {
                        hide.apply(this);
                    }
                });
            },
            //Sets a color as new and current (default)
            setColor: function (col, setCurrent) {
                setCurrent = (typeof setCurrent === "undefined") ? 1 : setCurrent;
                if (typeof col == 'string') {
                    col = hexToHsb(col);
                } else if (col.r != undefined && col.g != undefined && col.b != undefined) {
                    col = rgbToHsb(col);
                } else if (col.h != undefined && col.s != undefined && col.b != undefined) {
                    col = fixHSB(col);
                } else {
                    return this;
                }
                return this.each(function () {
                    if ($(this).data('colpickId')) {
                        var cal = $('#' + $(this).data('colpickId'));
                        cal.data('colpick').color = col;
                        cal.data('colpick').origColor = col;
                        fillRGBFields(col, cal.get(0));
                        fillHSBFields(col, cal.get(0));
                        fillHexFields(col, cal.get(0));
                        setHue(col, cal.get(0));
                        setSelector(col, cal.get(0));

                        setNewColor(col, cal.get(0));
                        cal.data('colpick').onChange.apply(cal.parent(), [col, hsbToHex(col), hsbToRgb(col), cal.data('colpick').el, 1]);
                        if (setCurrent) {
                            setCurrentColor(col, cal.get(0));
                        }
                    }
                });
            },
            destroy: function () {
                $('#' + $(this).data('colpickId')).remove();
            }
        };
    }();
    //Color space conversions
    var hexToRgb = function (hex) {
        hex = parseInt(((hex.indexOf('#') > -1) ? hex.substring(1) : hex), 16);
        return {r: hex >> 16, g: (hex & 0x00FF00) >> 8, b: (hex & 0x0000FF)};
    };
    var hexToHsb = function (hex) {
        return rgbToHsb(hexToRgb(hex));
    };
    var rgbToHsb = function (rgb) {
        var hsb = {h: 0, s: 0, b: 0};
        var min = Math.min(rgb.r, rgb.g, rgb.b);
        var max = Math.max(rgb.r, rgb.g, rgb.b);
        var delta = max - min;
        hsb.b = max;
        hsb.s = max != 0 ? 255 * delta / max : 0;
        if (hsb.s != 0) {
            if (rgb.r == max) {
hsb.h = (rgb.g - rgb.b) / delta;
            } else if (rgb.g == max) {
hsb.h = 2 + (rgb.b - rgb.r) / delta;
            } else {
hsb.h = 4 + (rgb.r - rgb.g) / delta;
            }
        } else {
hsb.h = -1;
        }
        hsb.h *= 60;
        if (hsb.h < 0) {
hsb.h += 360;
        }
        hsb.s *= 100 / 255;
        hsb.b *= 100 / 255;
        return hsb;
    };
    var hsbToRgb = function (hsb) {
        var rgb = {};
        var h = hsb.h;
        var s = hsb.s * 255 / 100;
        var v = hsb.b * 255 / 100;
        if (s == 0) {
            rgb.r = rgb.g = rgb.b = v;
        } else {
            var t1 = v;
            var t2 = (255 - s) * v / 255;
            var t3 = (t1 - t2) * (h % 60) / 60;
            if (h == 360) {
h = 0;
            }
            if (h < 60) {
                rgb.r = t1;
                rgb.b = t2;
                rgb.g = t2 + t3
            } else if (h < 120) {
                rgb.g = t1;
                rgb.b = t2;
                rgb.r = t1 - t3
            } else if (h < 180) {
                rgb.g = t1;
                rgb.r = t2;
                rgb.b = t2 + t3
            } else if (h < 240) {
                rgb.b = t1;
                rgb.r = t2;
                rgb.g = t1 - t3
            } else if (h < 300) {
                rgb.b = t1;
                rgb.g = t2;
                rgb.r = t2 + t3
            } else if (h < 360) {
                rgb.r = t1;
                rgb.g = t2;
                rgb.b = t1 - t3
            } else {
                rgb.r = 0;
                rgb.g = 0;
                rgb.b = 0
            }
        }
        return {r: Math.round(rgb.r), g: Math.round(rgb.g), b: Math.round(rgb.b)};
    };
    var rgbToHex = function (rgb) {
        var hex = [
            rgb.r.toString(16),
            rgb.g.toString(16),
            rgb.b.toString(16)
        ];
        $.each(hex, function (nr, val) {
            if (val.length == 1) {
                hex[nr] = '0' + val;
            }
        });
        return hex.join('');
    };
    var hsbToHex = function (hsb) {
        return rgbToHex(hsbToRgb(hsb));
    };
    $.fn.extend({
        colpick: colpick.init,
        colpickHide: colpick.hidePicker,
        colpickShow: colpick.showPicker,
        colpickSetColor: colpick.setColor,
        colpickDestroy: colpick.destroy
    });
    $.extend({
        colpick: {
            rgbToHex: rgbToHex,
            rgbToHsb: rgbToHsb,
            hsbToHex: hsbToHex,
            hsbToRgb: hsbToRgb,
            hexToHsb: hexToHsb,
            hexToRgb: hexToRgb
        }
    });
}));
;require(['jquery', 'domReady!'], function ($) {
    'use strict';

    $('.ddg-colpicker').colpick({
        /**
         * @param {String} hsb
         * @param {String} hex
         * @param {String} rgb
         * @param {String} el
         */
        onChange: function (hsb, hex, rgb, el) {
            $(el).val('#' + hex);
        }
    });
});
;require(['jquery', 'jquery/ui', 'domReady!'], function ($) {
    'use strict';

    var el = $('.ddg-datepicker');

    el.datepicker({
        dateFormat: 'yy-mm-dd'
    });
    el.addClass('datepicker');
});
;require(['jquery', 'fancybox', 'domReady!'], function ($) {
    'use strict';

    var fb = $('.ddg-fancyBox');

    if (fb && fb !== null) {
        fb.fancybox({
            width: 508,
            height: 670,
            scrolling: 'no',
            hideOnOverlayClick: false,
            helpers: {
                overlay: {
                    closeClick: false
                }
            }
        });

        $(document).on('click', 'a.fancybox-close', function () {
            location.reload();
        });

        window.addEventListener('message', function (event) {
            if (event.origin !== 'https://magentosignup.dotmailer.com') {
                return;
            }

            if (event.data === 'close') {
                location.reload();
            }
        });
    }
});
;require([
    'jquery',
    'Magento_Ui/js/modal/confirm',
    'mage/translate',
    'domReady!'
], function ($, confirmation, $t) {
    'use strict';

    /**
     * Show confirmation widget
     * @param {Object} element
     */
    function showConfirmation(element) {
        var content;

        if (element.attr('id') === 'sync_settings_addressbook_allow_non_subscribers') {
            content = $t('You are about to allow dotdigital to import customers that haven\'t explicitly opted into your emails. This means Customers and Guests address book will contain contacts that you might not be able to reach out, depending on the applicable regulations. Do you wish to continue?');
        } else {
            content = $t('You are about to enable this feature for customers that haven\'t explicitly opted into your emails. Do you wish to continue?');
        }

        confirmation({
            title: $('label[for=' + element.attr('id') + '] span').text(),
            content: content,
            actions: {
                /**
                 * Confirm.
                 */
                confirm: function () {
                    element.val(1);
                },
                /**
                 * Reset.
                 */
                cancel: function () {
                    element.val(0);
                }
            }
        });
    }

    /**
     * Init function
     */
    function init() {
        var elements = [
            $('#connector_automation_review_settings_allow_non_subscribers'),
            $('#connector_configuration_abandoned_carts_allow_non_subscribers'),
            $('#sync_settings_addressbook_allow_non_subscribers')
        ];

        $.each(elements, function (index, element) {
            $(element).on('change', function () {
                if (element.val() === '1') {
                    showConfirmation(element);
                }
            });
        });
    }

    //initialise
    init();
});
;require(['jquery',
    'jquery/ui',
    'domReady!',
    'mage/translate'], function ($) {
    'use strict';

    function removeTooltip(element)
    {
        element.css('position','');
        $('.ddg-tooltip').remove();
    }

    function addTooltip(toolTipText,element)
    {
        var $toolTip = $('<div class="ddg-tooltip">' + toolTipText + '</div>');
        $toolTip.css({
            position: 'absolute',
            top: '-15px',
            backgroundColor: '#333',
            color: '#fff',
            padding: '5px',
            borderRadius: '5px'
        });

        element.attr('data-title', toolTipText);
        element.css('backgroundColor', '#fff')
            .parent()
            .css('position', 'relative')
            .append($toolTip);
    }

    $(document).on('click', '.ddg-dynamic-content', function() {
        if ($(this).val() == '') return;

        var toolTipText = $.mage.__('Copied!');

        $(this).select();
        removeTooltip($(this));
        addTooltip(toolTipText,$(this));

        setTimeout(function() {
            removeTooltip($(this));
        }.bind(this), 850);

        document.execCommand("copy");
    });

    $(document).on('mouseenter', '.ddg-dynamic-content', function() {
        if ($(this).val() == '') return;

        var toolTipText = $.mage.__('Click to copy URL');
        addTooltip(toolTipText,$(this));
    });
    $(document).on('mouseleave', '.ddg-dynamic-content', function() {
        removeTooltip($(this));
    });
});

;require(['jquery',
    'jquery/ui',
    'domReady!',
    'mage/translate'], function ($) {
    'use strict';

    /**
     * Removes The Tooltip
     * @param element
     */
    function removeTooltip(element)
    {
        element.css('position','');
        $('.ddg-tooltip').remove();
    }

    /**
     * Adds the tooltip
     * @param toolTipText
     * @param element
     */
    function addTooltip(toolTipText,element)
    {
        element.attr('data-title', toolTipText);
        element.parent().append("<div class='ddg-tooltip'>" + toolTipText + "</div>");
        element.parent().css('position','relative');
    }

    $('.ddg-disabled-button').hover(function() {
            var toolTipText = $.mage.__('Your API credentials are not set. Please make sure that you have a valid Engagement Cloud account.');

            $(this).attr('onClick', '#');
            addTooltip(toolTipText, $(this));
        }
        ,function() {
            removeTooltip($(this));
        }
    );
});
;/**
 * jscolor - JavaScript Color Picker
 *
 * @link    http://jscolor.com
 * @license For open source use: GPLv3
 *          For commercial use: JSColor Commercial License
 * @author  Jan Odvarko
 *
 * See usage examples at http://jscolor.com/examples/
 */"use strict";window.jscolor||(window.jscolor=function(){var e={register:function(){e.attachDOMReadyEvent(e.init),e.attachEvent(document,"mousedown",e.onDocumentMouseDown),e.attachEvent(document,"touchstart",e.onDocumentTouchStart),e.attachEvent(window,"resize",e.onWindowResize)},init:function(){e.jscolor.lookupClass&&e.jscolor.installByClassName(e.jscolor.lookupClass)},tryInstallOnElements:function(t,n){var r=new RegExp("(^|\\s)("+n+")(\\s*(\\{[^}]*\\})|\\s|$)","i");for(var i=0;i<t.length;i+=1){if(t[i].type!==undefined&&t[i].type.toLowerCase()=="color"&&e.isColorAttrSupported)continue;var s;if(!t[i].jscolor&&t[i].className&&(s=t[i].className.match(r))){var o=t[i],u=null,a=e.getDataAttr(o,"jscolor");a!==null?u=a:s[4]&&(u=s[4]);var f={};if(u)try{f=(new Function("return ("+u+")"))()}catch(l){e.warn("Error parsing jscolor options: "+l+":\n"+u)}o.jscolor=new e.jscolor(o,f)}}},isColorAttrSupported:function(){var e=document.createElement("input");if(e.setAttribute){e.setAttribute("type","color");if(e.type.toLowerCase()=="color")return!0}return!1}(),isCanvasSupported:function(){var e=document.createElement("canvas");return!!e.getContext&&!!e.getContext("2d")}(),fetchElement:function(e){return typeof e=="string"?document.getElementById(e):e},isElementType:function(e,t){return e.nodeName.toLowerCase()===t.toLowerCase()},getDataAttr:function(e,t){var n="data-"+t,r=e.getAttribute(n);return r!==null?r:null},attachEvent:function(e,t,n){e.addEventListener?e.addEventListener(t,n,!1):e.attachEvent&&e.attachEvent("on"+t,n)},detachEvent:function(e,t,n){e.removeEventListener?e.removeEventListener(t,n,!1):e.detachEvent&&e.detachEvent("on"+t,n)},_attachedGroupEvents:{},attachGroupEvent:function(t,n,r,i){e._attachedGroupEvents.hasOwnProperty(t)||(e._attachedGroupEvents[t]=[]),e._attachedGroupEvents[t].push([n,r,i]),e.attachEvent(n,r,i)},detachGroupEvents:function(t){if(e._attachedGroupEvents.hasOwnProperty(t)){for(var n=0;n<e._attachedGroupEvents[t].length;n+=1){var r=e._attachedGroupEvents[t][n];e.detachEvent(r[0],r[1],r[2])}delete e._attachedGroupEvents[t]}},attachDOMReadyEvent:function(e){var t=!1,n=function(){t||(t=!0,e())};if(document.readyState==="complete"){setTimeout(n,1);return}if(document.addEventListener)document.addEventListener("DOMContentLoaded",n,!1),window.addEventListener("load",n,!1);else if(document.attachEvent){document.attachEvent("onreadystatechange",function(){document.readyState==="complete"&&(document.detachEvent("onreadystatechange",arguments.callee),n())}),window.attachEvent("onload",n);if(document.documentElement.doScroll&&window==window.top){var r=function(){if(!document.body)return;try{document.documentElement.doScroll("left"),n()}catch(e){setTimeout(r,1)}};r()}}},warn:function(e){window.console&&window.console.warn&&window.console.warn(e)},preventDefault:function(e){e.preventDefault&&e.preventDefault(),e.returnValue=!1},captureTarget:function(t){t.setCapture&&(e._capturedTarget=t,e._capturedTarget.setCapture())},releaseTarget:function(){e._capturedTarget&&(e._capturedTarget.releaseCapture(),e._capturedTarget=null)},fireEvent:function(e,t){if(!e)return;if(document.createEvent){var n=document.createEvent("HTMLEvents");n.initEvent(t,!0,!0),e.dispatchEvent(n)}else if(document.createEventObject){var n=document.createEventObject();e.fireEvent("on"+t,n)}else e["on"+t]&&e["on"+t]()},classNameToList:function(e){return e.replace(/^\s+|\s+$/g,"").split(/\s+/)},hasClass:function(e,t){return t?-1!=(" "+e.className.replace(/\s+/g," ")+" ").indexOf(" "+t+" "):!1},setClass:function(t,n){var r=e.classNameToList(n);for(var i=0;i<r.length;i+=1)e.hasClass(t,r[i])||(t.className+=(t.className?" ":"")+r[i])},unsetClass:function(t,n){var r=e.classNameToList(n);for(var i=0;i<r.length;i+=1){var s=new RegExp("^\\s*"+r[i]+"\\s*|"+"\\s*"+r[i]+"\\s*$|"+"\\s+"+r[i]+"(\\s+)","g");t.className=t.className.replace(s,"$1")}},getStyle:function(e){return window.getComputedStyle?window.getComputedStyle(e):e.currentStyle},setStyle:function(){var e=document.createElement("div"),t=function(t){for(var n=0;n<t.length;n+=1)if(t[n]in e.style)return t[n]},n={borderRadius:t(["borderRadius","MozBorderRadius","webkitBorderRadius"]),boxShadow:t(["boxShadow","MozBoxShadow","webkitBoxShadow"])};return function(e,t,r){switch(t.toLowerCase()){case"opacity":var i=Math.round(parseFloat(r)*100);e.style.opacity=r,e.style.filter="alpha(opacity="+i+")";break;default:e.style[n[t]]=r}}}(),setBorderRadius:function(t,n){e.setStyle(t,"borderRadius",n||"0")},setBoxShadow:function(t,n){e.setStyle(t,"boxShadow",n||"none")},getElementPos:function(t,n){var r=0,i=0,s=t.getBoundingClientRect();r=s.left,i=s.top;if(!n){var o=e.getViewPos();r+=o[0],i+=o[1]}return[r,i]},getElementSize:function(e){return[e.offsetWidth,e.offsetHeight]},getAbsPointerPos:function(e){e||(e=window.event);var t=0,n=0;return typeof e.changedTouches!="undefined"&&e.changedTouches.length?(t=e.changedTouches[0].clientX,n=e.changedTouches[0].clientY):typeof e.clientX=="number"&&(t=e.clientX,n=e.clientY),{x:t,y:n}},getRelPointerPos:function(e){e||(e=window.event);var t=e.target||e.srcElement,n=t.getBoundingClientRect(),r=0,i=0,s=0,o=0;return typeof e.changedTouches!="undefined"&&e.changedTouches.length?(s=e.changedTouches[0].clientX,o=e.changedTouches[0].clientY):typeof e.clientX=="number"&&(s=e.clientX,o=e.clientY),r=s-n.left,i=o-n.top,{x:r,y:i}},getViewPos:function(){var e=document.documentElement;return[(window.pageXOffset||e.scrollLeft)-(e.clientLeft||0),(window.pageYOffset||e.scrollTop)-(e.clientTop||0)]},getViewSize:function(){var e=document.documentElement;return[window.innerWidth||e.clientWidth,window.innerHeight||e.clientHeight]},redrawPosition:function(){if(e.picker&&e.picker.owner){var t=e.picker.owner,n,r;t.fixed?(n=e.getElementPos(t.targetElement,!0),r=[0,0]):(n=e.getElementPos(t.targetElement),r=e.getViewPos());var i=e.getElementSize(t.targetElement),s=e.getViewSize(),o=e.getPickerOuterDims(t),u,a,f;switch(t.position.toLowerCase()){case"left":u=1,a=0,f=-1;break;case"right":u=1,a=0,f=1;break;case"top":u=0,a=1,f=-1;break;default:u=0,a=1,f=1}var l=(i[a]+o[a])/2;if(!t.smartPosition)var c=[n[u],n[a]+i[a]-l+l*f];else var c=[-r[u]+n[u]+o[u]>s[u]?-r[u]+n[u]+i[u]/2>s[u]/2&&n[u]+i[u]-o[u]>=0?n[u]+i[u]-o[u]:n[u]:n[u],-r[a]+n[a]+i[a]+o[a]-l+l*f>s[a]?-r[a]+n[a]+i[a]/2>s[a]/2&&n[a]+i[a]-l-l*f>=0?n[a]+i[a]-l-l*f:n[a]+i[a]-l+l*f:n[a]+i[a]-l+l*f>=0?n[a]+i[a]-l+l*f:n[a]+i[a]-l-l*f];var h=c[u],p=c[a],d=t.fixed?"fixed":"absolute",v=(c[0]+o[0]>n[0]||c[0]<n[0]+i[0])&&c[1]+o[1]<n[1]+i[1];e._drawPosition(t,h,p,d,v)}},_drawPosition:function(t,n,r,i,s){var o=s?0:t.shadowBlur;e.picker.wrap.style.position=i,e.picker.wrap.style.left=n+"px",e.picker.wrap.style.top=r+"px",e.setBoxShadow(e.picker.boxS,t.shadow?new e.BoxShadow(0,o,t.shadowBlur,0,t.shadowColor):null)},getPickerDims:function(t){var n=!!e.getSliderComponent(t),r=[2*t.insetWidth+2*t.padding+t.width+(n?2*t.insetWidth+e.getPadToSliderPadding(t)+t.sliderSize:0),2*t.insetWidth+2*t.padding+t.height+(t.closable?2*t.insetWidth+t.padding+t.buttonHeight:0)];return r},getPickerOuterDims:function(t){var n=e.getPickerDims(t);return[n[0]+2*t.borderWidth,n[1]+2*t.borderWidth]},getPadToSliderPadding:function(e){return Math.max(e.padding,1.5*(2*e.pointerBorderWidth+e.pointerThickness))},getPadYComponent:function(e){switch(e.mode.charAt(1).toLowerCase()){case"v":return"v"}return"s"},getSliderComponent:function(e){if(e.mode.length>2)switch(e.mode.charAt(2).toLowerCase()){case"s":return"s";case"v":return"v"}return null},onDocumentMouseDown:function(t){t||(t=window.event);var n=t.target||t.srcElement;n._jscLinkedInstance?n._jscLinkedInstance.showOnClick&&n._jscLinkedInstance.show():n._jscControlName?e.onControlPointerStart(t,n,n._jscControlName,"mouse"):e.picker&&e.picker.owner&&e.picker.owner.hide()},onDocumentTouchStart:function(t){t||(t=window.event);var n=t.target||t.srcElement;n._jscLinkedInstance?n._jscLinkedInstance.showOnClick&&n._jscLinkedInstance.show():n._jscControlName?e.onControlPointerStart(t,n,n._jscControlName,"touch"):e.picker&&e.picker.owner&&e.picker.owner.hide()},onWindowResize:function(t){e.redrawPosition()},onParentScroll:function(t){e.picker&&e.picker.owner&&e.picker.owner.hide()},_pointerMoveEvent:{mouse:"mousemove",touch:"touchmove"},_pointerEndEvent:{mouse:"mouseup",touch:"touchend"},_pointerOrigin:null,_capturedTarget:null,onControlPointerStart:function(t,n,r,i){var s=n._jscInstance;e.preventDefault(t),e.captureTarget(n);var o=function(s,o){e.attachGroupEvent("drag",s,e._pointerMoveEvent[i],e.onDocumentPointerMove(t,n,r,i,o)),e.attachGroupEvent("drag",s,e._pointerEndEvent[i],e.onDocumentPointerEnd(t,n,r,i))};o(document,[0,0]);if(window.parent&&window.frameElement){var u=window.frameElement.getBoundingClientRect(),a=[-u.left,-u.top];o(window.parent.window.document,a)}var f=e.getAbsPointerPos(t),l=e.getRelPointerPos(t);e._pointerOrigin={x:f.x-l.x,y:f.y-l.y};switch(r){case"pad":switch(e.getSliderComponent(s)){case"s":s.hsv[1]===0&&s.fromHSV(null,100,null);break;case"v":s.hsv[2]===0&&s.fromHSV(null,null,100)}e.setPad(s,t,0,0);break;case"sld":e.setSld(s,t,0)}e.dispatchFineChange(s)},onDocumentPointerMove:function(t,n,r,i,s){return function(t){var i=n._jscInstance;switch(r){case"pad":t||(t=window.event),e.setPad(i,t,s[0],s[1]),e.dispatchFineChange(i);break;case"sld":t||(t=window.event),e.setSld(i,t,s[1]),e.dispatchFineChange(i)}}},onDocumentPointerEnd:function(t,n,r,i){return function(t){var r=n._jscInstance;e.detachGroupEvents("drag"),e.releaseTarget(),e.dispatchChange(r)}},dispatchChange:function(t){t.valueElement&&e.isElementType(t.valueElement,"input")&&e.fireEvent(t.valueElement,"change")},dispatchFineChange:function(e){if(e.onFineChange){var t;typeof e.onFineChange=="string"?t=new Function(e.onFineChange):t=e.onFineChange,t.call(e)}},setPad:function(t,n,r,i){var s=e.getAbsPointerPos(n),o=r+s.x-e._pointerOrigin.x-t.padding-t.insetWidth,u=i+s.y-e._pointerOrigin.y-t.padding-t.insetWidth,a=o*(360/(t.width-1)),f=100-u*(100/(t.height-1));switch(e.getPadYComponent(t)){case"s":t.fromHSV(a,f,null,e.leaveSld);break;case"v":t.fromHSV(a,null,f,e.leaveSld)}},setSld:function(t,n,r){var i=e.getAbsPointerPos(n),s=r+i.y-e._pointerOrigin.y-t.padding-t.insetWidth,o=100-s*(100/(t.height-1));switch(e.getSliderComponent(t)){case"s":t.fromHSV(null,o,null,e.leavePad);break;case"v":t.fromHSV(null,null,o,e.leavePad)}},_vmlNS:"jsc_vml_",_vmlCSS:"jsc_vml_css_",_vmlReady:!1,initVML:function(){if(!e._vmlReady){var t=document;t.namespaces[e._vmlNS]||t.namespaces.add(e._vmlNS,"urn:schemas-microsoft-com:vml");if(!t.styleSheets[e._vmlCSS]){var n=["shape","shapetype","group","background","path","formulas","handles","fill","stroke","shadow","textbox","textpath","imagedata","line","polyline","curve","rect","roundrect","oval","arc","image"],r=t.createStyleSheet();r.owningElement.id=e._vmlCSS;for(var i=0;i<n.length;i+=1)r.addRule(e._vmlNS+"\\:"+n[i],"behavior:url(#default#VML);")}e._vmlReady=!0}},createPalette:function(){var t={elm:null,draw:null};if(e.isCanvasSupported){var n=document.createElement("canvas"),r=n.getContext("2d"),i=function(e,t,i){n.width=e,n.height=t,r.clearRect(0,0,n.width,n.height);var s=r.createLinearGradient(0,0,n.width,0);s.addColorStop(0,"#F00"),s.addColorStop(1/6,"#FF0"),s.addColorStop(2/6,"#0F0"),s.addColorStop(.5,"#0FF"),s.addColorStop(4/6,"#00F"),s.addColorStop(5/6,"#F0F"),s.addColorStop(1,"#F00"),r.fillStyle=s,r.fillRect(0,0,n.width,n.height);var o=r.createLinearGradient(0,0,0,n.height);switch(i.toLowerCase()){case"s":o.addColorStop(0,"rgba(255,255,255,0)"),o.addColorStop(1,"rgba(255,255,255,1)");break;case"v":o.addColorStop(0,"rgba(0,0,0,0)"),o.addColorStop(1,"rgba(0,0,0,1)")}r.fillStyle=o,r.fillRect(0,0,n.width,n.height)};t.elm=n,t.draw=i}else{e.initVML();var s=document.createElement("div");s.style.position="relative",s.style.overflow="hidden";var o=document.createElement(e._vmlNS+":fill");o.type="gradient",o.method="linear",o.angle="90",o.colors="16.67% #F0F, 33.33% #00F, 50% #0FF, 66.67% #0F0, 83.33% #FF0";var u=document.createElement(e._vmlNS+":rect");u.style.position="absolute",u.style.left="-1px",u.style.top="-1px",u.stroked=!1,u.appendChild(o),s.appendChild(u);var a=document.createElement(e._vmlNS+":fill");a.type="gradient",a.method="linear",a.angle="180",a.opacity="0";var f=document.createElement(e._vmlNS+":rect");f.style.position="absolute",f.style.left="-1px",f.style.top="-1px",f.stroked=!1,f.appendChild(a),s.appendChild(f);var i=function(e,t,n){s.style.width=e+"px",s.style.height=t+"px",u.style.width=f.style.width=e+1+"px",u.style.height=f.style.height=t+1+"px",o.color="#F00",o.color2="#F00";switch(n.toLowerCase()){case"s":a.color=a.color2="#FFF";break;case"v":a.color=a.color2="#000"}};t.elm=s,t.draw=i}return t},createSliderGradient:function(){var t={elm:null,draw:null};if(e.isCanvasSupported){var n=document.createElement("canvas"),r=n.getContext("2d"),i=function(e,t,i,s){n.width=e,n.height=t,r.clearRect(0,0,n.width,n.height);var o=r.createLinearGradient(0,0,0,n.height);o.addColorStop(0,i),o.addColorStop(1,s),r.fillStyle=o,r.fillRect(0,0,n.width,n.height)};t.elm=n,t.draw=i}else{e.initVML();var s=document.createElement("div");s.style.position="relative",s.style.overflow="hidden";var o=document.createElement(e._vmlNS+":fill");o.type="gradient",o.method="linear",o.angle="180";var u=document.createElement(e._vmlNS+":rect");u.style.position="absolute",u.style.left="-1px",u.style.top="-1px",u.stroked=!1,u.appendChild(o),s.appendChild(u);var i=function(e,t,n,r){s.style.width=e+"px",s.style.height=t+"px",u.style.width=e+1+"px",u.style.height=t+1+"px",o.color=n,o.color2=r};t.elm=s,t.draw=i}return t},leaveValue:1,leaveStyle:2,leavePad:4,leaveSld:8,BoxShadow:function(){var e=function(e,t,n,r,i,s){this.hShadow=e,this.vShadow=t,this.blur=n,this.spread=r,this.color=i,this.inset=!!s};return e.prototype.toString=function(){var e=[Math.round(this.hShadow)+"px",Math.round(this.vShadow)+"px",Math.round(this.blur)+"px",Math.round(this.spread)+"px",this.color];return this.inset&&e.push("inset"),e.join(" ")},e}(),jscolor:function(t,n){function i(e,t,n){e/=255,t/=255,n/=255;var r=Math.min(Math.min(e,t),n),i=Math.max(Math.max(e,t),n),s=i-r;if(s===0)return[null,0,100*i];var o=e===r?3+(n-t)/s:t===r?5+(e-n)/s:1+(t-e)/s;return[60*(o===6?0:o),100*(s/i),100*i]}function s(e,t,n){var r=255*(n/100);if(e===null)return[r,r,r];e/=60,t/=100;var i=Math.floor(e),s=i%2?e-i:1-(e-i),o=r*(1-t),u=r*(1-t*s);switch(i){case 6:case 0:return[r,u,o];case 1:return[u,r,o];case 2:return[o,r,u];case 3:return[o,u,r];case 4:return[u,o,r];case 5:return[r,o,u]}}function o(){e.unsetClass(d.targetElement,d.activeClass),e.picker.wrap.parentNode.removeChild(e.picker.wrap),delete e.picker.owner}function u(){function l(){var e=d.insetColor.split(/\s+/),n=e.length<2?e[0]:e[1]+" "+e[0]+" "+e[0]+" "+e[1];t.btn.style.borderColor=n}d._processParentElementsInDOM(),e.picker||(e.picker={owner:null,wrap:document.createElement("div"),box:document.createElement("div"),boxS:document.createElement("div"),boxB:document.createElement("div"),pad:document.createElement("div"),padB:document.createElement("div"),padM:document.createElement("div"),padPal:e.createPalette(),cross:document.createElement("div"),crossBY:document.createElement("div"),crossBX:document.createElement("div"),crossLY:document.createElement("div"),crossLX:document.createElement("div"),sld:document.createElement("div"),sldB:document.createElement("div"),sldM:document.createElement("div"),sldGrad:e.createSliderGradient(),sldPtrS:document.createElement("div"),sldPtrIB:document.createElement("div"),sldPtrMB:document.createElement("div"),sldPtrOB:document.createElement("div"),btn:document.createElement("div"),btnT:document.createElement("span")},e.picker.pad.appendChild(e.picker.padPal.elm),e.picker.padB.appendChild(e.picker.pad),e.picker.cross.appendChild(e.picker.crossBY),e.picker.cross.appendChild(e.picker.crossBX),e.picker.cross.appendChild(e.picker.crossLY),e.picker.cross.appendChild(e.picker.crossLX),e.picker.padB.appendChild(e.picker.cross),e.picker.box.appendChild(e.picker.padB),e.picker.box.appendChild(e.picker.padM),e.picker.sld.appendChild(e.picker.sldGrad.elm),e.picker.sldB.appendChild(e.picker.sld),e.picker.sldB.appendChild(e.picker.sldPtrOB),e.picker.sldPtrOB.appendChild(e.picker.sldPtrMB),e.picker.sldPtrMB.appendChild(e.picker.sldPtrIB),e.picker.sldPtrIB.appendChild(e.picker.sldPtrS),e.picker.box.appendChild(e.picker.sldB),e.picker.box.appendChild(e.picker.sldM),e.picker.btn.appendChild(e.picker.btnT),e.picker.box.appendChild(e.picker.btn),e.picker.boxB.appendChild(e.picker.box),e.picker.wrap.appendChild(e.picker.boxS),e.picker.wrap.appendChild(e.picker.boxB));var t=e.picker,n=!!e.getSliderComponent(d),r=e.getPickerDims(d),i=2*d.pointerBorderWidth+d.pointerThickness+2*d.crossSize,s=e.getPadToSliderPadding(d),o=Math.min(d.borderRadius,Math.round(d.padding*Math.PI)),u="crosshair";t.wrap.style.clear="both",t.wrap.style.width=r[0]+2*d.borderWidth+"px",t.wrap.style.height=r[1]+2*d.borderWidth+"px",t.wrap.style.zIndex=d.zIndex,t.box.style.width=r[0]+"px",t.box.style.height=r[1]+"px",t.boxS.style.position="absolute",t.boxS.style.left="0",t.boxS.style.top="0",t.boxS.style.width="100%",t.boxS.style.height="100%",e.setBorderRadius(t.boxS,o+"px"),t.boxB.style.position="relative",t.boxB.style.border=d.borderWidth+"px solid",t.boxB.style.borderColor=d.borderColor,t.boxB.style.background=d.backgroundColor,e.setBorderRadius(t.boxB,o+"px"),t.padM.style.background=t.sldM.style.background="#FFF",e.setStyle(t.padM,"opacity","0"),e.setStyle(t.sldM,"opacity","0"),t.pad.style.position="relative",t.pad.style.width=d.width+"px",t.pad.style.height=d.height+"px",t.padPal.draw(d.width,d.height,e.getPadYComponent(d)),t.padB.style.position="absolute",t.padB.style.left=d.padding+"px",t.padB.style.top=d.padding+"px",t.padB.style.border=d.insetWidth+"px solid",t.padB.style.borderColor=d.insetColor,t.padM._jscInstance=d,t.padM._jscControlName="pad",t.padM.style.position="absolute",t.padM.style.left="0",t.padM.style.top="0",t.padM.style.width=d.padding+2*d.insetWidth+d.width+s/2+"px",t.padM.style.height=r[1]+"px",t.padM.style.cursor=u,t.cross.style.position="absolute",t.cross.style.left=t.cross.style.top="0",t.cross.style.width=t.cross.style.height=i+"px",t.crossBY.style.position=t.crossBX.style.position="absolute",t.crossBY.style.background=t.crossBX.style.background=d.pointerBorderColor,t.crossBY.style.width=t.crossBX.style.height=2*d.pointerBorderWidth+d.pointerThickness+"px",t.crossBY.style.height=t.crossBX.style.width=i+"px",t.crossBY.style.left=t.crossBX.style.top=Math.floor(i/2)-Math.floor(d.pointerThickness/2)-d.pointerBorderWidth+"px",t.crossBY.style.top=t.crossBX.style.left="0",t.crossLY.style.position=t.crossLX.style.position="absolute",t.crossLY.style.background=t.crossLX.style.background=d.pointerColor,t.crossLY.style.height=t.crossLX.style.width=i-2*d.pointerBorderWidth+"px",t.crossLY.style.width=t.crossLX.style.height=d.pointerThickness+"px",t.crossLY.style.left=t.crossLX.style.top=Math.floor(i/2)-Math.floor(d.pointerThickness/2)+"px",t.crossLY.style.top=t.crossLX.style.left=d.pointerBorderWidth+"px",t.sld.style.overflow="hidden",t.sld.style.width=d.sliderSize+"px",t.sld.style.height=d.height+"px",t.sldGrad.draw(d.sliderSize,d.height,"#000","#000"),t.sldB.style.display=n?"block":"none",t.sldB.style.position="absolute",t.sldB.style.right=d.padding+"px",t.sldB.style.top=d.padding+"px",t.sldB.style.border=d.insetWidth+"px solid",t.sldB.style.borderColor=d.insetColor,t.sldM._jscInstance=d,t.sldM._jscControlName="sld",t.sldM.style.display=n?"block":"none",t.sldM.style.position="absolute",t.sldM.style.right="0",t.sldM.style.top="0",t.sldM.style.width=d.sliderSize+s/2+d.padding+2*d.insetWidth+"px",t.sldM.style.height=r[1]+"px",t.sldM.style.cursor="default",t.sldPtrIB.style.border=t.sldPtrOB.style.border=d.pointerBorderWidth+"px solid "+d.pointerBorderColor,t.sldPtrOB.style.position="absolute",t.sldPtrOB.style.left=-(2*d.pointerBorderWidth+d.pointerThickness)+"px",t.sldPtrOB.style.top="0",t.sldPtrMB.style.border=d.pointerThickness+"px solid "+d.pointerColor,t.sldPtrS.style.width=d.sliderSize+"px",t.sldPtrS.style.height=m+"px",t.btn.style.display=d.closable?"block":"none",t.btn.style.position="absolute",t.btn.style.left=d.padding+"px",t.btn.style.bottom=d.padding+"px",t.btn.style.padding="0 15px",t.btn.style.height=d.buttonHeight+"px",t.btn.style.border=d.insetWidth+"px solid",l(),t.btn.style.color=d.buttonColor,t.btn.style.font="12px sans-serif",t.btn.style.textAlign="center";try{t.btn.style.cursor="pointer"}catch(c){t.btn.style.cursor="hand"}t.btn.onmousedown=function(){d.hide()},t.btnT.style.lineHeight=d.buttonHeight+"px",t.btnT.innerHTML="",t.btnT.appendChild(document.createTextNode(d.closeText)),a(),f(),e.picker.owner&&e.picker.owner!==d&&e.unsetClass(e.picker.owner.targetElement,d.activeClass),e.picker.owner=d,e.isElementType(v,"body")?e.redrawPosition():e._drawPosition(d,0,0,"relative",!1),t.wrap.parentNode!=v&&v.appendChild(t.wrap),e.setClass(d.targetElement,d.activeClass)}function a(){switch(e.getPadYComponent(d)){case"s":var t=1;break;case"v":var t=2}var n=Math.round(d.hsv[0]/360*(d.width-1)),r=Math.round((1-d.hsv[t]/100)*(d.height-1)),i=2*d.pointerBorderWidth+d.pointerThickness+2*d.crossSize,o=-Math.floor(i/2);e.picker.cross.style.left=n+o+"px",e.picker.cross.style.top=r+o+"px";switch(e.getSliderComponent(d)){case"s":var u=s(d.hsv[0],100,d.hsv[2]),a=s(d.hsv[0],0,d.hsv[2]),f="rgb("+Math.round(u[0])+","+Math.round(u[1])+","+Math.round(u[2])+")",l="rgb("+Math.round(a[0])+","+Math.round(a[1])+","+Math.round(a[2])+")";e.picker.sldGrad.draw(d.sliderSize,d.height,f,l);break;case"v":var c=s(d.hsv[0],d.hsv[1],100),f="rgb("+Math.round(c[0])+","+Math.round(c[1])+","+Math.round(c[2])+")",l="#000";e.picker.sldGrad.draw(d.sliderSize,d.height,f,l)}}function f(){var t=e.getSliderComponent(d);if(t){switch(t){case"s":var n=1;break;case"v":var n=2}var r=Math.round((1-d.hsv[n]/100)*(d.height-1));e.picker.sldPtrOB.style.top=r-(2*d.pointerBorderWidth+d.pointerThickness)-Math.floor(m/2)+"px"}}function l(){return e.picker&&e.picker.owner===d}function c(){d.importColor()}this.value=null,this.valueElement=t,this.styleElement=t,this.required=!0,this.refine=!0,this.hash=!1,this.uppercase=!0,this.onFineChange=null,this.activeClass="jscolor-active",this.minS=0,this.maxS=100,this.minV=0,this.maxV=100,this.hsv=[0,0,100],this.rgb=[255,255,255],this.width=181,this.height=101,this.showOnClick=!0,this.mode="HSV",this.position="bottom",this.smartPosition=!0,this.sliderSize=16,this.crossSize=8,this.closable=!1,this.closeText="Close",this.buttonColor="#000000",this.buttonHeight=18,this.padding=12,this.backgroundColor="#FFFFFF",this.borderWidth=1,this.borderColor="#BBBBBB",this.borderRadius=8,this.insetWidth=1,this.insetColor="#BBBBBB",this.shadow=!0,this.shadowBlur=15,this.shadowColor="rgba(0,0,0,0.2)",this.pointerColor="#4C4C4C",this.pointerBorderColor="#FFFFFF",this.pointerBorderWidth=1,this.pointerThickness=2,this.zIndex=1e3,this.container=null;for(var r in n)n.hasOwnProperty(r)&&(this[r]=n[r]);this.hide=function(){l()&&o()},this.show=function(){u()},this.redraw=function(){l()&&u()},this.importColor=function(){this.valueElement?e.isElementType(this.valueElement,"input")?this.refine?!this.required&&/^\s*$/.test(this.valueElement.value)?(this.valueElement.value="",this.styleElement&&(this.styleElement.style.backgroundImage=this.styleElement._jscOrigStyle.backgroundImage,this.styleElement.style.backgroundColor=this.styleElement._jscOrigStyle.backgroundColor,this.styleElement.style.color=this.styleElement._jscOrigStyle.color),this.exportColor(e.leaveValue|e.leaveStyle)):this.fromString(this.valueElement.value)||this.exportColor():this.fromString(this.valueElement.value,e.leaveValue)||(this.styleElement&&(this.styleElement.style.backgroundImage=this.styleElement._jscOrigStyle.backgroundImage,this.styleElement.style.backgroundColor=this.styleElement._jscOrigStyle.backgroundColor,this.styleElement.style.color=this.styleElement._jscOrigStyle.color),this.exportColor(e.leaveValue|e.leaveStyle)):this.exportColor():this.exportColor()},this.exportColor=function(t){if(!(t&e.leaveValue)&&this.valueElement){var n=this.toString();this.uppercase&&(n=n.toUpperCase()),this.hash&&(n="#"+n),e.isElementType(this.valueElement,"input")?this.valueElement.value=n:this.valueElement.innerHTML=n}t&e.leaveStyle||this.styleElement&&(this.styleElement.style.backgroundImage="none",this.styleElement.style.backgroundColor="#"+this.toString(),this.styleElement.style.color=this.isLight()?"#000":"#FFF"),!(t&e.leavePad)&&l()&&a(),!(t&e.leaveSld)&&l()&&f()},this.fromHSV=function(e,t,n,r){if(e!==null){if(isNaN(e))return!1;e=Math.max(0,Math.min(360,e))}if(t!==null){if(isNaN(t))return!1;t=Math.max(0,Math.min(100,this.maxS,t),this.minS)}if(n!==null){if(isNaN(n))return!1;n=Math.max(0,Math.min(100,this.maxV,n),this.minV)}this.rgb=s(e===null?this.hsv[0]:this.hsv[0]=e,t===null?this.hsv[1]:this.hsv[1]=t,n===null?this.hsv[2]:this.hsv[2]=n),this.exportColor(r)},this.fromRGB=function(e,t,n,r){if(e!==null){if(isNaN(e))return!1;e=Math.max(0,Math.min(255,e))}if(t!==null){if(isNaN(t))return!1;t=Math.max(0,Math.min(255,t))}if(n!==null){if(isNaN(n))return!1;n=Math.max(0,Math.min(255,n))}var o=i(e===null?this.rgb[0]:e,t===null?this.rgb[1]:t,n===null?this.rgb[2]:n);o[0]!==null&&(this.hsv[0]=Math.max(0,Math.min(360,o[0]))),o[2]!==0&&(this.hsv[1]=o[1]===null?null:Math.max(0,this.minS,Math.min(100,this.maxS,o[1]))),this.hsv[2]=o[2]===null?null:Math.max(0,this.minV,Math.min(100,this.maxV,o[2]));var u=s(this.hsv[0],this.hsv[1],this.hsv[2]);this.rgb[0]=u[0],this.rgb[1]=u[1],this.rgb[2]=u[2],this.exportColor(r)},this.fromString=function(e,t){var n;if(n=e.match(/^\W*([0-9A-F]{3}([0-9A-F]{3})?)\W*$/i))return n[1].length===6?this.fromRGB(parseInt(n[1].substr(0,2),16),parseInt(n[1].substr(2,2),16),parseInt(n[1].substr(4,2),16),t):this.fromRGB(parseInt(n[1].charAt(0)+n[1].charAt(0),16),parseInt(n[1].charAt(1)+n[1].charAt(1),16),parseInt(n[1].charAt(2)+n[1].charAt(2),16),t),!0;if(n=e.match(/^\W*rgba?\(([^)]*)\)\W*$/i)){var r=n[1].split(","),i=/^\s*(\d*)(\.\d+)?\s*$/,s,o,u;if(r.length>=3&&(s=r[0].match(i))&&(o=r[1].match(i))&&(u=r[2].match(i))){var a=parseFloat((s[1]||"0")+(s[2]||"")),f=parseFloat((o[1]||"0")+(o[2]||"")),l=parseFloat((u[1]||"0")+(u[2]||""));return this.fromRGB(a,f,l,t),!0}}return!1},this.toString=function(){return(256|Math.round(this.rgb[0])).toString(16).substr(1)+(256|Math.round(this.rgb[1])).toString(16).substr(1)+(256|Math.round(this.rgb[2])).toString(16).substr(1)},this.toHEXString=function(){return"#"+this.toString().toUpperCase()},this.toRGBString=function(){return"rgb("+Math.round(this.rgb[0])+","+Math.round(this.rgb[1])+","+Math.round(this.rgb[2])+")"},this.isLight=function(){return.213*this.rgb[0]+.715*this.rgb[1]+.072*this.rgb[2]>127.5},this._processParentElementsInDOM=function(){if(this._linkedElementsProcessed)return;this._linkedElementsProcessed=!0;var t=this.targetElement;do{var n=e.getStyle(t);n&&n.position.toLowerCase()==="fixed"&&(this.fixed=!0),t!==this.targetElement&&(t._jscEventsAttached||(e.attachEvent(t,"scroll",e.onParentScroll),t._jscEventsAttached=!0))}while((t=t.parentNode)&&!e.isElementType(t,"body"))};if(typeof t=="string"){var h=t,p=document.getElementById(h);p?this.targetElement=p:e.warn("Could not find target element with ID '"+h+"'")}else t?this.targetElement=t:e.warn("Invalid target element: '"+t+"'");if(this.targetElement._jscLinkedInstance){e.warn("Cannot link jscolor twice to the same element. Skipping.");return}this.targetElement._jscLinkedInstance=this,this.valueElement=e.fetchElement(this.valueElement),this.styleElement=e.fetchElement(this.styleElement);var d=this,v=this.container?e.fetchElement(this.container):document.getElementsByTagName("body")[0],m=3;if(e.isElementType(this.targetElement,"button"))if(this.targetElement.onclick){var g=this.targetElement.onclick;this.targetElement.onclick=function(e){return g.call(this,e),!1}}else this.targetElement.onclick=function(){return!1};if(this.valueElement&&e.isElementType(this.valueElement,"input")){var y=function(){d.fromString(d.valueElement.value,e.leaveValue),e.dispatchFineChange(d)};e.attachEvent(this.valueElement,"keyup",y),e.attachEvent(this.valueElement,"input",y),e.attachEvent(this.valueElement,"blur",c),this.valueElement.setAttribute("autocomplete","off")}this.styleElement&&(this.styleElement._jscOrigStyle={backgroundImage:this.styleElement.style.backgroundImage,backgroundColor:this.styleElement.style.backgroundColor,color:this.styleElement.style.color}),this.value?this.fromString(this.value)||this.exportColor():this.importColor()}};return e.jscolor.lookupClass="jscolor",e.jscolor.installByClassName=function(t){var n=document.getElementsByTagName("input"),r=document.getElementsByTagName("button");e.tryInstallOnElements(n,t),e.tryInstallOnElements(r,t)},e.register(),e.jscolor}());;/**
 * jscolor, JavaScript Color Picker
 *
 * @version 1.4.3
 * @license GNU Lesser General Public License, http://www.gnu.org/copyleft/lesser.html
 * @author  Jan Odvarko, http://odvarko.cz
 * @created 2008-06-15
 * @updated 2014-07-16
 * @link    http://jscolor.com
 */


var jscolor = {


	dir : '', // location of jscolor directory (leave empty to autodetect)
	bindClass : 'color', // class name
	binding : true, // automatic binding via <input class="...">
	preloading : true, // use image preloading?


	install : function() {
		jscolor.addEvent(window, 'load', jscolor.init);
	},


	init : function() {
		if(jscolor.binding) {
			jscolor.bind();
		}
		if(jscolor.preloading) {
			jscolor.preload();
		}
	},


	getDir : function() {
		if(!jscolor.dir) {
			var detected = jscolor.detectDir();
			jscolor.dir = detected!==false ? detected : 'jscolor/';
		}
		return jscolor.dir;
	},


	detectDir : function() {

		return document.getElementById('wp_base_url_jscolor').value + '/';

		var base = location.href;

		var e = document.getElementsByTagName('base');
		for(var i=0; i<e.length; i+=1) {
			if(e[i].href) { base = e[i].href; }
		}

		var e = document.getElementsByTagName('script');
		for(var i=0; i<e.length; i+=1) {
			if(e[i].src && /(^|\/)jscolor\.js([?#].*)?$/i.test(e[i].src)) {
				var src = new jscolor.URI(e[i].src);
				var srcAbs = src.toAbsolute(base);
				srcAbs.path = srcAbs.path.replace(/[^\/]+$/, ''); // remove filename
				srcAbs.query = null;
				srcAbs.fragment = null;
				return srcAbs.toString();
			}
		}
		return false;
	},


	bind : function() {
		var matchClass = new RegExp('(^|\\s)('+jscolor.bindClass+')(\\s*(\\{[^}]*\\})|\\s|$)', 'i');
		var e = document.getElementsByTagName('input');
		for(var i=0; i<e.length; i+=1) {
			var m;
			if(!e[i].color && e[i].className && (m = e[i].className.match(matchClass))) {
				var prop = {};
				if(m[4]) {
					try {
						prop = (new Function ('return (' + m[4] + ')'))();
					} catch(eInvalidProp) {}
				}
				e[i].color = new jscolor.color(e[i], prop);
			}
		}
	},


	preload : function() {
		for(var fn in jscolor.imgRequire) {
			if(jscolor.imgRequire.hasOwnProperty(fn)) {
				jscolor.loadImage(fn);
			}
		}
	},


	images : {
		pad : [ 181, 101 ],
		sld : [ 16, 101 ],
		cross : [ 15, 15 ],
		arrow : [ 7, 11 ]
	},


	imgRequire : {},
	imgLoaded : {},


	requireImage : function(filename) {
		jscolor.imgRequire[filename] = true;
	},


	loadImage : function(filename) {
		if(!jscolor.imgLoaded[filename]) {
			jscolor.imgLoaded[filename] = new Image();
			jscolor.imgLoaded[filename].src = jscolor.getDir()+filename;
		}
	},


	fetchElement : function(mixed) {
		return typeof mixed === 'string' ? document.getElementById(mixed) : mixed;
	},


	addEvent : function(el, evnt, func) {
		if(el.addEventListener) {
			el.addEventListener(evnt, func, false);
		} else if(el.attachEvent) {
			el.attachEvent('on'+evnt, func);
		}
	},


	fireEvent : function(el, evnt) {
		if(!el) {
			return;
		}
		if(document.createEvent) {
			var ev = document.createEvent('HTMLEvents');
			ev.initEvent(evnt, true, true);
			el.dispatchEvent(ev);
		} else if(document.createEventObject) {
			var ev = document.createEventObject();
			el.fireEvent('on'+evnt, ev);
		} else if(el['on'+evnt]) { // alternatively use the traditional event model (IE5)
			el['on'+evnt]();
		}
	},


	getElementPos : function(e) {
		var e1=e, e2=e;
		var x=0, y=0;
		if(e1.offsetParent) {
			do {
				x += e1.offsetLeft;
				y += e1.offsetTop;
			} while(e1 = e1.offsetParent);
		}
		while((e2 = e2.parentNode) && e2.nodeName.toUpperCase() !== 'BODY') {
			x -= e2.scrollLeft;
			y -= e2.scrollTop;
		}
		return [x, y];
	},


	getElementSize : function(e) {
		return [e.offsetWidth, e.offsetHeight];
	},


	getRelMousePos : function(e) {
		var x = 0, y = 0;
		if (!e) { e = window.event; }
		if (typeof e.offsetX === 'number') {
			x = e.offsetX;
			y = e.offsetY;
		} else if (typeof e.layerX === 'number') {
			x = e.layerX;
			y = e.layerY;
		}
		return { x: x, y: y };
	},


	getViewPos : function() {
		if(typeof window.pageYOffset === 'number') {
			return [window.pageXOffset, window.pageYOffset];
		} else if(document.body && (document.body.scrollLeft || document.body.scrollTop)) {
			return [document.body.scrollLeft, document.body.scrollTop];
		} else if(document.documentElement && (document.documentElement.scrollLeft || document.documentElement.scrollTop)) {
			return [document.documentElement.scrollLeft, document.documentElement.scrollTop];
		} else {
			return [0, 0];
		}
	},


	getViewSize : function() {
		if(typeof window.innerWidth === 'number') {
			return [window.innerWidth, window.innerHeight];
		} else if(document.body && (document.body.clientWidth || document.body.clientHeight)) {
			return [document.body.clientWidth, document.body.clientHeight];
		} else if(document.documentElement && (document.documentElement.clientWidth || document.documentElement.clientHeight)) {
			return [document.documentElement.clientWidth, document.documentElement.clientHeight];
		} else {
			return [0, 0];
		}
	},


	URI : function(uri) { // See RFC3986

		this.scheme = null;
		this.authority = null;
		this.path = '';
		this.query = null;
		this.fragment = null;

		this.parse = function(uri) {
			var m = uri.match(/^(([A-Za-z][0-9A-Za-z+.-]*)(:))?((\/\/)([^\/?#]*))?([^?#]*)((\?)([^#]*))?((#)(.*))?/);
			this.scheme = m[3] ? m[2] : null;
			this.authority = m[5] ? m[6] : null;
			this.path = m[7];
			this.query = m[9] ? m[10] : null;
			this.fragment = m[12] ? m[13] : null;
			return this;
		};

		this.toString = function() {
			var result = '';
			if(this.scheme !== null) { result = result + this.scheme + ':'; }
			if(this.authority !== null) { result = result + '//' + this.authority; }
			if(this.path !== null) { result = result + this.path; }
			if(this.query !== null) { result = result + '?' + this.query; }
			if(this.fragment !== null) { result = result + '#' + this.fragment; }
			return result;
		};

		this.toAbsolute = function(base) {
			var base = new jscolor.URI(base);
			var r = this;
			var t = new jscolor.URI;

			if(base.scheme === null) { return false; }

			if(r.scheme !== null && r.scheme.toLowerCase() === base.scheme.toLowerCase()) {
				r.scheme = null;
			}

			if(r.scheme !== null) {
				t.scheme = r.scheme;
				t.authority = r.authority;
				t.path = removeDotSegments(r.path);
				t.query = r.query;
			} else {
				if(r.authority !== null) {
					t.authority = r.authority;
					t.path = removeDotSegments(r.path);
					t.query = r.query;
				} else {
					if(r.path === '') {
						t.path = base.path;
						if(r.query !== null) {
							t.query = r.query;
						} else {
							t.query = base.query;
						}
					} else {
						if(r.path.substr(0,1) === '/') {
							t.path = removeDotSegments(r.path);
						} else {
							if(base.authority !== null && base.path === '') {
								t.path = '/'+r.path;
							} else {
								t.path = base.path.replace(/[^\/]+$/,'')+r.path;
							}
							t.path = removeDotSegments(t.path);
						}
						t.query = r.query;
					}
					t.authority = base.authority;
				}
				t.scheme = base.scheme;
			}
			t.fragment = r.fragment;

			return t;
		};

		function removeDotSegments(path) {
			var out = '';
			while(path) {
				if(path.substr(0,3)==='../' || path.substr(0,2)==='./') {
					path = path.replace(/^\.+/,'').substr(1);
				} else if(path.substr(0,3)==='/./' || path==='/.') {
					path = '/'+path.substr(3);
				} else if(path.substr(0,4)==='/../' || path==='/..') {
					path = '/'+path.substr(4);
					out = out.replace(/\/?[^\/]*$/, '');
				} else if(path==='.' || path==='..') {
					path = '';
				} else {
					var rm = path.match(/^\/?[^\/]*/)[0];
					path = path.substr(rm.length);
					out = out + rm;
				}
			}
			return out;
		}

		if(uri) {
			this.parse(uri);
		}

	},


	//
	// Usage example:
	// var myColor = new jscolor.color(myInputElement)
	//

	color : function(target, prop) {


		this.required = true; // refuse empty values?
		this.adjust = true; // adjust value to uniform notation?
		this.hash = false; // prefix color with # symbol?
		this.caps = true; // uppercase?
		this.slider = true; // show the value/saturation slider?
		this.valueElement = target; // value holder
		this.styleElement = target; // where to reflect current color
		this.onImmediateChange = null; // onchange callback (can be either string or function)
		this.hsv = [0, 0, 1]; // read-only  0-6, 0-1, 0-1
		this.rgb = [1, 1, 1]; // read-only  0-1, 0-1, 0-1
		this.minH = 0; // read-only  0-6
		this.maxH = 6; // read-only  0-6
		this.minS = 0; // read-only  0-1
		this.maxS = 1; // read-only  0-1
		this.minV = 0; // read-only  0-1
		this.maxV = 1; // read-only  0-1

		this.pickerOnfocus = true; // display picker on focus?
		this.pickerMode = 'HSV'; // HSV | HVS
		this.pickerPosition = 'bottom'; // left | right | top | bottom
		this.pickerSmartPosition = true; // automatically adjust picker position when necessary
		this.pickerButtonHeight = 20; // px
		this.pickerClosable = false;
		this.pickerCloseText = 'Close';
		this.pickerButtonColor = 'ButtonText'; // px
		this.pickerFace = 10; // px
		this.pickerFaceColor = 'ThreeDFace'; // CSS color
		this.pickerBorder = 1; // px
		this.pickerBorderColor = 'ThreeDHighlight ThreeDShadow ThreeDShadow ThreeDHighlight'; // CSS color
		this.pickerInset = 1; // px
		this.pickerInsetColor = 'ThreeDShadow ThreeDHighlight ThreeDHighlight ThreeDShadow'; // CSS color
		this.pickerZIndex = 10000;


		for(var p in prop) {
			if(prop.hasOwnProperty(p)) {
				this[p] = prop[p];
			}
		}


		this.hidePicker = function() {
			if(isPickerOwner()) {
				removePicker();
			}
		};


		this.showPicker = function() {
			if(!isPickerOwner()) {
				var tp = jscolor.getElementPos(target); // target pos
				var ts = jscolor.getElementSize(target); // target size
				var vp = jscolor.getViewPos(); // view pos
				var vs = jscolor.getViewSize(); // view size
				var ps = getPickerDims(this); // picker size
				var a, b, c;
				switch(this.pickerPosition.toLowerCase()) {
					case 'left': a=1; b=0; c=-1; break;
					case 'right':a=1; b=0; c=1; break;
					case 'top':  a=0; b=1; c=-1; break;
					default:     a=0; b=1; c=1; break;
				}
				var l = (ts[b]+ps[b])/2;

				// picker pos
				if (!this.pickerSmartPosition) {
					var pp = [
						tp[a],
						tp[b]+ts[b]-l+l*c
					];
				} else {
					var pp = [
						-vp[a]+tp[a]+ps[a] > vs[a] ?
							(-vp[a]+tp[a]+ts[a]/2 > vs[a]/2 && tp[a]+ts[a]-ps[a] >= 0 ? tp[a]+ts[a]-ps[a] : tp[a]) :
							tp[a],
						-vp[b]+tp[b]+ts[b]+ps[b]-l+l*c > vs[b] ?
							(-vp[b]+tp[b]+ts[b]/2 > vs[b]/2 && tp[b]+ts[b]-l-l*c >= 0 ? tp[b]+ts[b]-l-l*c : tp[b]+ts[b]-l+l*c) :
							(tp[b]+ts[b]-l+l*c >= 0 ? tp[b]+ts[b]-l+l*c : tp[b]+ts[b]-l-l*c)
					];
				}
				drawPicker(pp[a], pp[b]);
			}
		};


		this.importColor = function() {
			if(!valueElement) {
				this.exportColor();
			} else {
				if(!this.adjust) {
					if(!this.fromString(valueElement.value, leaveValue)) {
						styleElement.style.backgroundImage = styleElement.jscStyle.backgroundImage;
						styleElement.style.backgroundColor = styleElement.jscStyle.backgroundColor;
						styleElement.style.color = styleElement.jscStyle.color;
						this.exportColor(leaveValue | leaveStyle);
					}
				} else if(!this.required && /^\s*$/.test(valueElement.value)) {
					valueElement.value = '';
					styleElement.style.backgroundImage = styleElement.jscStyle.backgroundImage;
					styleElement.style.backgroundColor = styleElement.jscStyle.backgroundColor;
					styleElement.style.color = styleElement.jscStyle.color;
					this.exportColor(leaveValue | leaveStyle);

				} else if(this.fromString(valueElement.value)) {
					// OK
				} else {
					this.exportColor();
				}
			}
		};


		this.exportColor = function(flags) {
			if(!(flags & leaveValue) && valueElement) {
				var value = this.toString();
				if(this.caps) { value = value.toUpperCase(); }
				if(this.hash) { value = '#'+value; }
				valueElement.value = value;
			}
			if(!(flags & leaveStyle) && styleElement) {
				styleElement.style.backgroundImage = "none";
				styleElement.style.backgroundColor =
					'#'+this.toString();
				styleElement.style.color =
					0.213 * this.rgb[0] +
					0.715 * this.rgb[1] +
					0.072 * this.rgb[2]
					< 0.5 ? '#FFF' : '#000';
			}
			if(!(flags & leavePad) && isPickerOwner()) {
				redrawPad();
			}
			if(!(flags & leaveSld) && isPickerOwner()) {
				redrawSld();
			}
		};


		this.fromHSV = function(h, s, v, flags) { // null = don't change
			if(h !== null) { h = Math.max(0.0, this.minH, Math.min(6.0, this.maxH, h)); }
			if(s !== null) { s = Math.max(0.0, this.minS, Math.min(1.0, this.maxS, s)); }
			if(v !== null) { v = Math.max(0.0, this.minV, Math.min(1.0, this.maxV, v)); }

			this.rgb = HSV_RGB(
				h===null ? this.hsv[0] : (this.hsv[0]=h),
				s===null ? this.hsv[1] : (this.hsv[1]=s),
				v===null ? this.hsv[2] : (this.hsv[2]=v)
			);

			this.exportColor(flags);
		};


		this.fromRGB = function(r, g, b, flags) { // null = don't change
			if(r !== null) { r = Math.max(0.0, Math.min(1.0, r)); }
			if(g !== null) { g = Math.max(0.0, Math.min(1.0, g)); }
			if(b !== null) { b = Math.max(0.0, Math.min(1.0, b)); }

			var hsv = RGB_HSV(
				r===null ? this.rgb[0] : r,
				g===null ? this.rgb[1] : g,
				b===null ? this.rgb[2] : b
			);
			if(hsv[0] !== null) {
				this.hsv[0] = Math.max(0.0, this.minH, Math.min(6.0, this.maxH, hsv[0]));
			}
			if(hsv[2] !== 0) {
				this.hsv[1] = hsv[1]===null ? null : Math.max(0.0, this.minS, Math.min(1.0, this.maxS, hsv[1]));
			}
			this.hsv[2] = hsv[2]===null ? null : Math.max(0.0, this.minV, Math.min(1.0, this.maxV, hsv[2]));

			// update RGB according to final HSV, as some values might be trimmed
			var rgb = HSV_RGB(this.hsv[0], this.hsv[1], this.hsv[2]);
			this.rgb[0] = rgb[0];
			this.rgb[1] = rgb[1];
			this.rgb[2] = rgb[2];

			this.exportColor(flags);
		};


		this.fromString = function(hex, flags) {
			var m = hex.match(/^\W*([0-9A-F]{3}([0-9A-F]{3})?)\W*$/i);
			if(!m) {
				return false;
			} else {
				if(m[1].length === 6) { // 6-char notation
					this.fromRGB(
						parseInt(m[1].substr(0,2),16) / 255,
						parseInt(m[1].substr(2,2),16) / 255,
						parseInt(m[1].substr(4,2),16) / 255,
						flags
					);
				} else { // 3-char notation
					this.fromRGB(
						parseInt(m[1].charAt(0)+m[1].charAt(0),16) / 255,
						parseInt(m[1].charAt(1)+m[1].charAt(1),16) / 255,
						parseInt(m[1].charAt(2)+m[1].charAt(2),16) / 255,
						flags
					);
				}
				return true;
			}
		};


		this.toString = function() {
			return (
				(0x100 | Math.round(255*this.rgb[0])).toString(16).substr(1) +
				(0x100 | Math.round(255*this.rgb[1])).toString(16).substr(1) +
				(0x100 | Math.round(255*this.rgb[2])).toString(16).substr(1)
			);
		};


		function RGB_HSV(r, g, b) {
			var n = Math.min(Math.min(r,g),b);
			var v = Math.max(Math.max(r,g),b);
			var m = v - n;
			if(m === 0) { return [ null, 0, v ]; }
			var h = r===n ? 3+(b-g)/m : (g===n ? 5+(r-b)/m : 1+(g-r)/m);
			return [ h===6?0:h, m/v, v ];
		}


		function HSV_RGB(h, s, v) {
			if(h === null) { return [ v, v, v ]; }
			var i = Math.floor(h);
			var f = i%2 ? h-i : 1-(h-i);
			var m = v * (1 - s);
			var n = v * (1 - s*f);
			switch(i) {
				case 6:
				case 0: return [v,n,m];
				case 1: return [n,v,m];
				case 2: return [m,v,n];
				case 3: return [m,n,v];
				case 4: return [n,m,v];
				case 5: return [v,m,n];
			}
		}


		function removePicker() {
			delete jscolor.picker.owner;
			document.getElementsByTagName('body')[0].removeChild(jscolor.picker.boxB);
		}


		function drawPicker(x, y) {
			if(!jscolor.picker) {
				jscolor.picker = {
					box : document.createElement('div'),
					boxB : document.createElement('div'),
					pad : document.createElement('div'),
					padB : document.createElement('div'),
					padM : document.createElement('div'),
					sld : document.createElement('div'),
					sldB : document.createElement('div'),
					sldM : document.createElement('div'),
					btn : document.createElement('div'),
					btnS : document.createElement('span'),
					btnT : document.createTextNode(THIS.pickerCloseText)
				};
				for(var i=0,segSize=4; i<jscolor.images.sld[1]; i+=segSize) {
					var seg = document.createElement('div');
					seg.style.height = segSize+'px';
					seg.style.fontSize = '1px';
					seg.style.lineHeight = '0';
					jscolor.picker.sld.appendChild(seg);
				}
				jscolor.picker.sldB.appendChild(jscolor.picker.sld);
				jscolor.picker.box.appendChild(jscolor.picker.sldB);
				jscolor.picker.box.appendChild(jscolor.picker.sldM);
				jscolor.picker.padB.appendChild(jscolor.picker.pad);
				jscolor.picker.box.appendChild(jscolor.picker.padB);
				jscolor.picker.box.appendChild(jscolor.picker.padM);
				jscolor.picker.btnS.appendChild(jscolor.picker.btnT);
				jscolor.picker.btn.appendChild(jscolor.picker.btnS);
				jscolor.picker.box.appendChild(jscolor.picker.btn);
				jscolor.picker.boxB.appendChild(jscolor.picker.box);
			}

			var p = jscolor.picker;

			// controls interaction
			p.box.onmouseup =
			p.box.onmouseout = function() { target.focus(); };
			p.box.onmousedown = function() { abortBlur=true; };
			p.box.onmousemove = function(e) {
				if (holdPad || holdSld) {
					holdPad && setPad(e);
					holdSld && setSld(e);
					if (document.selection) {
						document.selection.empty();
					} else if (window.getSelection) {
						window.getSelection().removeAllRanges();
					}
					dispatchImmediateChange();
				}
			};
			if('ontouchstart' in window) { // if touch device
				var handle_touchmove = function(e) {
					var event={
						'offsetX': e.touches[0].pageX-touchOffset.X,
						'offsetY': e.touches[0].pageY-touchOffset.Y
					};
					if (holdPad || holdSld) {
						holdPad && setPad(event);
						holdSld && setSld(event);
						dispatchImmediateChange();
					}
					e.stopPropagation(); // prevent move "view" on broswer
					e.preventDefault(); // prevent Default - Android Fix (else android generated only 1-2 touchmove events)
				};
				p.box.removeEventListener('touchmove', handle_touchmove, false)
				p.box.addEventListener('touchmove', handle_touchmove, false)
			}
			p.padM.onmouseup =
			p.padM.onmouseout = function() { if(holdPad) { holdPad=false; jscolor.fireEvent(valueElement,'change'); } };
			p.padM.onmousedown = function(e) {
				// if the slider is at the bottom, move it up
				switch(modeID) {
					case 0: if (THIS.hsv[2] === 0) { THIS.fromHSV(null, null, 1.0); }; break;
					case 1: if (THIS.hsv[1] === 0) { THIS.fromHSV(null, 1.0, null); }; break;
				}
				holdSld=false;
				holdPad=true;
				setPad(e);
				dispatchImmediateChange();
			};
			if('ontouchstart' in window) {
				p.padM.addEventListener('touchstart', function(e) {
					touchOffset={
						'X': e.target.offsetParent.offsetLeft,
						'Y': e.target.offsetParent.offsetTop
					};
					this.onmousedown({
						'offsetX':e.touches[0].pageX-touchOffset.X,
						'offsetY':e.touches[0].pageY-touchOffset.Y
					});
				});
			}
			p.sldM.onmouseup =
			p.sldM.onmouseout = function() { if(holdSld) { holdSld=false; jscolor.fireEvent(valueElement,'change'); } };
			p.sldM.onmousedown = function(e) {
				holdPad=false;
				holdSld=true;
				setSld(e);
				dispatchImmediateChange();
			};
			if('ontouchstart' in window) {
				p.sldM.addEventListener('touchstart', function(e) {
					touchOffset={
						'X': e.target.offsetParent.offsetLeft,
						'Y': e.target.offsetParent.offsetTop
					};
					this.onmousedown({
						'offsetX':e.touches[0].pageX-touchOffset.X,
						'offsetY':e.touches[0].pageY-touchOffset.Y
					});
				});
			}

			// picker
			var dims = getPickerDims(THIS);
			p.box.style.width = dims[0] + 'px';
			p.box.style.height = dims[1] + 'px';

			// picker border
			p.boxB.style.position = 'absolute';
			p.boxB.style.clear = 'both';
			p.boxB.style.left = x+'px';
			p.boxB.style.top = y+'px';
			p.boxB.style.zIndex = THIS.pickerZIndex;
			p.boxB.style.border = THIS.pickerBorder+'px solid';
			p.boxB.style.borderColor = THIS.pickerBorderColor;
			p.boxB.style.background = THIS.pickerFaceColor;

			// pad image
			p.pad.style.width = jscolor.images.pad[0]+'px';
			p.pad.style.height = jscolor.images.pad[1]+'px';

			// pad border
			p.padB.style.position = 'absolute';
			p.padB.style.left = THIS.pickerFace+'px';
			p.padB.style.top = THIS.pickerFace+'px';
			p.padB.style.border = THIS.pickerInset+'px solid';
			p.padB.style.borderColor = THIS.pickerInsetColor;

			// pad mouse area
			p.padM.style.position = 'absolute';
			p.padM.style.left = '0';
			p.padM.style.top = '0';
			p.padM.style.width = THIS.pickerFace + 2*THIS.pickerInset + jscolor.images.pad[0] + jscolor.images.arrow[0] + 'px';
			p.padM.style.height = p.box.style.height;
			p.padM.style.cursor = 'crosshair';

			// slider image
			p.sld.style.overflow = 'hidden';
			p.sld.style.width = jscolor.images.sld[0]+'px';
			p.sld.style.height = jscolor.images.sld[1]+'px';

			// slider border
			p.sldB.style.display = THIS.slider ? 'block' : 'none';
			p.sldB.style.position = 'absolute';
			p.sldB.style.right = THIS.pickerFace+'px';
			p.sldB.style.top = THIS.pickerFace+'px';
			p.sldB.style.border = THIS.pickerInset+'px solid';
			p.sldB.style.borderColor = THIS.pickerInsetColor;

			// slider mouse area
			p.sldM.style.display = THIS.slider ? 'block' : 'none';
			p.sldM.style.position = 'absolute';
			p.sldM.style.right = '0';
			p.sldM.style.top = '0';
			p.sldM.style.width = jscolor.images.sld[0] + jscolor.images.arrow[0] + THIS.pickerFace + 2*THIS.pickerInset + 'px';
			p.sldM.style.height = p.box.style.height;
			try {
				p.sldM.style.cursor = 'pointer';
			} catch(eOldIE) {
				p.sldM.style.cursor = 'hand';
			}

			// "close" button
			function setBtnBorder() {
				var insetColors = THIS.pickerInsetColor.split(/\s+/);
				var pickerOutsetColor = insetColors.length < 2 ? insetColors[0] : insetColors[1] + ' ' + insetColors[0] + ' ' + insetColors[0] + ' ' + insetColors[1];
				p.btn.style.borderColor = pickerOutsetColor;
			}
			p.btn.style.display = THIS.pickerClosable ? 'block' : 'none';
			p.btn.style.position = 'absolute';
			p.btn.style.left = THIS.pickerFace + 'px';
			p.btn.style.bottom = THIS.pickerFace + 'px';
			p.btn.style.padding = '0 15px';
			p.btn.style.height = '18px';
			p.btn.style.border = THIS.pickerInset + 'px solid';
			setBtnBorder();
			p.btn.style.color = THIS.pickerButtonColor;
			p.btn.style.font = '12px sans-serif';
			p.btn.style.textAlign = 'center';
			try {
				p.btn.style.cursor = 'pointer';
			} catch(eOldIE) {
				p.btn.style.cursor = 'hand';
			}
			p.btn.onmousedown = function () {
				THIS.hidePicker();
			};
			p.btnS.style.lineHeight = p.btn.style.height;

			// load images in optimal order
			switch(modeID) {
				case 0: var padImg = 'hs.png'; break;
				case 1: var padImg = 'hv.png'; break;
			}
			p.padM.style.backgroundImage = "url('"+jscolor.getDir()+"cross.gif')";
			p.padM.style.backgroundRepeat = "no-repeat";
			p.sldM.style.backgroundImage = "url('"+jscolor.getDir()+"arrow.gif')";
			p.sldM.style.backgroundRepeat = "no-repeat";
			p.pad.style.backgroundImage = "url('"+jscolor.getDir()+padImg+"')";
			p.pad.style.backgroundRepeat = "no-repeat";
			p.pad.style.backgroundPosition = "0 0";

			// place pointers
			redrawPad();
			redrawSld();

			jscolor.picker.owner = THIS;
			document.getElementsByTagName('body')[0].appendChild(p.boxB);
		}


		function getPickerDims(o) {
			var dims = [
				2*o.pickerInset + 2*o.pickerFace + jscolor.images.pad[0] +
					(o.slider ? 2*o.pickerInset + 2*jscolor.images.arrow[0] + jscolor.images.sld[0] : 0),
				o.pickerClosable ?
					4*o.pickerInset + 3*o.pickerFace + jscolor.images.pad[1] + o.pickerButtonHeight :
					2*o.pickerInset + 2*o.pickerFace + jscolor.images.pad[1]
			];
			return dims;
		}


		function redrawPad() {
			// redraw the pad pointer
			switch(modeID) {
				case 0: var yComponent = 1; break;
				case 1: var yComponent = 2; break;
			}
			var x = Math.round((THIS.hsv[0]/6) * (jscolor.images.pad[0]-1));
			var y = Math.round((1-THIS.hsv[yComponent]) * (jscolor.images.pad[1]-1));
			jscolor.picker.padM.style.backgroundPosition =
				(THIS.pickerFace+THIS.pickerInset+x - Math.floor(jscolor.images.cross[0]/2)) + 'px ' +
				(THIS.pickerFace+THIS.pickerInset+y - Math.floor(jscolor.images.cross[1]/2)) + 'px';

			// redraw the slider image
			var seg = jscolor.picker.sld.childNodes;

			switch(modeID) {
				case 0:
					var rgb = HSV_RGB(THIS.hsv[0], THIS.hsv[1], 1);
					for(var i=0; i<seg.length; i+=1) {
						seg[i].style.backgroundColor = 'rgb('+
							(rgb[0]*(1-i/seg.length)*100)+'%,'+
							(rgb[1]*(1-i/seg.length)*100)+'%,'+
							(rgb[2]*(1-i/seg.length)*100)+'%)';
					}
					break;
				case 1:
					var rgb, s, c = [ THIS.hsv[2], 0, 0 ];
					var i = Math.floor(THIS.hsv[0]);
					var f = i%2 ? THIS.hsv[0]-i : 1-(THIS.hsv[0]-i);
					switch(i) {
						case 6:
						case 0: rgb=[0,1,2]; break;
						case 1: rgb=[1,0,2]; break;
						case 2: rgb=[2,0,1]; break;
						case 3: rgb=[2,1,0]; break;
						case 4: rgb=[1,2,0]; break;
						case 5: rgb=[0,2,1]; break;
					}
					for(var i=0; i<seg.length; i+=1) {
						s = 1 - 1/(seg.length-1)*i;
						c[1] = c[0] * (1 - s*f);
						c[2] = c[0] * (1 - s);
						seg[i].style.backgroundColor = 'rgb('+
							(c[rgb[0]]*100)+'%,'+
							(c[rgb[1]]*100)+'%,'+
							(c[rgb[2]]*100)+'%)';
					}
					break;
			}
		}


		function redrawSld() {
			// redraw the slider pointer
			switch(modeID) {
				case 0: var yComponent = 2; break;
				case 1: var yComponent = 1; break;
			}
			var y = Math.round((1-THIS.hsv[yComponent]) * (jscolor.images.sld[1]-1));
			jscolor.picker.sldM.style.backgroundPosition =
				'0 ' + (THIS.pickerFace+THIS.pickerInset+y - Math.floor(jscolor.images.arrow[1]/2)) + 'px';
		}


		function isPickerOwner() {
			return jscolor.picker && jscolor.picker.owner === THIS;
		}


		function blurTarget() {
			if(valueElement === target) {
				THIS.importColor();
			}
			if(THIS.pickerOnfocus) {
				THIS.hidePicker();
			}
		}


		function blurValue() {
			if(valueElement !== target) {
				THIS.importColor();
			}
		}


		function setPad(e) {
			var mpos = jscolor.getRelMousePos(e);
			var x = mpos.x - THIS.pickerFace - THIS.pickerInset;
			var y = mpos.y - THIS.pickerFace - THIS.pickerInset;
			switch(modeID) {
				case 0: THIS.fromHSV(x*(6/(jscolor.images.pad[0]-1)), 1 - y/(jscolor.images.pad[1]-1), null, leaveSld); break;
				case 1: THIS.fromHSV(x*(6/(jscolor.images.pad[0]-1)), null, 1 - y/(jscolor.images.pad[1]-1), leaveSld); break;
			}
		}


		function setSld(e) {
			var mpos = jscolor.getRelMousePos(e);
			var y = mpos.y - THIS.pickerFace - THIS.pickerInset;
			switch(modeID) {
				case 0: THIS.fromHSV(null, null, 1 - y/(jscolor.images.sld[1]-1), leavePad); break;
				case 1: THIS.fromHSV(null, 1 - y/(jscolor.images.sld[1]-1), null, leavePad); break;
			}
		}


		function dispatchImmediateChange() {
			if (THIS.onImmediateChange) {
				var callback;
				if (typeof THIS.onImmediateChange === 'string') {
					callback = new Function (THIS.onImmediateChange);
				} else {
					callback = THIS.onImmediateChange;
				}
				callback.call(THIS);
			}
		}


		var THIS = this;
		var modeID = this.pickerMode.toLowerCase()==='hvs' ? 1 : 0;
		var abortBlur = false;
		var
			valueElement = jscolor.fetchElement(this.valueElement),
			styleElement = jscolor.fetchElement(this.styleElement);
		var
			holdPad = false,
			holdSld = false,
			touchOffset = {};
		var
			leaveValue = 1<<0,
			leaveStyle = 1<<1,
			leavePad = 1<<2,
			leaveSld = 1<<3;

		// target
		jscolor.addEvent(target, 'focus', function() {
			if(THIS.pickerOnfocus) { THIS.showPicker(); }
		});
		jscolor.addEvent(target, 'blur', function() {
			if(!abortBlur) {
				window.setTimeout(function(){ abortBlur || blurTarget(); abortBlur=false; }, 0);
			} else {
				abortBlur = false;
			}
		});

		// valueElement
		if(valueElement) {
			var updateField = function() {
				THIS.fromString(valueElement.value, leaveValue);
				dispatchImmediateChange();
			};
			jscolor.addEvent(valueElement, 'keyup', updateField);
			jscolor.addEvent(valueElement, 'input', updateField);
			jscolor.addEvent(valueElement, 'blur', blurValue);
			valueElement.setAttribute('autocomplete', 'off');
		}

		// styleElement
		if(styleElement) {
			styleElement.jscStyle = {
				backgroundImage : styleElement.style.backgroundImage,
				backgroundColor : styleElement.style.backgroundColor,
				color : styleElement.style.color
			};
		}

		// require images
		switch(modeID) {
			case 0: jscolor.requireImage('hs.png'); break;
			case 1: jscolor.requireImage('hv.png'); break;
		}
		jscolor.requireImage('cross.gif');
		jscolor.requireImage('arrow.gif');

		this.importColor();
	}

};


jscolor.install();
