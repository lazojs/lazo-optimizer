require('../index').bundleCss({ appPath: 'application', lazoPath: '../../lazo', minifyCss: false }, function (err, response) {
    console.log(err || response);
});