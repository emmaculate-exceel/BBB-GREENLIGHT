(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var DDPCommon = Package['ddp-common'].DDPCommon;
var ECMAScript = Package.ecmascript.ECMAScript;
var check = Package.check.check;
var Match = Package.check.Match;
var Tracker = Package.tracker.Tracker;
var Deps = Package.tracker.Deps;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var EV, fn, eventName, Streamer;

var require = meteorInstall({"node_modules":{"meteor":{"rocketchat:streamer":{"lib":{"ev.js":function module(){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                //
// packages/rocketchat_streamer/lib/ev.js                                                                         //
//                                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                  //
/* globals EV:true */
/* exported EV */

EV = class EV {
  constructor() {
    this.handlers = {};
  }
  emit(event) {
    for (var _len = arguments.length, args = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
      args[_key - 1] = arguments[_key];
    }
    return this.handlers[event] && this.handlers[event].forEach(handler => handler.apply(this, args));
  }
  emitWithScope(event, scope) {
    for (var _len2 = arguments.length, args = new Array(_len2 > 2 ? _len2 - 2 : 0), _key2 = 2; _key2 < _len2; _key2++) {
      args[_key2 - 2] = arguments[_key2];
    }
    return this.handlers[event] && this.handlers[event].forEach(handler => handler.apply(scope, args));
  }
  listenerCount(event) {
    return this.handlers[event] && this.handlers[event].length || 0;
  }
  on(event, callback) {
    if (!this.handlers[event]) {
      this.handlers[event] = [];
    }
    this.handlers[event].push(callback);
  }
  once(event, callback) {
    const self = this;
    this.on(event, function onetimeCallback() {
      self.removeListener(event, onetimeCallback);
      callback.apply(this, arguments);
    });
  }
  removeListener(event, callback) {
    if (!this.handlers[event]) {
      return;
    }
    const index = this.handlers[event].indexOf(callback);
    if (index > -1) {
      this.handlers[event].splice(index, 1);
    }
  }
  removeAllListeners(event) {
    this.handlers[event] = undefined;
  }
};
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"server":{"server.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                //
// packages/rocketchat_streamer/server/server.js                                                                  //
//                                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                  //
let DDPCommon;
module.link("meteor/ddp-common", {
  DDPCommon(v) {
    DDPCommon = v;
  }
}, 0);
class StreamerCentral extends EV {
  constructor() {
    super();
    this.instances = {};
  }
}
Meteor.StreamerCentral = new StreamerCentral();
const changedPayload = function (collection, id, fields) {
  if (_.isEmpty(fields)) {
    return;
  }
  return DDPCommon.stringifyDDP({
    msg: 'changed',
    collection,
    id,
    fields
  });
};
const send = function (self, msg) {
  if (!self.socket) {
    return;
  }
  self.socket.send(msg);
};
Meteor.Streamer = class Streamer extends EV {
  constructor(name) {
    let {
      retransmit = true,
      retransmitToSelf = false
    } = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    if (Meteor.StreamerCentral.instances[name]) {
      console.warn('Streamer instance already exists:', name);
      return Meteor.StreamerCentral.instances[name];
    }
    super();
    Meteor.StreamerCentral.instances[name] = this;
    this.name = name;
    this.retransmit = retransmit;
    this.retransmitToSelf = retransmitToSelf;
    this.subscriptions = [];
    this.subscriptionsByEventName = {};
    this.transformers = {};
    this.iniPublication();
    this.initMethod();
    this._allowRead = {};
    this._allowEmit = {};
    this._allowWrite = {};
    this.allowRead('none');
    this.allowEmit('all');
    this.allowWrite('none');
  }
  get name() {
    return this._name;
  }
  set name(name) {
    check(name, String);
    this._name = name;
  }
  get subscriptionName() {
    return "stream-".concat(this.name);
  }
  get retransmit() {
    return this._retransmit;
  }
  set retransmit(retransmit) {
    check(retransmit, Boolean);
    this._retransmit = retransmit;
  }
  get retransmitToSelf() {
    return this._retransmitToSelf;
  }
  set retransmitToSelf(retransmitToSelf) {
    check(retransmitToSelf, Boolean);
    this._retransmitToSelf = retransmitToSelf;
  }
  allowRead(eventName, fn) {
    if (fn === undefined) {
      fn = eventName;
      eventName = '__all__';
    }
    if (typeof fn === 'function') {
      return this._allowRead[eventName] = fn;
    }
    if (typeof fn === 'string' && ['all', 'none', 'logged'].indexOf(fn) === -1) {
      console.error("allowRead shortcut '".concat(fn, "' is invalid"));
    }
    if (fn === 'all' || fn === true) {
      return this._allowRead[eventName] = function () {
        return true;
      };
    }
    if (fn === 'none' || fn === false) {
      return this._allowRead[eventName] = function () {
        return false;
      };
    }
    if (fn === 'logged') {
      return this._allowRead[eventName] = function () {
        return Boolean(this.userId);
      };
    }
  }
  allowEmit(eventName, fn) {
    if (fn === undefined) {
      fn = eventName;
      eventName = '__all__';
    }
    if (typeof fn === 'function') {
      return this._allowEmit[eventName] = fn;
    }
    if (typeof fn === 'string' && ['all', 'none', 'logged'].indexOf(fn) === -1) {
      console.error("allowRead shortcut '".concat(fn, "' is invalid"));
    }
    if (fn === 'all' || fn === true) {
      return this._allowEmit[eventName] = function () {
        return true;
      };
    }
    if (fn === 'none' || fn === false) {
      return this._allowEmit[eventName] = function () {
        return false;
      };
    }
    if (fn === 'logged') {
      return this._allowEmit[eventName] = function () {
        return Boolean(this.userId);
      };
    }
  }
  allowWrite(eventName, fn) {
    if (fn === undefined) {
      fn = eventName;
      eventName = '__all__';
    }
    if (typeof fn === 'function') {
      return this._allowWrite[eventName] = fn;
    }
    if (typeof fn === 'string' && ['all', 'none', 'logged'].indexOf(fn) === -1) {
      console.error("allowWrite shortcut '".concat(fn, "' is invalid"));
    }
    if (fn === 'all' || fn === true) {
      return this._allowWrite[eventName] = function () {
        return true;
      };
    }
    if (fn === 'none' || fn === false) {
      return this._allowWrite[eventName] = function () {
        return false;
      };
    }
    if (fn === 'logged') {
      return this._allowWrite[eventName] = function () {
        return Boolean(this.userId);
      };
    }
  }
  isReadAllowed(scope, eventName, args) {
    if (this._allowRead[eventName]) {
      return this._allowRead[eventName].call(scope, eventName, ...args);
    }
    return this._allowRead['__all__'].call(scope, eventName, ...args);
  }
  isEmitAllowed(scope, eventName) {
    for (var _len = arguments.length, args = new Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) {
      args[_key - 2] = arguments[_key];
    }
    if (this._allowEmit[eventName]) {
      return this._allowEmit[eventName].call(scope, eventName, ...args);
    }
    return this._allowEmit['__all__'].call(scope, eventName, ...args);
  }
  isWriteAllowed(scope, eventName, args) {
    if (this._allowWrite[eventName]) {
      return this._allowWrite[eventName].call(scope, eventName, ...args);
    }
    return this._allowWrite['__all__'].call(scope, eventName, ...args);
  }
  addSubscription(subscription, eventName) {
    this.subscriptions.push(subscription);
    if (!this.subscriptionsByEventName[eventName]) {
      this.subscriptionsByEventName[eventName] = [];
    }
    this.subscriptionsByEventName[eventName].push(subscription);
  }
  removeSubscription(subscription, eventName) {
    const index = this.subscriptions.indexOf(subscription);
    if (index > -1) {
      this.subscriptions.splice(index, 1);
    }
    if (this.subscriptionsByEventName[eventName]) {
      const index = this.subscriptionsByEventName[eventName].indexOf(subscription);
      if (index > -1) {
        this.subscriptionsByEventName[eventName].splice(index, 1);
      }
    }
  }
  transform(eventName, fn) {
    if (typeof eventName === 'function') {
      fn = eventName;
      eventName = '__all__';
    }
    if (!this.transformers[eventName]) {
      this.transformers[eventName] = [];
    }
    this.transformers[eventName].push(fn);
  }
  applyTransformers(methodScope, eventName, args) {
    if (this.transformers['__all__']) {
      this.transformers['__all__'].forEach(transform => {
        args = transform.call(methodScope, eventName, args);
        methodScope.tranformed = true;
        if (!Array.isArray(args)) {
          args = [args];
        }
      });
    }
    if (this.transformers[eventName]) {
      this.transformers[eventName].forEach(transform => {
        args = transform.call(methodScope, ...args);
        methodScope.tranformed = true;
        if (!Array.isArray(args)) {
          args = [args];
        }
      });
    }
    return args;
  }
  _publish(publication, eventName, options) {
    check(eventName, String);
    check(options, Match.OneOf(Boolean, {
      useCollection: Boolean,
      args: Array
    }));
    let useCollection,
      args = [];
    if (typeof options === 'boolean') {
      useCollection = options;
    } else {
      if (options.useCollection) {
        useCollection = options.useCollection;
      }
      if (options.args) {
        args = options.args;
      }
    }
    if (eventName.length === 0) {
      publication.stop();
      throw new Meteor.Error('invalid-event-name');
    }
    if (this.isReadAllowed(publication, eventName, args) !== true) {
      publication.stop();
      throw new Meteor.Error('not-allowed');
    }
    const subscription = {
      subscription: publication,
      eventName: eventName
    };
    this.addSubscription(subscription, eventName);
    publication.onStop(() => {
      this.removeSubscription(subscription, eventName);
    });
    if (useCollection === true) {
      // Collection compatibility
      publication._session.sendAdded(this.subscriptionName, 'id', {
        eventName: eventName
      });
    }
    publication.ready();
  }
  iniPublication() {
    const stream = this;
    Meteor.publish(this.subscriptionName, function () {
      for (var _len2 = arguments.length, args = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
        args[_key2] = arguments[_key2];
      }
      return stream._publish.apply(stream, [this, ...args]);
    });
  }
  initMethod() {
    const stream = this;
    const method = {};
    method[this.subscriptionName] = function (eventName) {
      for (var _len3 = arguments.length, args = new Array(_len3 > 1 ? _len3 - 1 : 0), _key3 = 1; _key3 < _len3; _key3++) {
        args[_key3 - 1] = arguments[_key3];
      }
      check(eventName, String);
      check(args, Array);
      this.unblock();
      if (stream.isWriteAllowed(this, eventName, args) !== true) {
        return;
      }
      const methodScope = {
        userId: this.userId,
        connection: this.connection,
        originalParams: args,
        tranformed: false
      };
      args = stream.applyTransformers(methodScope, eventName, args);
      stream.emitWithScope(eventName, methodScope, ...args);
      if (stream.retransmit === true) {
        stream._emit(eventName, args, this.connection, true);
      }
    };
    try {
      Meteor.methods(method);
    } catch (e) {
      console.error(e);
    }
  }
  _emit(eventName, args, origin, broadcast) {
    if (broadcast === true) {
      Meteor.StreamerCentral.emit('broadcast', this.name, eventName, args);
    }
    const subscriptions = this.subscriptionsByEventName[eventName];
    if (!Array.isArray(subscriptions)) {
      return;
    }
    const msg = changedPayload(this.subscriptionName, 'id', {
      eventName,
      args
    });
    if (!msg) {
      return;
    }
    subscriptions.forEach(subscription => {
      if (this.retransmitToSelf === false && origin && origin === subscription.subscription.connection) {
        return;
      }
      if (this.isEmitAllowed(subscription.subscription, eventName, ...args)) {
        send(subscription.subscription._session, msg);
      }
    });
  }
  emit(eventName) {
    for (var _len4 = arguments.length, args = new Array(_len4 > 1 ? _len4 - 1 : 0), _key4 = 1; _key4 < _len4; _key4++) {
      args[_key4 - 1] = arguments[_key4];
    }
    this._emit(eventName, args, undefined, true);
  }
  __emit() {
    return super.emit(...arguments);
  }
  emitWithoutBroadcast(eventName) {
    for (var _len5 = arguments.length, args = new Array(_len5 > 1 ? _len5 - 1 : 0), _key5 = 1; _key5 < _len5; _key5++) {
      args[_key5 - 1] = arguments[_key5];
    }
    this._emit(eventName, args, undefined, false);
  }
};
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});

require("/node_modules/meteor/rocketchat:streamer/lib/ev.js");
require("/node_modules/meteor/rocketchat:streamer/server/server.js");

/* Exports */
Package._define("rocketchat:streamer", {
  Streamer: Streamer
});

})();

//# sourceURL=meteor://💻app/packages/rocketchat_streamer.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcm9ja2V0Y2hhdDpzdHJlYW1lci9saWIvZXYuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JvY2tldGNoYXQ6c3RyZWFtZXIvc2VydmVyL3NlcnZlci5qcyJdLCJuYW1lcyI6WyJFViIsImNvbnN0cnVjdG9yIiwiaGFuZGxlcnMiLCJlbWl0IiwiZXZlbnQiLCJhcmdzIiwiZm9yRWFjaCIsImhhbmRsZXIiLCJhcHBseSIsImVtaXRXaXRoU2NvcGUiLCJzY29wZSIsImxpc3RlbmVyQ291bnQiLCJsZW5ndGgiLCJvbiIsImNhbGxiYWNrIiwicHVzaCIsIm9uY2UiLCJzZWxmIiwib25ldGltZUNhbGxiYWNrIiwicmVtb3ZlTGlzdGVuZXIiLCJhcmd1bWVudHMiLCJpbmRleCIsImluZGV4T2YiLCJzcGxpY2UiLCJyZW1vdmVBbGxMaXN0ZW5lcnMiLCJ1bmRlZmluZWQiLCJERFBDb21tb24iLCJtb2R1bGUiLCJsaW5rIiwidiIsIlN0cmVhbWVyQ2VudHJhbCIsImluc3RhbmNlcyIsIk1ldGVvciIsImNoYW5nZWRQYXlsb2FkIiwiY29sbGVjdGlvbiIsImlkIiwiZmllbGRzIiwiXyIsImlzRW1wdHkiLCJzdHJpbmdpZnlERFAiLCJtc2ciLCJzZW5kIiwic29ja2V0IiwiU3RyZWFtZXIiLCJuYW1lIiwicmV0cmFuc21pdCIsInJldHJhbnNtaXRUb1NlbGYiLCJjb25zb2xlIiwid2FybiIsInN1YnNjcmlwdGlvbnMiLCJzdWJzY3JpcHRpb25zQnlFdmVudE5hbWUiLCJ0cmFuc2Zvcm1lcnMiLCJpbmlQdWJsaWNhdGlvbiIsImluaXRNZXRob2QiLCJfYWxsb3dSZWFkIiwiX2FsbG93RW1pdCIsIl9hbGxvd1dyaXRlIiwiYWxsb3dSZWFkIiwiYWxsb3dFbWl0IiwiYWxsb3dXcml0ZSIsIl9uYW1lIiwiY2hlY2siLCJTdHJpbmciLCJzdWJzY3JpcHRpb25OYW1lIiwiX3JldHJhbnNtaXQiLCJCb29sZWFuIiwiX3JldHJhbnNtaXRUb1NlbGYiLCJldmVudE5hbWUiLCJmbiIsImVycm9yIiwidXNlcklkIiwiaXNSZWFkQWxsb3dlZCIsImNhbGwiLCJpc0VtaXRBbGxvd2VkIiwiaXNXcml0ZUFsbG93ZWQiLCJhZGRTdWJzY3JpcHRpb24iLCJzdWJzY3JpcHRpb24iLCJyZW1vdmVTdWJzY3JpcHRpb24iLCJ0cmFuc2Zvcm0iLCJhcHBseVRyYW5zZm9ybWVycyIsIm1ldGhvZFNjb3BlIiwidHJhbmZvcm1lZCIsIkFycmF5IiwiaXNBcnJheSIsIl9wdWJsaXNoIiwicHVibGljYXRpb24iLCJvcHRpb25zIiwiTWF0Y2giLCJPbmVPZiIsInVzZUNvbGxlY3Rpb24iLCJzdG9wIiwiRXJyb3IiLCJvblN0b3AiLCJfc2Vzc2lvbiIsInNlbmRBZGRlZCIsInJlYWR5Iiwic3RyZWFtIiwicHVibGlzaCIsIm1ldGhvZCIsInVuYmxvY2siLCJjb25uZWN0aW9uIiwib3JpZ2luYWxQYXJhbXMiLCJfZW1pdCIsIm1ldGhvZHMiLCJlIiwib3JpZ2luIiwiYnJvYWRjYXN0IiwiX19lbWl0IiwiZW1pdFdpdGhvdXRCcm9hZGNhc3QiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUE7QUFDQTs7QUFFQUEsRUFBRSxHQUFHLE1BQU1BLEVBQUUsQ0FBQztFQUNiQyxXQUFXLEdBQUc7SUFDYixJQUFJLENBQUNDLFFBQVEsR0FBRyxDQUFDLENBQUM7RUFDbkI7RUFFQUMsSUFBSSxDQUFDQyxLQUFLLEVBQVc7SUFBQSxrQ0FBTkMsSUFBSTtNQUFKQSxJQUFJO0lBQUE7SUFDbEIsT0FBTyxJQUFJLENBQUNILFFBQVEsQ0FBQ0UsS0FBSyxDQUFDLElBQUksSUFBSSxDQUFDRixRQUFRLENBQUNFLEtBQUssQ0FBQyxDQUFDRSxPQUFPLENBQUNDLE9BQU8sSUFBSUEsT0FBTyxDQUFDQyxLQUFLLENBQUMsSUFBSSxFQUFFSCxJQUFJLENBQUMsQ0FBQztFQUNsRztFQUVBSSxhQUFhLENBQUNMLEtBQUssRUFBRU0sS0FBSyxFQUFX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QUFFckQsR0FBRyxDQUFDO01BQzlDO0lBQ0QsQ0FBQyxDQUFDO0VBQ0g7RUFFQXJDLElBQUksQ0FBQ2dFLFNBQVMsRUFBVztJQUFBLG1DQUFOOUQsSUFBSTtNQUFKQSxJQUFJO0lBQUE7SUFDdEIsSUFBSSxDQUFDaUcsS0FBSyxDQUFDbkMsU0FBUyxFQUFFOUQsSUFBSSxFQUFFb0IsU0FBUyxFQUFFLElBQUksQ0FBQztFQUM3QztFQUVBa0YsTUFBTSxHQUFVO0lBQ2YsT0FBTyxLQUFLLENBQUN4RyxJQUFJLENBQUMsWUFBTyxDQUFDO0VBQzNCO0VBRUF5RyxvQkFBb0IsQ0FBQ3pDLFNBQVMsRUFBVztJQUFBLG1DQUFOOUQsSUFBSTtNQUFKQSxJQUFJO0lBQUE7SUFDdEMsSUFBSSxDQUFDaUcsS0FBSyxDQUFDbkMsU0FBUyxFQUFFOUQsSUFBSSxFQUFFb0IsU0FBUyxFQUFFLEtBQUssQ0FBQztFQUM5QztBQUNELENBQUMsQyIsImZpbGUiOiIvcGFja2FnZXMvcm9ja2V0Y2hhdF9zdHJlYW1lci5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qIGdsb2JhbHMgRVY6dHJ1ZSAqL1xuLyogZXhwb3J0ZWQgRVYgKi9cblxuRVYgPSBjbGFzcyBFViB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHRoaXMuaGFuZGxlcnMgPSB7fTtcblx0fVxuXG5cdGVtaXQoZXZlbnQsIC4uLmFyZ3MpIHtcblx0XHRyZXR1cm4gdGhpcy5oYW5kbGVyc1tldmVudF0gJiYgdGhpcy5oYW5kbGVyc1tldmVudF0uZm9yRWFjaChoYW5kbGVyID0+IGhhbmRsZXIuYXBwbHkodGhpcywgYXJncykpO1xuXHR9XG5cblx0ZW1pdFdpdGhTY29wZShldmVudCwgc2NvcGUsIC4uLmFyZ3MpIHtcblx0XHRyZXR1cm4gdGhpcy5oYW5kbGVyc1tldmVudF0gJiYgdGhpcy5oYW5kbGVyc1tldmVudF0uZm9yRWFjaChoYW5kbGVyID0+IGhhbmRsZXIuYXBwbHkoc2NvcGUsIGFyZ3MpKTtcblx0fVxuXG5cdGxpc3RlbmVyQ291bnQoZXZlbnQpIHtcblx0XHRyZXR1cm4gKHRoaXMuaGFuZGxlcnNbZXZlbnRdICYmIHRoaXMuaGFuZGxlcnNbZXZlbnRdLmxlbmd0aCkgfHwgMDtcblx0fVxuXG5cdG9uKGV2ZW50LCBjYWxsYmFjaykge1xuXHRcdGlmICghdGhpcy5oYW5kbGVyc1tldmVudF0pIHtcblx0XHRcdHRoaXMuaGFuZGxlcnNbZXZlbnRdID0gW107XG5cdFx0fVxuXHRcdHRoaXMuaGFuZGxlcnNbZXZlbnRdLnB1c2goY2FsbGJhY2spO1xuXHR9XG5cblx0b25jZShldmVudCwgY2FsbGJhY2spIHtcblx0XHRjb25zdCBzZWxmID0gdGhpcztcblx0XHR0aGlzLm9uKGV2ZW50LCBmdW5jdGlvbiBvbmV0aW1lQ2FsbGJhY2soKSB7XG5cdFx0XHRzZWxmLnJlbW92ZUxpc3RlbmVyKGV2ZW50LCBvbmV0aW1lQ2FsbGJhY2spO1xuXHRcdFx0Y2FsbGJhY2suYXBwbHkodGhpcywgYXJndW1lbnRzKTtcblx0XHR9KTtcblx0fVxuXG5cdHJlbW92ZUxpc3RlbmVyKGV2ZW50LCBjYWxsYmFjaykge1xuXHRcdGlmICghdGhpcy5oYW5kbGVyc1tldmVudF0pIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3QgaW5kZXggPSB0aGlzLmhhbmRsZXJzW2V2ZW50XS5pbmRleE9mKGNhbGxiYWNrKTtcblx0XHRpZiAoaW5kZXggPiAtMSkge1xuXHRcdFx0dGhpcy5oYW5kbGVyc1tldmVudF0uc3BsaWNlKGluZGV4LCAxKTtcblx0XHR9XG5cdH1cblxuXHRyZW1vdmVBbGxMaXN0ZW5lcnMoZXZlbnQpIHtcblx0XHR0aGlzLmhhbmRsZXJzW2V2ZW50XSA9IHVuZGVmaW5lZDtcblx0fVxufTtcbiIsIi8qIGdsb2JhbHMgRVYgKi9cbi8qIGVzbGludCBuZXctY2FwOiBmYWxzZSAqL1xuaW1wb3J0IHsgRERQQ29tbW9uIH0gZnJvbSAnbWV0ZW9yL2RkcC1jb21tb24nO1xuXG5jbGFzcyBTdHJlYW1lckNlbnRyYWwgZXh0ZW5kcyBFViB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLmluc3RhbmNlcyA9IHt9O1xuXHR9XG59XG5cbk1ldGVvci5TdHJlYW1lckNlbnRyYWwgPSBuZXcgU3RyZWFtZXJDZW50cmFsO1xuXG5jb25zdCBjaGFuZ2VkUGF5bG9hZCA9IGZ1bmN0aW9uIChjb2xsZWN0aW9uLCBpZCwgZmllbGRzKSB7XG5cdGlmIChfLmlzRW1wdHkoZmllbGRzKSkge1xuXHRcdHJldHVybjtcblx0fVxuXHRyZXR1cm4gRERQQ29tbW9uLnN0cmluZ2lmeUREUCh7XG5cdFx0bXNnOiAnY2hhbmdlZCcsXG5cdFx0Y29sbGVjdGlvbixcblx0XHRpZCxcblx0XHRmaWVsZHNcblx0fSk7XG59O1xuXG5jb25zdCBzZW5kID0gZnVuY3Rpb24gKHNlbGYsIG1zZykge1xuXHRpZiAoIXNlbGYuc29ja2V0KSB7XG5cdFx0cmV0dXJuO1xuXHR9XG5cdHNlbGYuc29ja2V0LnNlbmQobXNnKTtcbn07XG5cblxuTWV0ZW9yLlN0cmVhbWVyID0gY2xhc3MgU3RyZWFtZXIgZXh0ZW5kcyBFViB7XG5cdGNvbnN0cnVjdG9yKG5hbWUsIHtyZXRyYW5zbWl0ID0gdHJ1ZSwgcmV0cmFuc21pdFRvU2VsZiA9IGZhbHNlfSA9IHt9KSB7XG5cdFx0aWYgKE1ldGVvci5TdHJlYW1lckNlbnRyYWwuaW5zdGFuY2VzW25hbWVdKSB7XG5cdFx0XHRjb25zb2xlLndhcm4oJ1N0cmVhbWVyIGluc3RhbmNlIGFscmVhZHkgZXhpc3RzOicsIG5hbWUpO1xuXHRcdFx0cmV0dXJuIE1ldGVvci5TdHJlYW1lckNlbnRyYWwuaW5zdGFuY2VzW25hbWVdO1xuXHRcdH1cblxuXHRcdHN1cGVyKCk7XG5cblx0XHRNZXRlb3IuU3RyZWFtZXJDZW50cmFsLmluc3RhbmNlc1tuYW1lXSA9IHRoaXM7XG5cblx0XHR0aGlzLm5hbWUgPSBuYW1lO1xuXHRcdHRoaXMucmV0cmFuc21pdCA9IHJldHJhbnNtaXQ7XG5cdFx0dGhpcy5yZXRyYW5zbWl0VG9TZWxmID0gcmV0cmFuc21pdFRvU2VsZjtcblxuXHRcdHRoaXMuc3Vic2NyaXB0aW9ucyA9IFtdO1xuXHRcdHRoaXMuc3Vic2NyaXB0aW9uc0J5RXZlbnROYW1lID0ge307XG5cdFx0dGhpcy50cmFuc2Zvcm1lcnMgPSB7fTtcblxuXHRcdHRoaXMuaW5pUHVibGljYXRpb24oKTtcblx0XHR0aGlzLmluaXRNZXRob2QoKTtcblxuXHRcdHRoaXMuX2FsbG93UmVhZCA9IHt9O1xuXHRcdHRoaXMuX2FsbG93RW1pdCA9IHt9O1xuXHRcdHRoaXMuX2FsbG93V3JpdGUgPSB7fTtcblxuXHRcdHRoaXMuYWxsb3dSZWFkKCdub25lJyk7XG5cdFx0dGhpcy5hbGxvd0VtaXQoJ2FsbCcpO1xuXHRcdHRoaXMuYWxsb3dXcml0ZSgnbm9uZScpO1xuXHR9XG5cblx0Z2V0IG5hbWUoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX25hbWU7XG5cdH1cblxuXHRzZXQgbmFtZShuYW1lKSB7XG5cdFx0Y2hlY2sobmFtZSwgU3RyaW5nKTtcblx0XHR0aGlzLl9uYW1lID0gbmFtZTtcblx0fVxuXG5cdGdldCBzdWJzY3JpcHRpb25OYW1lKCkge1xuXHRcdHJldHVybiBgc3RyZWFtLSR7dGhpcy5uYW1lfWA7XG5cdH1cblxuXHRnZXQgcmV0cmFuc21pdCgpIHtcblx0XHRyZXR1cm4gdGhpcy5fcmV0cmFuc21pdDtcblx0fVxuXG5cdHNldCByZXRyYW5zbWl0KHJldHJhbnNtaXQpIHtcblx0XHRjaGVjayhyZXRyYW5zbWl0LCBCb29sZWFuKTtcblx0XHR0aGlzLl9yZXRyYW5zbWl0ID0gcmV0cmFuc21pdDtcblx0fVxuXG5cdGdldCByZXRyYW5zbWl0VG9TZWxmKCkge1xuXHRcdHJldHVybiB0aGlzLl9yZXRyYW5zbWl0VG9TZWxmO1xuXHR9XG5cblx0c2V0IHJldHJhbnNtaXRUb1NlbGYocmV0cmFuc21pdFRvU2VsZikge1xuXHRcdGNoZWNrKHJldHJhbnNtaXRUb1NlbGYsIEJvb2xlYW4pO1xuXHRcdHRoaXMuX3JldHJhbnNtaXRUb1NlbGYgPSByZXRyYW5zbWl0VG9TZWxmO1xuXHR9XG5cblx0YWxsb3dSZWFkKGV2ZW50TmFtZSwgZm4pIHtcblx0XHRpZiAoZm4gPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0Zm4gPSBldmVudE5hbWU7XG5cdFx0XHRldmVudE5hbWUgPSAnX19hbGxfXyc7XG5cdFx0fVxuXG5cdFx0aWYgKHR5cGVvZiBmbiA9PT0gJ2Z1bmN0aW9uJykge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2FsbG93UmVhZFtldmVudE5hbWVdID0gZm47XG5cdFx0fVxuXG5cdFx0aWYgKHR5cGVvZiBmbiA9PT0gJ3N0cmluZycgJiYgWydhbGwnLCAnbm9uZScsICdsb2dnZWQnXS5pbmRleE9mKGZuKSA9PT0gLTEpIHtcblx0XHRcdGNvbnNvbGUuZXJyb3IoYGFsbG93UmVhZCBzaG9ydGN1dCAnJHtmbn0nIGlzIGludmFsaWRgKTtcblx0XHR9XG5cblx0XHRpZiAoZm4gPT09ICdhbGwnIHx8IGZuID09PSB0cnVlKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fYWxsb3dSZWFkW2V2ZW50TmFtZV0gPSBmdW5jdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmIChmbiA9PT0gJ25vbmUnIHx8IGZuID09PSBmYWxzZSkge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2FsbG93UmVhZFtldmVudE5hbWVdID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKGZuID09PSAnbG9nZ2VkJykge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2FsbG93UmVhZFtldmVudE5hbWVdID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHJldHVybiBCb29sZWFuKHRoaXMudXNlcklkKTtcblx0XHRcdH07XG5cdFx0fVxuXHR9XG5cblx0YWxsb3dFbWl0KGV2ZW50TmFtZSwgZm4pIHtcblx0XHRpZiAoZm4gPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0Zm4gPSBldmVudE5hbWU7XG5cdFx0XHRldmVudE5hbWUgPSAnX19hbGxfXyc7XG5cdFx0fVxuXG5cdFx0aWYgKHR5cGVvZiBmbiA9PT0gJ2Z1bmN0aW9uJykge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2FsbG93RW1pdFtldmVudE5hbWVdID0gZm47XG5cdFx0fVxuXG5cdFx0aWYgKHR5cGVvZiBmbiA9PT0gJ3N0cmluZycgJiYgWydhbGwnLCAnbm9uZScsICdsb2dnZWQnXS5pbmRleE9mKGZuKSA9PT0gLTEpIHtcblx0XHRcdGNvbnNvbGUuZXJyb3IoYGFsbG93UmVhZCBzaG9ydGN1dCAnJHtmbn0nIGlzIGludmFsaWRgKTtcblx0XHR9XG5cblx0XHRpZiAoZm4gPT09ICdhbGwnIHx8IGZuID09PSB0cnVlKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fYWxsb3dFbWl0W2V2ZW50TmFtZV0gPSBmdW5jdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmIChmbiA9PT0gJ25vbmUnIHx8IGZuID09PSBmYWxzZSkge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2FsbG93RW1pdFtldmVudE5hbWVdID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKGZuID09PSAnbG9nZ2VkJykge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2FsbG93RW1pdFtldmVudE5hbWVdID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHJldHVybiBCb29sZWFuKHRoaXMudXNlcklkKTtcblx0XHRcdH07XG5cdFx0fVxuXHR9XG5cblx0YWxsb3dXcml0ZShldmVudE5hbWUsIGZuKSB7XG5cdFx0aWYgKGZuID09PSB1bmRlZmluZWQpIHtcblx0XHRcdGZuID0gZXZlbnROYW1lO1xuXHRcdFx0ZXZlbnROYW1lID0gJ19fYWxsX18nO1xuXHRcdH1cblxuXHRcdGlmICh0eXBlb2YgZm4gPT09ICdmdW5jdGlvbicpIHtcblx0XHRcdHJldHVybiB0aGlzLl9hbGxvd1dyaXRlW2V2ZW50TmFtZV0gPSBmbjtcblx0XHR9XG5cblx0XHRpZiAodHlwZW9mIGZuID09PSAnc3RyaW5nJyAmJiBbJ2FsbCcsICdub25lJywgJ2xvZ2dlZCddLmluZGV4T2YoZm4pID09PSAtMSkge1xuXHRcdFx0Y29uc29sZS5lcnJvcihgYWxsb3dXcml0ZSBzaG9ydGN1dCAnJHtmbn0nIGlzIGludmFsaWRgKTtcblx0XHR9XG5cblx0XHRpZiAoZm4gPT09ICdhbGwnIHx8IGZuID09PSB0cnVlKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fYWxsb3dXcml0ZVtldmVudE5hbWVdID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAoZm4gPT09ICdub25lJyB8fCBmbiA9PT0gZmFsc2UpIHtcblx0XHRcdHJldHVybiB0aGlzLl9hbGxvd1dyaXRlW2V2ZW50TmFtZV0gPSBmdW5jdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAoZm4gPT09ICdsb2dnZWQnKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fYWxsb3dXcml0ZVtldmVudE5hbWVdID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHJldHVybiBCb29sZWFuKHRoaXMudXNlcklkKTtcblx0XHRcdH07XG5cdFx0fVxuXHR9XG5cblx0aXNSZWFkQWxsb3dlZChzY29wZSwgZXZlbnROYW1lLCBhcmdzKSB7XG5cdFx0aWYgKHRoaXMuX2FsbG93UmVhZFtldmVudE5hbWVdKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fYWxsb3dSZWFkW2V2ZW50TmFtZV0uY2FsbChzY29wZSwgZXZlbnROYW1lLCAuLi5hcmdzKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5fYWxsb3dSZWFkWydfX2FsbF9fJ10uY2FsbChzY29wZSwgZXZlbnROYW1lLCAuLi5hcmdzKTtcblx0fVxuXG5cdGlzRW1pdEFsbG93ZWQoc2NvcGUsIGV2ZW50TmFtZSwgLi4uYXJncykge1xuXHRcdGlmICh0aGlzLl9hbGxvd0VtaXRbZXZlbnROYW1lXSkge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2FsbG93RW1pdFtldmVudE5hbWVdLmNhbGwoc2NvcGUsIGV2ZW50TmFtZSwgLi4uYXJncyk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMuX2FsbG93RW1pdFsnX19hbGxfXyddLmNhbGwoc2NvcGUsIGV2ZW50TmFtZSwgLi4uYXJncyk7XG5cdH1cblxuXHRpc1dyaXRlQWxsb3dlZChzY29wZSwgZXZlbnROYW1lLCBhcmdzKSB7XG5cdFx0aWYgKHRoaXMuX2FsbG93V3JpdGVbZXZlbnROYW1lXSkge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2FsbG93V3JpdGVbZXZlbnROYW1lXS5jYWxsKHNjb3BlLCBldmVudE5hbWUsIC4uLmFyZ3MpO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLl9hbGxvd1dyaXRlWydfX2FsbF9fJ10uY2FsbChzY29wZSwgZXZlbnROYW1lLCAuLi5hcmdzKTtcblx0fVxuXG5cdGFkZFN1YnNjcmlwdGlvbihzdWJzY3JpcHRpb24sIGV2ZW50TmFtZSkge1xuXHRcdHRoaXMuc3Vic2NyaXB0aW9ucy5wdXNoKHN1YnNjcmlwdGlvbik7XG5cblx0XHRpZiAoIXRoaXMuc3Vic2NyaXB0aW9uc0J5RXZlbnROYW1lW2V2ZW50TmFtZV0pIHtcblx0XHRcdHRoaXMuc3Vic2NyaXB0aW9uc0J5RXZlbnROYW1lW2V2ZW50TmFtZV0gPSBbXTtcblx0XHR9XG5cblx0XHR0aGlzLnN1YnNjcmlwdGlvbnNCeUV2ZW50TmFtZVtldmVudE5hbWVdLnB1c2goc3Vic2NyaXB0aW9uKTtcblx0fVxuXG5cdHJlbW92ZVN1YnNjcmlwdGlvbihzdWJzY3JpcHRpb24sIGV2ZW50TmFtZSkge1xuXHRcdGNvbnN0IGluZGV4ID0gdGhpcy5zdWJzY3JpcHRpb25zLmluZGV4T2Yoc3Vic2NyaXB0aW9uKTtcblx0XHRpZiAoaW5kZXggPiAtMSkge1xuXHRcdFx0dGhpcy5zdWJzY3JpcHRpb25zLnNwbGljZShpbmRleCwgMSk7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuc3Vic2NyaXB0aW9uc0J5RXZlbnROYW1lW2V2ZW50TmFtZV0pIHtcblx0XHRcdGNvbnN0IGluZGV4ID0gdGhpcy5zdWJzY3JpcHRpb25zQnlFdmVudE5hbWVbZXZlbnROYW1lXS5pbmRleE9mKHN1YnNjcmlwdGlvbik7XG5cdFx0XHRpZiAoaW5kZXggPiAtMSkge1xuXHRcdFx0XHR0aGlzLnN1YnNjcmlwdGlvbnNCeUV2ZW50TmFtZVtldmVudE5hbWVdLnNwbGljZShpbmRleCwgMSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0dHJhbnNmb3JtKGV2ZW50TmFtZSwgZm4pIHtcblx0XHRpZiAodHlwZW9mIGV2ZW50TmFtZSA9PT0gJ2Z1bmN0aW9uJykge1xuXHRcdFx0Zm4gPSBldmVudE5hbWU7XG5cdFx0XHRldmVudE5hbWUgPSAnX19hbGxfXyc7XG5cdFx0fVxuXG5cdFx0aWYgKCF0aGlzLnRyYW5zZm9ybWVyc1tldmVudE5hbWVdKSB7XG5cdFx0XHR0aGlzLnRyYW5zZm9ybWVyc1tldmVudE5hbWVdID0gW107XG5cdFx0fVxuXG5cdFx0dGhpcy50cmFuc2Zvcm1lcnNbZXZlbnROYW1lXS5wdXNoKGZuKTtcblx0fVxuXG5cdGFwcGx5VHJhbnNmb3JtZXJzKG1ldGhvZFNjb3BlLCBldmVudE5hbWUsIGFyZ3MpIHtcblx0XHRpZiAodGhpcy50cmFuc2Zvcm1lcnNbJ19fYWxsX18nXSkge1xuXHRcdFx0dGhpcy50cmFuc2Zvcm1lcnNbJ19fYWxsX18nXS5mb3JFYWNoKCh0cmFuc2Zvcm0pID0+IHtcblx0XHRcdFx0YXJncyA9IHRyYW5zZm9ybS5jYWxsKG1ldGhvZFNjb3BlLCBldmVudE5hbWUsIGFyZ3MpO1xuXHRcdFx0XHRtZXRob2RTY29wZS50cmFuZm9ybWVkID0gdHJ1ZTtcblx0XHRcdFx0aWYgKCFBcnJheS5pc0FycmF5KGFyZ3MpKSB7XG5cdFx0XHRcdFx0YXJncyA9IFthcmdzXTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMudHJhbnNmb3JtZXJzW2V2ZW50TmFtZV0pIHtcblx0XHRcdHRoaXMudHJhbnNmb3JtZXJzW2V2ZW50TmFtZV0uZm9yRWFjaCgodHJhbnNmb3JtKSA9PiB7XG5cdFx0XHRcdGFyZ3MgPSB0cmFuc2Zvcm0uY2FsbChtZXRob2RTY29wZSwgLi4uYXJncyk7XG5cdFx0XHRcdG1ldGhvZFNjb3BlLnRyYW5mb3JtZWQgPSB0cnVlO1xuXHRcdFx0XHRpZiAoIUFycmF5LmlzQXJyYXkoYXJncykpIHtcblx0XHRcdFx0XHRhcmdzID0gW2FyZ3NdO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRyZXR1cm4gYXJncztcblx0fVxuXG5cblx0X3B1Ymxpc2gocHVibGljYXRpb24sIGV2ZW50TmFtZSwgb3B0aW9ucykge1xuXHRcdGNoZWNrKGV2ZW50TmFtZSwgU3RyaW5nKTtcblx0XHRjaGVjayhvcHRpb25zLCBNYXRjaC5PbmVPZihCb29sZWFuLCB7XG5cdFx0XHR1c2VDb2xsZWN0aW9uOiBCb29sZWFuLFxuXHRcdFx0YXJnczogQXJyYXksXG5cdFx0fSkpO1xuXG5cdFx0bGV0IHVzZUNvbGxlY3Rpb24sIGFyZ3MgPSBbXTtcblxuXHRcdGlmICh0eXBlb2Ygb3B0aW9ucyA9PT0gJ2Jvb2xlYW4nKSB7XG5cdFx0XHR1c2VDb2xsZWN0aW9uID0gb3B0aW9ucztcblx0XHR9IGVsc2Uge1xuXHRcdFx0aWYgKG9wdGlvbnMudXNlQ29sbGVjdGlvbikge1xuXHRcdFx0XHR1c2VDb2xsZWN0aW9uID0gb3B0aW9ucy51c2VDb2xsZWN0aW9uO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAob3B0aW9ucy5hcmdzKSB7XG5cdFx0XHRcdGFyZ3MgPSBvcHRpb25zLmFyZ3M7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKGV2ZW50TmFtZS5sZW5ndGggPT09IDApIHtcblx0XHRcdHB1YmxpY2F0aW9uLnN0b3AoKTtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ2ludmFsaWQtZXZlbnQtbmFtZScpO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmlzUmVhZEFsbG93ZWQocHVibGljYXRpb24sIGV2ZW50TmFtZSwgYXJncykgIT09IHRydWUpIHtcblx0XHRcdHB1YmxpY2F0aW9uLnN0b3AoKTtcblx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ25vdC1hbGxvd2VkJyk7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgc3Vic2NyaXB0aW9uID0ge1xuXHRcdFx0c3Vic2NyaXB0aW9uOiBwdWJsaWNhdGlvbixcblx0XHRcdGV2ZW50TmFtZTogZXZlbnROYW1lXG5cdFx0fTtcblxuXHRcdHRoaXMuYWRkU3Vic2NyaXB0aW9uKHN1YnNjcmlwdGlvbiwgZXZlbnROYW1lKTtcblxuXHRcdHB1YmxpY2F0aW9uLm9uU3RvcCgoKSA9PiB7XG5cdFx0XHR0aGlzLnJlbW92ZVN1YnNjcmlwdGlvbihzdWJzY3JpcHRpb24sIGV2ZW50TmFtZSk7XG5cdFx0fSk7XG5cblx0XHRpZiAodXNlQ29sbGVjdGlvbiA9PT0gdHJ1ZSkge1xuXHRcdFx0Ly8gQ29sbGVjdGlvbiBjb21wYXRpYmlsaXR5XG5cdFx0XHRwdWJsaWNhdGlvbi5fc2Vzc2lvbi5zZW5kQWRkZWQodGhpcy5zdWJzY3JpcHRpb25OYW1lLCAnaWQnLCB7XG5cdFx0XHRcdGV2ZW50TmFtZTogZXZlbnROYW1lXG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRwdWJsaWNhdGlvbi5yZWFkeSgpO1xuXHR9XG5cblx0aW5pUHVibGljYXRpb24oKSB7XG5cdFx0Y29uc3Qgc3RyZWFtID0gdGhpcztcblx0XHRNZXRlb3IucHVibGlzaCh0aGlzLnN1YnNjcmlwdGlvbk5hbWUsIGZ1bmN0aW9uICguLi5hcmdzKSB7IHJldHVybiBzdHJlYW0uX3B1Ymxpc2guYXBwbHkoc3RyZWFtLCBbdGhpcywgLi4uYXJnc10pOyB9KTtcblx0fVxuXG5cdGluaXRNZXRob2QoKSB7XG5cdFx0Y29uc3Qgc3RyZWFtID0gdGhpcztcblx0XHRjb25zdCBtZXRob2QgPSB7fTtcblxuXHRcdG1ldGhvZFt0aGlzLnN1YnNjcmlwdGlvbk5hbWVdID0gZnVuY3Rpb24oZXZlbnROYW1lLCAuLi5hcmdzKSB7XG5cdFx0XHRjaGVjayhldmVudE5hbWUsIFN0cmluZyk7XG5cdFx0XHRjaGVjayhhcmdzLCBBcnJheSk7XG5cblx0XHRcdHRoaXMudW5ibG9jaygpO1xuXG5cdFx0XHRpZiAoc3RyZWFtLmlzV3JpdGVBbGxvd2VkKHRoaXMsIGV2ZW50TmFtZSwgYXJncykgIT09IHRydWUpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBtZXRob2RTY29wZSA9IHtcblx0XHRcdFx0dXNlcklkOiB0aGlzLnVzZXJJZCxcblx0XHRcdFx0Y29ubmVjdGlvbjogdGhpcy5jb25uZWN0aW9uLFxuXHRcdFx0XHRvcmlnaW5hbFBhcmFtczogYXJncyxcblx0XHRcdFx0dHJhbmZvcm1lZDogZmFsc2Vcblx0XHRcdH07XG5cblx0XHRcdGFyZ3MgPSBzdHJlYW0uYXBwbHlUcmFuc2Zvcm1lcnMobWV0aG9kU2NvcGUsIGV2ZW50TmFtZSwgYXJncyk7XG5cblx0XHRcdHN0cmVhbS5lbWl0V2l0aFNjb3BlKGV2ZW50TmFtZSwgbWV0aG9kU2NvcGUsIC4uLmFyZ3MpO1xuXG5cdFx0XHRpZiAoc3RyZWFtLnJldHJhbnNtaXQgPT09IHRydWUpIHtcblx0XHRcdFx0c3RyZWFtLl9lbWl0KGV2ZW50TmFtZSwgYXJncywgdGhpcy5jb25uZWN0aW9uLCB0cnVlKTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0dHJ5IHtcblx0XHRcdE1ldGVvci5tZXRob2RzKG1ldGhvZCk7XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0Y29uc29sZS5lcnJvcihlKTtcblx0XHR9XG5cdH1cblxuXHRfZW1pdChldmVudE5hbWUsIGFyZ3MsIG9yaWdpbiwgYnJvYWRjYXN0KSB7XG5cdFx0aWYgKGJyb2FkY2FzdCA9PT0gdHJ1ZSkge1xuXHRcdFx0TWV0ZW9yLlN0cmVhbWVyQ2VudHJhbC5lbWl0KCdicm9hZGNhc3QnLCB0aGlzLm5hbWUsIGV2ZW50TmFtZSwgYXJncyk7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgc3Vic2NyaXB0aW9ucyA9IHRoaXMuc3Vic2NyaXB0aW9uc0J5RXZlbnROYW1lW2V2ZW50TmFtZV07XG5cdFx0aWYgKCFBcnJheS5pc0FycmF5KHN1YnNjcmlwdGlvbnMpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgbXNnID0gY2hhbmdlZFBheWxvYWQodGhpcy5zdWJzY3JpcHRpb25OYW1lLCAnaWQnLCB7XG5cdFx0XHRldmVudE5hbWUsXG5cdFx0XHRhcmdzXG5cdFx0fSk7XG5cblx0XHRpZighbXNnKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0c3Vic2NyaXB0aW9ucy5mb3JFYWNoKChzdWJzY3JpcHRpb24pID0+IHtcblx0XHRcdGlmICh0aGlzLnJldHJhbnNtaXRUb1NlbGYgPT09IGZhbHNlICYmIG9yaWdpbiAmJiBvcmlnaW4gPT09IHN1YnNjcmlwdGlvbi5zdWJzY3JpcHRpb24uY29ubmVjdGlvbikge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGlmICh0aGlzLmlzRW1pdEFsbG93ZWQoc3Vic2NyaXB0aW9uLnN1YnNjcmlwdGlvbiwgZXZlbnROYW1lLCAuLi5hcmdzKSkge1xuXHRcdFx0XHRzZW5kKHN1YnNjcmlwdGlvbi5zdWJzY3JpcHRpb24uX3Nlc3Npb24sIG1zZyk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRlbWl0KGV2ZW50TmFtZSwgLi4uYXJncykge1xuXHRcdHRoaXMuX2VtaXQoZXZlbnROYW1lLCBhcmdzLCB1bmRlZmluZWQsIHRydWUpO1xuXHR9XG5cblx0X19lbWl0KC4uLmFyZ3MpIHtcblx0XHRyZXR1cm4gc3VwZXIuZW1pdCguLi5hcmdzKTtcblx0fVxuXG5cdGVtaXRXaXRob3V0QnJvYWRjYXN0KGV2ZW50TmFtZSwgLi4uYXJncykge1xuXHRcdHRoaXMuX2VtaXQoZXZlbnROYW1lLCBhcmdzLCB1bmRlZmluZWQsIGZhbHNlKTtcblx0fVxufTtcbiJdfQ==
