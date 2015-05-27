# lazo-optimizer
The lazo-optimizer was designed to bundle Lazo application JavaScript and CSS. The default implementation
creates a single bundle for JavaScript and single bundle for CSS. There are also a number of utility functions
that can be leveraged to support custom bundling.

* [Default Options](default-options)
* [JavaScript Bundling](javaccript-bundling)
* [CSS Bundling](css-bundling)

## Default Options

The default options for [`bundleJS`](#javascript-bundling),
[`bundleCSS`](lazo-optimizer#css-bundling), and all functions that accept an `options`
object are:

```javascript
    // the path to lazo; used to get the requirejs config for lazo
    lazoPath: require.resolve('lazo') || 'node_modules/lazo',
    // the path to the application to be bundled
    appPath: '.',
    // default requirejs configuration overrides
    config: {},
    // used to filter out any files from the bundle
    jsFilter: function (includes, files, paths) {
        return includes;
    },
    // files to be included in the build
    includeExtensions: ['.hbs', '.json', '.js'],
    // loader to be used for a file type by extension
    loaders: {
        '.hbs': 'text',
        '.json': 'json'
    },
    // used to filter CSS files
    cssFilter: function (file) {
        return path.extname(file) === '.css';
    },
    // used to sort the order in which CSS files are concatenated
    sortCss: function (files) {
        return files;
    },
    // minify the concatenated CSS
    minifyCss: true,
    // where to write the CSS bundle
    cssOut: 'app/bundles/application.css',
    // exclude the JS bundle when bundling (app/bundles/application.js)
    excludeBundles: function (files) {
        return files.filter(function (file) {
            return file.indexOf('app/bundles/') === -1;
        });
    }
```

## JavaScript Bundling
The primary interface for bundling JavaScript is the `bundleJS` function:

> `bundleJS` delgates to the
[Require.js optimizer](http://requirejs.org/docs/optimization.html) using a default configuration. Any configuration
values can be overriden to handle your specific use case. Please defer to
[Require.js optimizer](http://requirejs.org/docs/optimization.html) documentaton for further help.

```javascript
var optimizer = require('lazo-optimizer');

optimizer.bundleJS({
    appPath: 'path/to/your/application'
}, function (err, buildResponse) {
    if (err) {
        throw err;
    }

    console.log(buildResponse);
});
```

### JavaScript Bundling Utilities
JavaScript bundling related utilities.

*Note - All callbacks return `err`, `[results]`.*

#### `copyLoaders(lazoPath, appPath, callback)`
Copies the `text`, `json`, and `l` (loaders) to the root of an application for
the Require.js optimizer.

##### Arguments
1. `lazoPath` *(String)*: Path to the Lazo node module directory.
1. `appPath` *(String)*: Path to the application directory.
1. `callback` *(Function)*: Function to be executed once the loaders have been copied.

#### `removeLoaders(appPath, callback)`
Deletes the `text`, `json`, and `l` (loaders) from the root of an application.

##### Arguments
1. `appPath` *(String)*: Path to the application directory.
1. `callback` *(Function)*: Function to be executed once the loaders have been deleted.

#### `getPaths(lazoPath, appPath, callback)`
Gets the path configuration for Lazo and an application (reads
[conf.json](https://github.com/lazojs/lazo/wiki/Configuration#confjson)). Delegates to
`getLazoPaths` and `getAppPaths` merging the results.

##### Arguments
1. `lazoPath` *(String)*: Path to the Lazo node module directory.
1. `appPath` *(String)*: Path to the application directory.
1. `callback` *(Function)*: Function to be executed once the paths have been resolved.

#### `getAppPaths(appPath, callback)`
Gets the path configuration for an application (reads
[conf.json](https://github.com/lazojs/lazo/wiki/Configuration#confjson)).

##### Arguments
1. `appPath` *(String)*: Path to the application directory.
1. `callback` *(Function)*: Function to be executed once the paths have been resolved.

#### `getLazoPaths(lazoPath, callback)`
Gets the path configuration for Lazo. Replaces all module id values with "empty:".

##### Arguments
1. `lazoPath` *(String)*: Path to the Lazo node module directory.
1. `callback` *(Function)*: Function to be executed once the paths have been resolved.

#### `getJSIncludes(appPath, callback)`
Reads the application directory returning an array of files. Excludes `server/**/*`.

##### Arguments
1. `appPath` *(String)*: Path to the application directory.
1. `callback` *(Function)*: Function to be executed once the application directory has been read.

#### `getLoaderPrefix(filePath, loaders)`
Prefixes file path with loader, e.g., `text!app/app.json`, if required.

##### Arguments
1. `filePath` *(String)*: File path to prefix.
1. `loaders` *(Object)*: Loaders map, (`options.loaders`).

##### Returns
*(String)*: File path with loader prefix if file extension maps to a loader.

#### `getDefaultConfig(options, callback)`
Gets the default configuration for the Require.js optimizer.

##### Arguments
1. `options` *(Object)*: Overrides for [default options](#default-options).
1. `callback` *(Function)*: Function to be executed once the configuration has been generated.

#### `removePathsWithModuleIds: function (files, paths)`
Removes files from the includes that have a module id in the paths configuration.

##### Arguments
1. `files` *(Array)*: Include file paths.
1. `paths` *(Object)*: Paths configuration.

##### Returns
*(Array)*: Filtered file paths.

#### `mergeConfigs(options, callback)`
Merges the default configuration with an overrides in `options.config`.

##### Arguments
1. `options` *(Object)*: Overrides for [default options](#default-options).
1. `callback` *(Function)*: Function to be executed once the configuration has been merged.

## CSS Bundling
The primary interface for bundling CSS is the `bundleCss` function:

```javascript
var optimizer = require('lazo-optimizer');

optimizer.bundleCss({
    appPath: 'path/to/your/application'
}, function (err, buildResponse) {
    if (err) {
        throw err;
    }

    console.log(buildResponse);
});
```

### Default Options
The default options for `bundleCss` and all functions that accept an `options` object
are defined [here](#default-options).

### CSS Bundling Utilities
CSS bundling related utilities.

*Note - All callbacks return `err`, `[results]`.*

#### `concatMinifyCss(css, minify, callback)`
Concat and optionally minify CSS.

##### Arguments
1. `css` *(Array)*: Contains CSS definitions, `{ path: 'path/to/css/file.css', contents: 'css file contents' }`.
1. `minify` *(Boolean)*: Minify the CSS.
1. `callback` *(Function)*: Function to be executed once the CSS has been concatenated and optionally minified.

#### `readCssFiles(appPath, files, callback)`
Reads CSS files.

##### Arguments
1. `appPath` *(String)*: Path to the application directory.
1. `files` *(Array)*: File paths for CSS files to be read.
1. `callback` *(Function)*: Function to be executed once the CSS files have been read.

#### `resolveImgPaths(cssStr, cssFilePath)`
Resolves image URLs is CSS files to absolute paths for an application.

##### Arguments
1. `CssStr` *(String)*: CSS file contents.
1. `cssFilePath` *(Object)*: CSS file path relative to the application.

##### Returns
*(String)*: CSS file contents with modified image URLs.

#### `getCssFiles(appPath, filter, callback)`
Gets the CSS file paths for an application.

##### Arguments
1. `appPath` *(String)*: Path to the application directory.
1. `filter` *(Function)*: Filter files read from the application directory. See
   [`options.cssFilter`](#default-options) for an example.
1. `callback` *(Function)*: Function to be executed once the CSS files paths been read.