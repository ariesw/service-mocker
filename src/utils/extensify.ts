/**
 * Make the un-extendable classes great again
 *
 * Notes:
 * - Main concepts:
 *   1. The best way to make another native class is to extend native class
 *      with overriding some methods. However, extending the native sometimes
 *      raises an error: <Failed to construct ${Native}: Please use the 'new' operator,
 *      this DOM object constructor cannot be called as a function.>
 *   2. So we should extend `Native` in some ways that are not constructing
 *      new instance with `Native.call(this)`:
 *      2.1. Look back to JavaScript inheritance, no matter which method we choose to
 *           use, we are almost doing the same thing: let the execution context of
 *           `SuperClass.prototype.method` be the instance of `SubClass`.
 *      1.2. Thus if we bind `Native.prototype.method` with a native instance,
 *           we can be free to invoke all methods in prototype! Then attaching these
 *           methods to the `Extandable.prototype`, the instances of `Extandable` will act
 *           as if they're real native instances!
 *
 * - Implementation of `Extandable`:
 *   1. Create a normal class with `this._native` pointing to a native instance,
 *   2. Iterate through the descriptors of `Native.prototype`:
 *      2.1. If the property is a primitive value, do nothing,
 *      2.2. If the property is an accessor, bind `get` and `set` with `this._native`,
 *      2.3. If the property is a function, bind it with `this._native`,
 *      2.4. Copy the descriptor to `Extandable.prototype`
 *   3. Iterate through the descriptors of `Native`, copy them to `Extandable` as
 *      static methods.
 */

/**
 * Make un-extendable native classes extendable
 * @param Native Native class
 * @param ...inits Parameters used for creating a temporary instance
 */
export function extensify<T>(Native: T, ...inits): T;
export function extensify(Native, ...inits) {

  class Extandable {
    protected _native;

    constructor(...args) {
      this._native = new Native(...args);
    }
  }

  // copy all static properties
  // safari 9- will include a "prototype" property on XMLHttpRequest
  try {
    Object.keys(Native).forEach(prop => {
      Object.defineProperty(
        Extandable, prop,
        Object.getOwnPropertyDescriptor(Native, prop),
      );
    });
  } catch (e) {}

  // delegate all unset properties to `_native`
  (function mapPrototypeMethods(
    source = Native.prototype,
    target = Extandable.prototype,
  ) {
    if (source.constructor === Object) {
      // exit recursion
      return;
    }

    Object.keys(source).forEach(prop => {
      if (target.hasOwnProperty(prop)) {
        return;
      }

      const descriptor = Object.getOwnPropertyDescriptor(source, prop);

      if (descriptor.get || descriptor.set) {
        descriptor.get = function getNative() {
          return this._native[prop];
        };

        descriptor.set = function setNative(value) {
          this._native[prop] = value;
          return value;
        };
      } else if (typeof descriptor.value === 'function') {
        // method
        const nativeFn = descriptor.value;
        descriptor.value = function wrapped(...args) {
          return nativeFn.apply(this._native, args);
        };
      }

      Object.defineProperty(target, prop, descriptor);
    });

    // recursively look-up
    mapPrototypeMethods(Object.getPrototypeOf(source), target);
  })();

  // safari 9- only have methods on `XMLHttpRequest.prototype`
  const native = new Native(...inits);
  for (let prop in native) {
    if (!Extandable.prototype.hasOwnProperty(prop)) {
      Object.defineProperty(Extandable.prototype, prop, {
        get() {
          return this._native[prop];
        },
        set(value: any) {
          this._native[prop] = value;
          return value;
        },
        enumerable: true,
        configurable: true,
      });
    }
  }

  return Extandable;
}
