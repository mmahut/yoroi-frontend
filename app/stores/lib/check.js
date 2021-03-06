// @flow

import type { ApiOptionType } from '../../api/common/utils';

export function checkAndCall<TArgs: *>(
  expectedAPI: ApiOptionType,
  getAPI: void => (void | ApiOptionType),
  func: (...args: TArgs) => void,
): (...args: TArgs) => void {
  return function (...args: TArgs): void {
    const selectedNetwork = getAPI();
    if (selectedNetwork === expectedAPI) {
      return func(...args);
    }
  };
}

export function checkAndCallAsync<TArgs: *>(
  expectedAPI: ApiOptionType,
  getAPI: void => (void | ApiOptionType),
  func: (...args: TArgs) => Promise<void>,
): (...args: TArgs) => Promise<void> {
  return async function (...args: TArgs): Promise<void> {
    const selectedNetwork = getAPI();
    if (selectedNetwork === expectedAPI) {
      return func(...args);
    }
  };
}

export function buildCheckAndCall(
  expectedAPI: ApiOptionType,
  getAPI: void => (void | ApiOptionType),
): {| syncCheck: typeof fakeSyncFunc, asyncCheck: typeof fakeAsyncFunc |} {
  return {
    syncCheck: (func: any): any => {
      return checkAndCall(expectedAPI, getAPI, func);
    },
    asyncCheck: (func: any): any => {
      return checkAndCallAsync(expectedAPI, getAPI, func);
    }
  };
}

// just use this since it's easier to read typeof fakeFunc than a giant ugly type definition
function fakeAsyncFunc<TArgs: *>(
  func: (...args: TArgs) => Promise<void>,
): (...args: TArgs) => Promise<void> {
  return func;
}
function fakeSyncFunc<TArgs: *>(
  func: (...args: TArgs) => void,
): (...args: TArgs) => void {
  return func;
}
