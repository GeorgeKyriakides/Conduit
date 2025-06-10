import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { isNil } from 'lodash-es';

export namespace RuleCache {
  /**
   * Stores a rule evaluation decision in the in-memory cache.
   *
   * @param {ConduitGrpcSdk} grpcSdk The grpc SDK instance.
   * @param {string} computedTuple The computed tuple identifier.
   * @param {boolean} decision The access decision to cache.
   */
  export function storeResolution(
    grpcSdk: ConduitGrpcSdk,
    computedTuple: string,
    decision: boolean,
  ) {
    // 2s TTL
    grpcSdk.state!.setKey(
      `ruleCache:${computedTuple}`,
      Boolean(decision).toString(),
      2000,
    );
  }

  /**
   * Looks up a cached rule evaluation decision.
   *
   * @param {ConduitGrpcSdk} grpcSdk The grpc SDK instance.
   * @param {string} computedTuple The computed tuple identifier.
   * @returns {Promise<boolean | null>} Cached decision or null if not found.
   */
  export function findResolution(
    grpcSdk: ConduitGrpcSdk,
    computedTuple: string,
  ): Promise<boolean | null> {
    return grpcSdk
      .state!.getKey(`ruleCache:${computedTuple}`)
      .then((value: string | null) => {
        if (!isNil(value)) {
          return value === 'true';
        }
        return null;
      });
  }
}
