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

            done();
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

    it('should resolve image URLs in a CSS string', function () {
        var css = 'background: url(images/foo.png); background: url(images/bar.png);';

        console.log(optimizer.resolveImgPaths(css, 'components/example/index.css'));
    });

});