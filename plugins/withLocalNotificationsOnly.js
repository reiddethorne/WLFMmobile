const { withEntitlementsPlist } = require("expo/config-plugins");

// Register before expo-notifications so this entitlement mod runs after its mod.
// Local reminders do not require APNs,
// and its push entitlement prevents signing with a free Apple Personal Team.
module.exports = function withLocalNotificationsOnly(config) {
  return withEntitlementsPlist(config, (config) => {
    delete config.modResults["aps-environment"];
    return config;
  });
};
