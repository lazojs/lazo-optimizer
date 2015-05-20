var _ = require('lodash');
var path = require('path');
var async = require('async');
var fs = require('fs-extra');
var lazoPath = 'node_modules/lazo';
var requirejs = require('requirejs');
var dir = require('node-dir');

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
    }
};

module.exports = {

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

    bundle: function (options, callback) {
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

    getIncludes: function (appPath, callback) {
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
                self.getIncludes(options.appPath, function (err, files) {
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