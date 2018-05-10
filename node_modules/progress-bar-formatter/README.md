progress-bar-formatter
======================

#### Progress bar formatter ####

[![npm version][npm-version-image]][npm-url]
[![Travis][travis-image]][travis-url]
[![Coveralls][coveralls-image]][coveralls-url]

#### Example ####

```javascript
var ProgressBarFormatter = require('progress-bar-formatter');

var bar = new ProgressBarFormatter();
console.log (bar.format(0.4));
// ##########··············
```

<a name="formatter"></a>
__Formatter([options])__

Options:

- __complete__ - _String_  
  The character that shows completion progress. Default is `#`.
- __incomplete__ - _String_  
  The character that shows the remaining progress. Default is `·`.
- __length__ - _Number_  
  The length of the progress bar. Default is `24`.

<a name="formatter_format"></a>
__Formatter#format(progress) : String__

Formats the progress bar. `progress` is a number between 0 and 1.

[npm-version-image]: https://img.shields.io/npm/v/progress-bar-formatter.svg?style=flat
[npm-url]: https://npmjs.org/package/progress-bar-formatter
[travis-image]: https://img.shields.io/travis/gagle/node-progress-bar-formatter.svg?style=flat
[travis-url]: https://travis-ci.org/gagle/node-progress-bar-formatter
[coveralls-image]: https://img.shields.io/coveralls/gagle/node-progress-bar-formatter.svg?style=flat
[coveralls-url]: https://coveralls.io/r/gagle/node-progress-bar-formatter