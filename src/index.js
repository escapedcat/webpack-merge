const isArray = Array.isArray;
const isPlainObject = require('lodash.isplainobject');
const merge = require('lodash.merge');
const find = require('lodash.find');
const isEqual = require('lodash.isequal');

const loaderNameRe = /^([^\?]+)/ig;

function mergeLoaders(currentLoaders, newLoaders) {
  return newLoaders.reduce((mergedLoaders, loader) => {
    if (mergedLoaders.every(
      l => loader.match(loaderNameRe)[0] !== l.match(loaderNameRe)[0])
    ) {
      return mergedLoaders.concat([loader]);
    }

    // Replace query values with newer ones
    return mergedLoaders.map(l => {
      if (loader.match(loaderNameRe)[0] === l.match(loaderNameRe)[0]) {
        return loader;
      }

      return l;
    });
  }, currentLoaders);
}

/**
 * Check equality of two values using lodash's isEqual
 * Arrays need to be sorted for equality checking
 * but clone them first so as not to disrupt the sort order in tests
 */
function isSameValue(a, b) {
  const [propA, propB] = [a, b].map(function (value) {
    return isArray(value) ? value.slice().sort() : value;
  });

  return isEqual(propA, propB);
}

function reduceLoaders(mergedLoaderConfigs, loaderConfig) {
  const foundLoader = find(
    mergedLoaderConfigs,
    l => String(l.test) === String(loaderConfig.test)
  );

  if (foundLoader) {
    /**
     * When both loaders have different `include` or `exclude`
     * properties, concat them
     */
    if ((foundLoader.include && !isSameValue(foundLoader.include, loaderConfig.include)) ||
        (foundLoader.exclude && !isSameValue(foundLoader.exclude, loaderConfig.exclude))) {
      return [loaderConfig].concat(mergedLoaderConfigs);
    }

    // foundLoader.loader is intentionally ignored, because a string loader value should always override
    if (foundLoader.loaders) {
      const newLoaders = loaderConfig.loader ? [loaderConfig.loader] : loaderConfig.loaders || [];

      foundLoader.loaders = mergeLoaders(newLoaders, foundLoader.loaders);
    }

    if (loaderConfig.include) {
      foundLoader.include = loaderConfig.include;
    }

    if (loaderConfig.exclude) {
      foundLoader.exclude = loaderConfig.exclude;
    }

    return mergedLoaderConfigs;
  }

  return [loaderConfig].concat(mergedLoaderConfigs);
}

function joinArrays(customizer, a, b, key) {
  if (isArray(a) && isArray(b)) {
    const customResult = customizer(a, b, key);

    if (!b.length) {
      return [];
    }

    if (customResult) {
      return customResult;
    }

    return a.concat(b);
  }

  if (isPlainObject(a) && isPlainObject(b)) {
    if (!Object.keys(b).length) {
      return {};
    }

    return merge({}, a, b, joinArrays.bind(null, customizer));
  }

  return b;
}

module.exports = function () {
  const args = Array.prototype.slice.call(arguments);

  return merge.apply(null, [{}].concat(args).concat([
    joinArrays.bind(null, () => {})
  ]));
};

module.exports.smart = function webpackMerge() {
  const args = Array.prototype.slice.call(arguments);

  return merge.apply(null, [{}].concat(args).concat([
    joinArrays.bind(null, function (a, b, key) {
      if (isLoader(key)) {
        return a.reduce(reduceLoaders, b.slice());
      }
    })
  ]));
};

function isLoader(key) {
  return ['preLoaders', 'loaders', 'postLoaders'].indexOf(key) >= 0;
}
