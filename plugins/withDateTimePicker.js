const path = require('path');

module.exports = function withDateTimePicker(config) {
  const pluginModule = require(path.join(
    __dirname,
    '..',
    'apps',
    'mobile',
    'node_modules',
    '@react-native-community',
    'datetimepicker',
    'app.plugin.js'
  ));

  const plugin = pluginModule.default ?? pluginModule;
  return plugin(config);
};
