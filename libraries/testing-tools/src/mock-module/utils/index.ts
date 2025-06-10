import { CallOptions, ClientMiddlewareCall, Metadata } from 'nice-grpc';

/**
 * Middleware used in tests to attach a module name to outgoing gRPC requests.
 *
 * @param {string} moduleName Name to set in request metadata.
 * @returns {(call: ClientMiddlewareCall<Request, Response>, options: CallOptions) => AsyncGenerator}
 *          Nice-grpc middleware function.
 */
export function getModuleNameInterceptor(moduleName: string) {
  return async function* middleware<Request, Response>(
    call: ClientMiddlewareCall<Request, Response>,
    options: CallOptions,
  ) {
    if (!options.metadata) {
      options.metadata = Metadata();
    }
    options.metadata?.set('module-name', moduleName);
    return yield* call.next(call.request, options);
  };
}
