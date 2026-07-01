const path = require('path');

module.exports = function withDateTimePicker(config) {
  const pluginPath = require.resolve("@react-native-community/datetimepicker/app.plugin.js", {
    paths: [
      path.join(__dirname, ".."),
      path.join(__dirname, "..", "apps", "mobile")
    ]
  });

  const pluginModule = require(pluginPath);

  const plugin = pluginModule.default ?? pluginModule;
  return plugin(config);
};
