require('../index').bundle({ appPath: 'application', lazoPath: '../../lazo' }, function (err, response) {
    console.log('HELLO');
    console.log(err || response);
});