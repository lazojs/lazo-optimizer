var _ = require('lodash');
var path = require('path');
var async = require('async');
var fs = require('fs-extra');
var lazoPath = 'node_modules/lazo';
var requirejs = require('requirejs');
var dir = require('node-dir');
var CleanCss = require('clean-css');

try {
    lazoPath = path.dirname(require.resolve('lazo'));
} catch (e) {
    // swallow the "error"; user should define the path
    // to lazo if it cannot be resolved
}

var defaults = {
    lazoPath: lazoPath,
    appPath: '.',
    config: {},
    jsFilter: function (includes, files, paths) {
        return includes;
    },
    includeExtensions: ['.hbs', '.json', '.js'],
    loaders: {
        '.hbs': 'text',
        '.json': 'json'
    },
    cssFilter: function (file) {
        return path.extname(file) === '.css';
    },
    sortCss: function (files) {
        return files;
    },
    minifyCss: true,
    cssOut: 'app/bundles/application.css',
    excludeBundles: function (files) {
        return files.filter(function (file) {
            return file.indexOf('app/bundles/') === -1;
        });
    }
};

module.exports = {

    // CSS bundling
    bundleCss: function (options, callback) {
        var self = this;
        options = _.defaults(options, defaults);

        this.getCssFiles(options.appPath, options.cssFilter, function (err, files) {
            if (err) {
                return callback(err);
            }

            files = files.filter(function (file) {
                return file.indexOf(options.cssOut) === -1;
            });

            self.readCssFiles(options.appPath, options.sortCss(files), function (err, files) {
                if (err) {
                    return callback(err);
                }

                var cssStr = self.concatMinifyCss(files, options.minifyCss);
                var outFile = path.join(options.appPath, options.cssOut);
                fs.ensureDir(path.dirname(outFile), function (err) {
                    if (err) {
                        return callback(err);
                    }

                    fs.writeFile(outFile, cssStr, function (err) {
                        if (err) {
                            return callback(err);
                        }

                        callback(null, { files: files, out: outFile });
                    });
                });
            });
        });
    },

    concatMinifyCss: function (css, minify) {
        var cssStr = '';
        css.forEach(function (cssDef, i) {
            cssStr += (i ? '\n\n'  : '') + '/* ' + cssDef.path + ' */' + '\n' + cssDef.contents;
        });

        return minify ? new CleanCss({
            target: './'
        }).minify(cssStr).styles : cssStr;
    },

    readCssFiles: function (appPath, files, callback) {
        var self = this;
        var tasks = [];

        files.forEach(function (file) {
            tasks.push(function (callback) {
                fs.readFile(path.join(appPath, file), 'utf8', function (err, cssStr) {
                    if (err) {
                        return callback(err);
                    }
                    callback(null, { path: file, contents: self.resolveImgPaths(cssStr, file) });
                });
            });
        });

        async.parallel(tasks, function (err, results) {
            if (err) {
                return callback(err);
            }

            callback(null, results);
        });
    },

    resolveImgPaths: function (cssStr, cssFilePath) {
        var urlRegex = /(?:\@import)?\s*url\(\s*(['"]?)(\S+)\1\s*\)/g;

        // set image urls to absolute paths
        return cssStr.replace(urlRegex, function (match, quote, img, offset, str) {
            var absoluteUrl;

            // already using absolute path
            if (img.substr(0, 1) === '/') {
                return str;
            }

            return match.replace(img, (path.resolve(path.dirname(cssFilePath), img)));
        });
    },

    getCssFiles: function (appPath, filter, callback) {
        var self = this;

        async.parallel({
            appCss: function (callback) {
                fs.readJson(path.join(appPath, 'app', 'app.json'), function (err, appJson) {
                    if (err) {
                        return callback(err);
                    }

                    callback(null, appJson.css || []);
                });
            },
            allCss: function (callback) {
                dir.files(appPath, function (err, files) {
                    if (err) {
                        return callback(err);
                    }

                    callback(null, files.filter(filter));
                });
            }
        }, function (err, files) {
            if (err) {
                return callback(err);
            }
            var regex = new RegExp('^' + appPath);
            var cssFiles = _.uniq(files.appCss.concat(files.allCss).map(function (file) {
                return file.replace(regex, '');
            }));

            callback(null, cssFiles);
        });
    },

    // JS bundling
    bundleJS: function (options, callback) {
        var self = this;
        options = _.defaults(options, defaults);

        this.copyLoaders(options.lazoPath, options.appPath, function (err) {
            if (err) {
                return callback(err);
            }

            self.mergeConfigs(options, function (err, config) {
                if (err) {
                    return callback(err);
                }

                requirejs.optimize(config, function (buildResponse) {
                    self.removeLoaders(options.appPath, function (err) {
                        if (err) {
                            return callback(err);
                        }

                        callback(null, { out: config.out, response: buildResponse });
                    });
                });
            });
        });
    },

    copyLoaders: function (src, dest, callback) {
        var tasks = [];
        var files = [
            {
                src: path.normalize(path.join(src, 'lib', 'client', 'loader.js')),
                dest: path.normalize(path.join(dest, 'loader.js'))
            },
            {
                src: path.normalize(path.join(src, 'lib', 'vendor', 'text.js')),
                dest: path.normalize(path.join(dest, 'text.js'))
            },
            {
                src: path.normalize(path.join(src, 'lib','vendor', 'json.js')),
                dest: path.normalize(path.join(dest, 'json.js'))
            }
        ];

        files.forEach(function (file) {
            tasks.push(function (callback) {
                fs.copy(file.src, file.dest, function (err) {
                    callback(err || null);
                });
            });
        });

        async.parallel(tasks, function (err) {
            callback(err || null);
        });
    },

    removeLoaders: function (src, callback) {
        var tasks = [];
        var paths = [
            path.join(src, 'loader.js'),
            path.join(src, 'text.js'),
            path.join(src, 'json.js')
        ];

        paths.forEach(function (loaderPath) {
            tasks.push(function (callback) {
                fs.remove(loaderPath, function (err) {
                    callback(err || null);
                });
            });
        });


        async.parallel(tasks, function (err) {
            callback(err || null);
        });
    },

    getPaths: function (lazoPath, appPath, callback) {
        var self = this;

        async.parallel({
            appPaths: function (callback) {
                self.getAppPaths(appPath, function (err, appPaths) {
                    if (err) {
                        return callback(err);
                    }

                    callback(null, appPaths);
                });
            },
            lazoPaths: function (callback) {
                self.getLazoPaths(lazoPath, function (err, lazoPaths) {
                    if (err) {
                        return callback(err);
                    }

                    callback(null, lazoPaths);
                });
            }

        }, function (err, paths) {
            if (err) {
                return callback(err);
            }

            // do NOT allow the overriding of jQuery; we should be namespacing lazo modules!!!
            callback(null, _.extend(paths.lazoPaths, _.omit(paths.appPaths, 'jquery')));
        });
    },

    getAppPaths: function (appPath, callback) {
        var appConfPath = path.join(appPath, 'conf.json');

        fs.exists(appConfPath, function (exists) {
            if (!exists) {
                return callback(null);
            }

            fs.readJson(appConfPath, function (err, json) {
                if (err) {
                    return callback(err);
                }
                var commonPaths = json.requirejs && json.requirejs.common &&
                    json.requirejs.common.paths ? json.requirejs.common.paths : {};
                var clientPaths = json.requirejs && json.requirejs.client &&
                    json.requirejs.client.paths ? json.requirejs.client.paths : {};

                callback(null, _.extend(commonPaths, clientPaths));
            });
        });
    },

    getLazoPaths: function (lazoPath, callback) {
        var lazoConfJson = path.join(lazoPath, 'lib', 'common', 'resolver', 'paths.json');

        fs.readJson(lazoConfJson, function (err, json) {
            if (err) {
                return callback(err);
            }
            var lazoPaths = _.extend({}, json.common, json.client);

            for (var key in lazoPaths) {
                if (key === 'text' || key === 'json') {
                    lazoPaths[key] = key;
                } else {
                    lazoPaths[key] = 'empty:';
                }
            }

            callback(null, lazoPaths);
        });
    },

    getJSIncludes: function (appPath, callback) {
        dir.files(appPath, function (err, files) {
            if (err) {
                return callback(err);
            }

            files = files.filter(function (file) {
                return file.indexOf('\/server\/') === -1;
            });

            callback(null, files);
        });
    },

    getLoaderPrefix: function (filePath, loaders) {
        var ext = path.extname(filePath);
        return loaders[ext] ? loaders[ext] + '!' + filePath :
            filePath;
    },

    getDefaultConfig: function (options, callback) {
        var self = this;
        options = _.defaults(options, defaults);

        async.parallel({
            paths: function (callback) {
                self.getPaths(options.lazoPath, options.appPath, function (err, paths) {
                    if (err) {
                        return callback(err);
                    }

                    callback(null, paths);
                });
            },
            appConf: function (callback) {
                var appConfPath = path.join(options.appPath, 'conf.json');

                fs.exists(appConfPath, function (exists) {
                    if (!exists) {
                        return callback(null, {});
                    }

                    fs.readJson(path.join(options.appPath, 'conf.json'), function (err, conf) {
                        if (err) {
                            return callback(err);
                        }

                        callback(null, ((conf.requirejs && conf.requirejs.client) || {}));
                    });
                });
            },
            lazoConf: function (callback) {
                fs.readJson(path.join(options.lazoPath, 'conf.json'), function (err, conf) {
                    if (err) {
                        return callback(err);
                    }

                    callback(null, conf.requirejs.client);
                });
            },
            includes: function (callback) {
                // 1. scan dir; filtered by extension
                // 2. if path has a module id discard it
                // 3. remove anything that should be 'empty:', i.e., lazo included it
                // 4. hookpoint for modifying includes includes, files
                // 5. exclude bundle(s)
                async.waterfall([
                    function (callback) {
                        async.parallel({
                            paths: function (callback) {
                                self.getPaths(options.lazoPath, options.appPath, function (err, paths) {
                                    if (err) {
                                        return callback(err);
                                    }

                                    callback(null, paths);
                                });
                            },
                            includes: function (callback) {
                                self.getJSIncludes(options.appPath, function (err, files) {
                                    if (err) {
                                        return callback(err);
                                    }

                                    function addLoaderPrefix(include, ext) {
                                        return options.loaders[ext] + '!' + include;
                                    }

                                    files = files.filter(function (file) {
                                        return options.includeExtensions.indexOf(path.extname(file)) !== -1;
                                    }).map(function (include) {
                                        var relativePath = include.replace(options.appPath + path.sep, '');
                                        var extension = path.extname(relativePath);
                                        return extension === '.js' ?
                                            relativePath.substr(0, relativePath.lastIndexOf('.js')) : addLoaderPrefix(relativePath, extension);
                                    });

                                    callback(null, files);
                                });
                            }
                        }, function (err, results) {
                                if (err) {
                                    return callback(err);
                                }

                                callback(null, results.includes, results.paths);
                        });
                    },
                    function (includes, paths, callback) {
                        self.getPaths(options.lazoPath, options.appPath, function (err, paths) {
                            var idsByPath = {};
                            var filtered;

                            for (var k in paths) {
                                idsByPath[paths[k]] = k;
                            }
                            filtered = includes.filter(function (include) {
                                var extension = path.extname(include);
                                var modulePath = extension === '.js' ? include.substr(0, include.lastIndexOf('.js')) :
                                    include;

                                return !idsByPath[modulePath];
                            });

                            callback(null, filtered, includes, paths);
                        });
                    },
                    function (includes, files, paths, callback) {
                        var idsByPath = {};

                        for (var k in paths) {
                            idsByPath[paths[k]] = k;
                        }

                        includes = includes.filter(function (include) {
                            return idsByPath[include] !== 'empty:';
                        });

                        callback(null, includes, files, paths);
                    },
                    function (includes, files, paths, callback) {
                        callback(null, options.jsFilter(includes, files, paths), files, paths);
                    },
                    function (includes, files, paths, callback) {
                        callback(null, options.excludeBundles(includes));
                    }
                ], function (err, includes) {
                    callback(null, includes);
                });
            }
        }, function (err, configs) {
            if (err) {
                return callback(err);
            }

            var config = _.merge({
                stubModules: ['text', 'json', 'l'],
                map: {
                    '*': {
                        'l': path.normalize('loader.js')
                    }
                },
                outFileName: 'application.js',
                mainConfigFile: '',
                baseUrl: options.appPath,
                optimize: 'uglify2',
                logLevel: 4,
                out: path.join(options.appPath, 'app', 'bundles', 'application.js')
            }, configs.lazoConf, configs.appConf, options.config);

            config.include = configs.includes;
            config.paths = configs.paths;

            callback(null, config);
        });
    },

    mergeConfigs: function (options, callback) {
        options = _.defaults(options, defaults);
        this.getDefaultConfig(options, function (err, defaultConfig) {
            if (err) {
                return callback(err);
            }

            callback(null, _.merge(defaultConfig, options.config));
        });
    }

};