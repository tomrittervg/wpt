'use strict';

function toMojoNDEFRecordType(type) {
  switch (type) {
  case 'text':
    return device.mojom.NDEFRecordType.TEXT;
  case 'url':
    return device.mojom.NDEFRecordType.URL;
  case 'json':
    return device.mojom.NDEFRecordType.JSON;
  case 'opaque':
    return device.mojom.NDEFRecordType.OPAQUE_RECORD;
  }

  return device.mojom.NDEFRecordType.EMPTY;
}

function toMojoNFCPushTarget(target) {
  switch (target) {
  case 'peer':
    return device.mojom.NFCPushTarget.PEER;
  case 'tag':
    return device.mojom.NFCPushTarget.TAG;
  }

  return device.mojom.NFCPushTarget.ANY;
}

function toMojoNDEFCompatibility(compatibility) {
  if (compatibility === 'nfc-forum')
    return device.mojom.NDEFCompatibility.NFC_FORUM;
  if (compatibility === 'vendor')
    return device.mojom.NDEFCompatibility.VENDOR;
  return device.mojom.NDEFCompatibility.ANY;
}

// Converts between NDEFMessageInit https://w3c.github.io/web-nfc/#dom-ndefmessage
// and mojom.NDEFMessage structure, so that watch function can be tested.
function toMojoNDEFMessage(message) {
  let ndefMessage = new device.mojom.NDEFMessage();
  ndefMessage.url = message.url;
  ndefMessage.data = [];
  for (let record of message.records) {
    ndefMessage.data.push(toMojoNDEFRecord(record));
  }
  return ndefMessage;
}

function toMojoNDEFRecord(record) {
  let nfcRecord = new device.mojom.NDEFRecord();
  nfcRecord.recordType = toMojoNDEFRecordType(record.recordType);
  nfcRecord.mediaType = record.mediaType;
  nfcRecord.data = toByteArray(record.data);
  return nfcRecord;
}

function toByteArray(data) {
  // Convert JS objects to byte array
  let byteArray = new Uint8Array(0);
  let tmpData = data;

  if (tmpData instanceof ArrayBuffer)
    byteArray = new Uint8Array(tmpData);
  else if (typeof tmpData === 'object' || typeof tmpData === 'number')
    tmpData = JSON.stringify(tmpData);

  if (typeof tmpData === 'string')
    byteArray = new TextEncoder('utf-8').encode(tmpData);

  return byteArray;
}

// Compares NDEFRecords that were provided / received by the mock service.
// TODO: Use different getters to get received record data,
// see spec changes at https://github.com/w3c/web-nfc/pull/243
function compareNDEFRecords(providedRecord, receivedRecord) {
  assert_equals(toMojoNDEFRecordType(providedRecord.recordType),
                receivedRecord.recordType);

  // Compare media types without charset.
  // Charset should be compared when watch method is implemented, in order
  // to check that written and read strings are equal.
  assert_equals(providedRecord.mediaType,
      receivedRecord.mediaType.substring(0, providedRecord.mediaType.length));

  assert_false(toMojoNDEFRecordType(providedRecord.recordType) ==
              device.mojom.NDEFRecordType.EMPTY);

  assert_array_equals(toByteArray(providedRecord.data),
                      new Uint8Array(receivedRecord.data));
}

// Compares NFCPushOptions structures that were provided to API and
// received by the mock mojo service.
function assertNFCPushOptionsEqual(provided, received) {
  if (provided.ignoreRead !== undefined)
    assert_equals(provided.ignoreRead, !!received.ignoreRead);
  else
    assert_equals(!!received.ignore_read, true);

  if (provided.timeout !== undefined)
    assert_equals(provided.timeout, received.timeout);
  else
    assert_equals(received.timeout, Infinity);

  if (provided.target !== undefined)
    assert_equals(toMojoNFCPushTarget(provided.target), received.target);
  else
    assert_equals(received.target, device.mojom.NFCPushTarget.ANY);

  if (provided.compatibility !== undefined)
    assert_equals(toMojoNDEFCompatibility(provided.compatibility),
        received.compatibility);
  else
    assert_equals(received.compatibility,
        device.mojom.NDEFCompatibility.NFC_FORUM);
}

