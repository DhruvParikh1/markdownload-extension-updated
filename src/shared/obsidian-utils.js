(function(root) {
  const exportApi = root.markSnipExportUtils || (
    typeof require !== 'undefined' ? require('./export-utils') : null
  );

  function getObsidianTransportOptions(options = {}) {
    const nextOptions = {
      ...options,
      downloadImages: false
    };

    if (nextOptions.imageStyle !== 'noImage') {
      nextOptions.imageStyle = 'markdown';
    }

    return nextOptions;
  }

  function createObsidianSourceImageMap(imageList = {}) {
    return exportApi
      ? exportApi.createRemoteSourceImageMap(imageList)
      : {};
  }

  function prepareMarkdownForObsidian(markdown, sourceImageMap = {}) {
    return exportApi
      ? exportApi.prepareMarkdownForRemoteImages(markdown, sourceImageMap)
      : markdown;
  }

  const api = {
    createObsidianSourceImageMap,
    getObsidianTransportOptions,
    prepareMarkdownForObsidian
  };

  root.markSnipObsidian = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
