// META: script=/resources/testharness.js
// META: script=/resources/testharnessreport.js
// META: script=/resources/testdriver.js
// META: script=/resources/testdriver-vendor.js
// META: script=/bluetooth/resources/bluetooth-helpers.js
'use strict';
const test_desc = 'getAvailability() should return false when the Bluetooth ' +
    'radio does not support Bluetooth Low-Energy.';

bluetooth_test(async () => {
  await navigator.bluetooth.test.simulateCentral(
      {leSupported: false, state: 'powered-on'});
  let availability = await navigator.bluetooth.getAvailability();
  assert_false(
      availability,
      'getAvailability() resolves promise with false when adapter is powered ' +
          'on and it does not support Bluetooth Low-Energy.');
}, test_desc);
