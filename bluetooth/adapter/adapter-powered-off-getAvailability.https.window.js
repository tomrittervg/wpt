// META: script=/resources/testharness.js
// META: script=/resources/testharnessreport.js
// META: script=/resources/testdriver.js
// META: script=/resources/testdriver-vendor.js
// META: script=/bluetooth/resources/bluetooth-helpers.js
'use strict';
const test_desc = 'getAvailability() should return true if the Bluetooth ' +
    'radio is powered off';

bluetooth_test(async () => {
  await navigator.bluetooth.test.simulateCentral(
      {leSupported: true, state: 'powered-off'});
  let availability = await navigator.bluetooth.getAvailability();
  assert_true(
      availability,
      'getAvailability() resolves promise with true when adapter is powered ' +
          'off');
}, test_desc);