// Compares NFCReaderOptions structures that were provided to API and
// received by the mock mojo service.
function assertNFCReaderOptionsEqual(provided, received) {
  if (provided.url !== undefined)
    assert_equals(provided.url, received.url);
  else
    assert_equals(received.url, '');

  if (provided.mediaType !== undefined)
    assert_equals(provided.mediaType, received.mediaType);
  else
    assert_equals(received.mediaType, '');

  if (provided.compatibility !== undefined)
    assert_equals(toMojoNDEFCompatibility(provided.compatibility),
        received.compatibility);
  else
    assert_equals(received.compatibility,
        device.mojom.NDEFCompatibility.NFC_FORUM);

  if (provided.recordType !== undefined) {
    assert_equals(!+received.record_filter, true);
    assert_equals(toMojoNDEFRecordType(provided.recordType),
        received.recordFilter.recordType);
  }
}

// Checks whether NFCReaderOptions are matched with given message
// and mock nfc's compatibility
function matchesWatchOptions(message, compatibility, options) {
  // Filter by NDEFCompatibility
  if (options.compatibility !== toMojoNDEFCompatibility("any")
          && options.compatibility !== compatibility) {
      return false;
  }

  // Filter by Web NFC id
  if (!matchesWebNfcId(message.url, options.url)) return false;

  // Matches any record / media type.
  if ((options.mediaType == null || options.mediaType === "")
          && options.recordFilter == null)
      return true;

  // Filter by mediaType and recordType
  for (let record of message.records) {
    let matchedMediaType = false, matchedRecordType = false;

    if (options.mediaType == null || options.mediaType === "") {
      // If media type for the options is empty, match all media types.
      matchedMediaType = true;
    } else {
      matchedMediaType = options.mediaType === record.mediaType;
    }

    if (options.recordFilter == null) {
      // If record type filter for the watch options is null,
      // match all record types.
      matchedRecordType = true;
    } else {
      matchedRecordType = options.recordFilter.recordType
          === toMojoNDEFRecordType(record.recordType);
    }

    if (matchedMediaType && matchedRecordType) return true;
  }

  return false;
}

// Web NFC id match algorithm.
// https://w3c.github.io/web-nfc/#url-pattern-match-algorithm
function matchesWebNfcId(id, pattern) {
  if (id != null && id !== "" && pattern != null && pattern !== "") {
    const id_url = new URL(id);
    const pattern_url = new URL(pattern);

    if (id_url.protocol !== pattern_url.protocol) return false;
    if (!id_url.host.endsWith("." + pattern_url.host)
        && id_url.host !== pattern_url.host)
      return false;
    if (pattern_url.pathname === "/*") return true;
    if (id_url.pathname.startsWith(pattern_url.pathname)) return true;

    return false;
  }

  return true;
}

function createNFCError(type) {
  return { error: type ?
      new device.mojom.NFCError({ errorType: type }) : null };
}

