var _ = require('lodash');
var path = require('path');
var async = require('async');
var fs = require('fs-extra');
var lazoPath = 'node_modules/lazo';
var requirejs = require('requirejs');
var dir = require('node-dir');
var CleanCss = require('clean-css');

try {
    lazoPath = require.resolve('lazo');
} catch (e) {
    // swallow the "error"; user should define the path
    // to lazo if it cannot be resolved
}

var defaults = {
    lazoPath: lazoPath,
    appPath: '.',
    config: {},
    includeFilter: function (files, extensions, appPath, loaders, loaderResolver) {
        return files.filter(function (filePath) {
            return _.contains(extensions, path.extname(filePath));
        }).map(function (filePath) {
            var relativePath = filePath.replace(appPath + path.sep, '');
            return path.extname(relativePath) === '.js' ?
                relativePath.substr(0, relativePath.lastIndexOf('.js')) : loaderResolver(relativePath, loaders);
        });
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
    cssOut: 'app/bundles/application.css'
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

    concatMinifyCss: function (css, minify, callback) {
        var cssStr = '';
        css.forEach(function (cssDef, i) {
            cssStr += (i ? '\n\n'  : '') + '/* ' + cssDef.path + ' */' + '\n' + cssDef.contents;
        });

        return minify ? new CleanCss().minify(cssStr).styles : cssStr;
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
            var cssFiles = _.uniq(files.appCss.concat(files.allCss).map(function (file) {
                return file.replace(appPath, '');
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
        this.getLazoPaths(lazoPath, function (err, lazoPaths) {
            var appConfPath = path.join(appPath, 'conf.json');

            fs.exists(appConfPath, function (exists) {
                if (!exists) {
                    return callback(null, lazoPaths);
                }

                fs.readJson(appConfPath, function (err, json) {
                    if (err) {
                        return callback(err);
                    }
                    var commonPaths = json.requirejs && json.requirejs.common ?
                        json.requirejs.common : {};
                    var clientPaths = json.requirejs && json.requirejs.client ?
                        json.requirejs.client : {};

                    callback(null, _.extend(lazoPaths, commonPaths, clientPaths));
                });
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
        return loaders[ext] + '!' + filePath;
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
                self.getJSIncludes(options.appPath, function (err, files) {
                    if (err) {
                        return callback(err);
                    }

                    callback(null, files);
                });
            }
        }, function (err, configs) {
            if (err) {
                return callback(err);
            }

            callback(null, _.merge({
                include: options.includeFilter(configs.includes, options.includeExtensions, options.appPath, options.loaders, self.getLoaderPrefix),
                stubModules: ['text', 'json', 'l'],
                paths: configs.paths,
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
            }, configs.lazoConf, configs.appConf));
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