// require('../index').bundleCss({ appPath: 'application', lazoPath: '../../lazo', minifyCss: false }, function (err, response) {
//     console.log(err || response);
// });

var optimizer = require('../index');
var chai = require('chai');
var fs = require('fs-extra');
var path = require('path');

describe('lazo-optimizer', function () {

    before(function (done) {
        fs.remove('test/application/app/bundles', function (err) {
            if (err) {
                throw err;
            }

            optimizer.removeLoaders('test/application', function (err) {
                if (err) {
                    throw err;
                }

                done();
            });
        });
    });

    it('should create a CSS bundle', function (done) {
        optimizer.bundleCss({ appPath: 'test/application' }, function (err, response) {
            if (err) {
                throw err;
            }

            chai.expect(fs.existsSync('test/application/app/bundles/application.css')).to.be.true;
            done();
        });
    });

    it('should concatenate and minify a CSS string', function () {
        var defs = [{
            path: 'app/client/app.css',
            contents: 'html {\n\u0020\u0020height: 100%;\n}\n\nbody {\n\u0020\u0020background: #fff;\n}'
        }, {
            path: 'components/foo/index.css',
            contents: '[lazo-cmp-name="foo"] p {\n\u0020\u0020padding: 10px;\n}'
        }];

        // minified
        chai.expect(optimizer.concatMinifyCss(defs, true)).to.be
            .equal('html{height:100%}body{background:#fff}[lazo-cmp-name=foo] p{padding:10px}');

        // unminified
        chai.expect(optimizer.concatMinifyCss(defs, false)).to.be
            .equal('/* app/client/app.css */\nhtml {\n  height: 100%;\n}\n\nbody {\n  background: #fff;\n}\n\n/* components/foo/index.css */\n[lazo-cmp-name="foo"] p {\n  padding: 10px;\n}');
    });

    it('should read CSS files', function (done) {
        var files = [
            'app/css/layout.css',
            'app/css/theme.css',
            'components/a/grid.css',
            'components/a/index.css',
            'components/a/list.css',
            'components/b/styles/grid.css',
            'components/b/styles/index.css',
            'components/b/styles/list.css'
        ];

        optimizer.readCssFiles('test/application', files, function (err, css) {
            chai.expect(css.length).to.be.equal(files.length);
            done();
        });
    });

    it('should resolve image, font URLs in a CSS string', function () {
        var css = 'background: url(images/foo.png); background: url(images/bar.png);';
        var expected = 'background: url(/components/example/images/foo.png); background: url(/components/example/images/bar.png);';

        chai.expect(optimizer.resolveImgPaths(css, '/components/example/index.css')).to.be.equal(expected);
    });

    it('should read CSS files', function (done) {

        function filter(file) {
            return path.extname(file) === '.css' &&
                file.indexOf('/app/bundles/application.css') === -1;
        }

        optimizer.getCssFiles('test/application', filter, function (err, files) {
            if (err) {
                throw err;
            }

            chai.expect(files.length).to.be.equal(8);
            chai.expect(files[0]).to.be.equal('/app/css/layout.css');
            chai.expect(files[1]).to.be.equal('/app/css/theme.css');
            done();
        });
    });

    it('should create a JS bundle', function (done) {
        optimizer.bundleJS({ appPath: 'test/application' }, function (err, response) {
            if (err) {
                throw err;
            }

            chai.expect(fs.existsSync('test/application/app/bundles/application.js')).to.be.true;
            done();
        });
    });

    it('should copy module loaders', function (done) {
        var lazoPath = path.dirname(require.resolve('lazo'));

        optimizer.copyLoaders(lazoPath, 'test/application', function (err) {
            if (err) {
                throw err;
            }

            chai.expect(fs.existsSync('test/application/json.js')).to.be.true;
            chai.expect(fs.existsSync('test/application/loader.js')).to.be.true;
            chai.expect(fs.existsSync('test/application/text.js')).to.be.true;
            done();
        });
    });

    it('should copy module loaders', function (done) {
        var lazoPath = path.dirname(require.resolve('lazo'));

        optimizer.copyLoaders(lazoPath, 'test/application', function (err) {
            if (err) {
                throw err;
            }

            optimizer.removeLoaders('test/application', function () {
                if (err) {
                    throw err;
                }

                chai.expect(fs.existsSync('test/application/json.js')).to.be.false;
                chai.expect(fs.existsSync('test/application/loader.js')).to.be.false;
                chai.expect(fs.existsSync('test/application/text.js')).to.be.false;
                done();
            });
        });
    });

    it('should get the path configuration', function (done) {
        var lazoPath = path.dirname(require.resolve('lazo'));
        var expected = ['foo', 'bar', 'text', 'json'];

        optimizer.getPaths(lazoPath, 'test/application', function (err, paths) {
            if (err) {
                throw err;
            }

            chai.expect(paths.foo).to.be.equal('app/foo');
            chai.expect(paths.bar).to.be.equal('app/bar');
            chai.expect(paths.text).to.be.equal('text');
            chai.expect(paths.json).to.be.equal('json');

            for (var k in paths) {
                if (expected.indexOf(k) === -1) {
                    chai.expect(paths[k]).to.be.equal('empty:');
                }
            }

            done();
        });
    });

    it('should get the application path configuration', function (done) {
        optimizer.getAppPaths('test/application', function (err, paths) {
            if (err) {
                throw err;
            }

            chai.expect(Object.keys(paths).length).to.be.equal(2);
            chai.expect(paths.foo).to.be.equal('app/foo');
            chai.expect(paths.bar).to.be.equal('app/bar');
            done();
        });
    });


    it('should get the lazo path configuration', function (done) {
        var lazoPath = path.dirname(require.resolve('lazo'));
        var expected = ['text', 'json'];

        optimizer.getLazoPaths(lazoPath, function (err, paths) {
            if (err) {
                throw err;
            }

            chai.expect(paths.text).to.be.equal('text');
            chai.expect(paths.json).to.be.equal('json');

            for (var k in paths) {
                if (expected.indexOf(k) === -1) {
                    chai.expect(paths[k]).to.be.equal('empty:');
                }
            }

            done();
        });
    });

    it('should get the javascript includes for an application', function (done) {
        optimizer.getJSIncludes('test/application', function (err, includes) {
            if (err) {
                throw err;
            }

            includes = includes.filter(function (file) {
                return path.extname(file) === '.js' &&
                    file.indexOf('\/bundles\/') === -1;
            });

            chai.expect(includes.length).to.be.equal(3);
            done();
        });
    });

    it('should prefix a file path with a loader', function () {
        var loaders = {
            '.hbs': 'text',
            '.json': 'json'
        };

        chai.expect(optimizer.getLoaderPrefix('app/views/layout.hbs', loaders)).to.be
            .equal('text!app/views/layout.hbs');
        chai.expect(optimizer.getLoaderPrefix('app/app.json', loaders)).to.be
            .equal('json!app/app.json');
        chai.expect(optimizer.getLoaderPrefix('app/application.js', loaders)).to.be
            .equal('app/application.js');
    });

    it('should get the default configuration for an application', function (done) {
        optimizer.getDefaultConfig({ appPath: 'test/application' }, function (err, config) {
            if (err) {
                throw err;
            }

            chai.expect(config.include.length).to.be.equal(3);
            chai.expect(config.baseUrl).to.be.equal('test/application');
            chai.expect(config.stubModules.length).to.be.equal(3);
            done();
        });
    });

    it('should merge configuration options with the default configuration', function (done) {
        optimizer.mergeConfigs({
            appPath: 'test/application',
            config: {
                optimize: 'none',
                logLevel: 1
            }
        }, function (err, config) {
            if (err) {
                throw err;
            }

            chai.expect(config.optimize).to.be.equal('none');
            chai.expect(config.logLevel).to.be.equal(1);
            done();
        });
    });

});