var WebNFCTest = (() => {
  class MockNFC {
    constructor() {
      this.bindingSet_ = new mojo.BindingSet(device.mojom.NFC);

      this.interceptor_ = new MojoInterfaceInterceptor(
          device.mojom.NFC.name);
      this.interceptor_.oninterfacerequest =
          e => this.bindingSet_.addBinding(this, e.handle);
      this.interceptor_.start();

      this.hw_status_ = NFCHWStatus.ENABLED;
      this.pushed_message_ = null;
      this.push_options_ = null;
      this.pending_promise_func_ = null;
      this.push_timeout_id_ = null;
      this.push_completed_ = true;
      this.client_ = null;
      this.watchers_ = [];
      this.reading_message_ = null;
      this.compatibility_ = toMojoNDEFCompatibility("nfc-forum");
    }

    // NFC delegate functions
    async push(message, options) {
      let error = this.isReady();
      if (error)
        return error;

      this.pushed_message_ = message;
      this.push_options_ = options;

      return new Promise(resolve => {
        this.pending_promise_func_ = resolve;
        if (options.timeout && options.timeout !== Infinity &&
            !this.push_completed_) {
          this.push_timeout_id_ =
              window.setTimeout(() => {
                  resolve(
                      createNFCError(device.mojom.NFCErrorType.TIMER_EXPIRED));
              }, options.timeout);
        } else {
          resolve(createNFCError(null));
        }
      });
    }

    async cancelPush(target) {
      if (this.push_options_ && ((target === device.mojom.NFCPushTarget.ANY) ||
          (this.push_options_.target === target))) {
        this.cancelPendingPushOperation();
      }

      return createNFCError(null);
    }

    setClient(client) {
      this.client_ = client;
    }

    async watch(options, id) {
      assert_true(id > 0);
      let error = this.isReady();
      if (error) {
        return error;
      }

      this.watchers_.push({id: id, options: options});
      if (this.reading_message_ && matchesWatchOptions(this.reading_message_,
          this.compatibility_, options)) {
        this.client_.onWatch([id], fake_tag_serial_number,
            toMojoNDEFMessage(this.reading_message_));
      }
      return createNFCError(null);
    }

    async cancelWatch(id) {
      let index = this.watchers_.findIndex(value => value.id === id);
      if (index === -1) {
        return createNFCError(device.mojom.NFCErrorType.NOT_FOUND);
      }

      this.watchers_.splice(index, 1);
      return createNFCError(null);
    }

    async cancelAllWatches() {
      if (this.watchers_.length === 0) {
        return createNFCError(device.mojom.NFCErrorType.NOT_FOUND);
      }

      this.watchers_.splice(0, this.watchers_.length);
      return createNFCError(null);
    }

    isReady() {
      if (this.hw_status_ === NFCHWStatus.DISABLED)
        return createNFCError(device.mojom.NFCErrorType.NOT_READABLE);
      if (this.hw_status_ === NFCHWStatus.NOT_SUPPORTED)
        return createNFCError(device.mojom.NFCErrorType.NOT_READABLE);
      return null;
    }

    setHWStatus(status) {
      this.hw_status_ = status;
    }

    pushedMessage() {
      return this.pushed_message_;
    }

    pushOptions() {
      return this.push_options_;
    }

    watchOptions() {
      assert_not_equals(this.watchers_.length, 0);
      return this.watchers_[this.watchers_.length - 1].options;
    }

    setPendingPushCompleted(result) {
      this.push_completed_ = result;
    }

    reset() {
      this.hw_status_ = NFCHWStatus.ENABLED;
      this.push_completed_ = true;
      this.watchers_ = [];
      this.cancelPendingPushOperation();
      this.bindingSet_.closeAllBindings();
      this.interceptor_.stop();
    }

    cancelPendingPushOperation() {
      if (this.push_timeout_id_) {
        window.clearTimeout(this.push_timeout_id_);
      }

      if (this.pending_promise_func_) {
        this.pending_promise_func_(
            createNFCError(device.mojom.NFCErrorType.OPERATION_CANCELLED));
      }

      this.pushed_message_ = null;
      this.push_options_ = null;
      this.pending_promise_func_ = null;
    }

    setCompatibility(compatibility) {
      this.compatibility_ = toMojoNDEFCompatibility(compatibility);
    }

    setReadingMessage(message) {
      this.reading_message_ = message;
    }
  }

  let testInternal = {
    initialized: false,
    mockNFC: null
  }

  class NFCTestChromium {
    constructor() {
      Object.freeze(this); // Make it immutable.
    }

    initialize() {
      if (testInternal.initialized)
        throw new Error('Call reset() before initialize().');

      testInternal.mockNFC = new MockNFC;
      testInternal.initialized = true;
    }
    // Resets state of nfc mocks between test runs.
    async reset() {
      if (!testInternal.initialized)
        throw new Error('Call initialize() before reset().');
      testInternal.mockNFC.reset();
      testInternal.mockNFC = null;
      testInternal.initialized = false;

      await new Promise(resolve => setTimeout(resolve, 0));
    }

    getMockNFC() {
      return testInternal.mockNFC;
    }
  }

  return NFCTestChromium;
})();
