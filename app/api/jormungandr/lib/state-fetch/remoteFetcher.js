// @flow

import type {
  AddressUtxoRequest, AddressUtxoResponse,
  UtxoSumRequest, UtxoSumResponse,
  HistoryRequest, HistoryResponse,
  RewardHistoryRequest, RewardHistoryResponse,
  BestBlockRequest, BestBlockResponse,
  SignedRequest, SignedResponse,
  ReputationRequest, ReputationResponse,
  AccountStateRequest, AccountStateResponse,
  PoolInfoRequest, PoolInfoResponse,
  SignedRequestInternal,
  RemoteTransaction,
} from './types';
import type {
  FilterUsedRequest, FilterUsedResponse,
} from '../../../common/lib/state-fetch/currencySpecificTypes';

import type { IFetcher } from './IFetcher';

import axios from 'axios';
import {
  Logger,
  stringifyError
} from '../../../../utils/logging';
import {
  GetUtxosForAddressesApiError,
  GetUtxosSumsForAddressesApiError,
  GetTxHistoryForAddressesApiError,
  GetRewardHistoryApiError,
  GetBestBlockError,
  SendTransactionApiError,
  CheckAddressesInUseApiError,
  InvalidWitnessError,
  GetAccountStateApiError,
  GetPoolInfoApiError,
  GetReputationError,
  RollbackApiError,
} from '../../../common/errors';

import type { ConfigType } from '../../../../../config/config-types';

// populated by ConfigWebpackPlugin
declare var CONFIG: ConfigType;

/**
 * Makes calls to Yoroi backend service
 * https://github.com/Emurgo/yoroi-backend-service
 */
export class RemoteFetcher implements IFetcher {

  getLastLaunchVersion: () => string;
  getCurrentLocale: () => string;
  getPlatform: () => string;

  constructor(
    getLastLaunchVersion: () => string,
    getCurrentLocale: () => string,
    getPlatform: () => string,
  ) {
    this.getLastLaunchVersion = getLastLaunchVersion;
    this.getCurrentLocale = getCurrentLocale;
    this.getPlatform = getPlatform;
  }

  getUTXOsForAddresses: AddressUtxoRequest => Promise<AddressUtxoResponse> = (body) => {
    const { BackendService } = body.network.Backend;
    if (BackendService == null) throw new Error(`${nameof(this.getUTXOsForAddresses)} missing backend url`);
    return axios(
      `${BackendService}/api/txs/utxoForAddresses`,
      {
        timeout: 2 * CONFIG.app.walletRefreshInterval,
        method: 'post',
        data: {
          addresses: body.addresses
        },
        headers: {
          'yoroi-version': this.getLastLaunchVersion(),
          'yoroi-locale': this.getCurrentLocale()
        }
      }
    ).then(response => response.data)
      .catch((error) => {
        Logger.error(`${nameof(RemoteFetcher)}::${nameof(this.getUTXOsForAddresses)} error: ` + stringifyError(error));
        throw new GetUtxosForAddressesApiError();
      });
  }

  getUTXOsSumsForAddresses: UtxoSumRequest => Promise<UtxoSumResponse> = (body) => {
    const { BackendService } = body.network.Backend;
    if (BackendService == null) throw new Error(`${nameof(this.getUTXOsForAddresses)} missing backend url`);
    return axios(
      `${BackendService}/api/txs/utxoSumForAddresses`,
      {
        method: 'post',
        timeout: 2 * CONFIG.app.walletRefreshInterval,
        data: {
          addresses: body.addresses
        },
        headers: {
          'yoroi-version': this.getLastLaunchVersion(),
          'yoroi-locale': this.getCurrentLocale()
        }
      }
    ).then(response => response.data)
      .catch((error) => {
        Logger.error(`${nameof(RemoteFetcher)}::${nameof(this.getUTXOsSumsForAddresses)} error: ` + stringifyError(error));
        throw new GetUtxosSumsForAddressesApiError();
      });
  }

  getTransactionsHistoryForAddresses: HistoryRequest => Promise<HistoryResponse> = (body) => {
    const { network, ...rest } = body;
    const { BackendService } = network.Backend;
    if (BackendService == null) throw new Error(`${nameof(this.getUTXOsForAddresses)} missing backend url`);
    return axios(
      `${BackendService}/api/v2/txs/history`,
      {
        method: 'post',
        timeout: 2 * CONFIG.app.walletRefreshInterval,
        data: rest,
        headers: {
          'yoroi-version': this.getLastLaunchVersion(),
          'yoroi-locale': this.getCurrentLocale()
        }
      }
    ).then(response => {
      return response.data.map((resp: RemoteTransaction) => {
        for (const input of resp.inputs) {
          // backend stores inputs as numbers but outputs as strings
          // we solve this mismatch locally
          input.amount = input.amount.toString();
        }
        if (resp.height != null) {
          return resp;
        }
        // There can only ever be one certificate per tx but our backend returns an array
        // $FlowExpectedError[prop-missing] remove this if we ever fix this
        if (resp.certificates != null && resp.certificates.length > 0) {
          resp.certificate = resp.certificates[0];
          // $FlowExpectedError[prop-missing] remove this if we ever fix this
          delete resp.certificates;
        }
        // $FlowExpectedError[prop-missing] remove if we rename the field in the backend-service
        const height = resp.block_num;
        // $FlowExpectedError[prop-missing] remove if we rename the field in the backend-service
        delete resp.block_num;
        return {
          ...resp,
          height,
        };
      });
    })
      .catch((error) => {
        Logger.error(`${nameof(RemoteFetcher)}::${nameof(this.getTransactionsHistoryForAddresses)} error: ` + stringifyError(error));
        if (
          error?.response === 'REFERENCE_BLOCK_MISMATCH' ||
          error?.response === 'REFERENCE_TX_NOT_FOUND' ||
          error?.response === 'REFERENCE_BEST_BLOCK_MISMATCH'
        ) {
          throw new RollbackApiError();
        }
        throw new GetTxHistoryForAddressesApiError();
      });
  }

  getRewardHistory: RewardHistoryRequest => Promise<RewardHistoryResponse> = (body) => {
    const { network, ...rest } = body;
    const { BackendService } = network.Backend;
    if (BackendService == null) throw new Error(`${nameof(this.getUTXOsForAddresses)} missing backend url`);
    return axios(
      `${BackendService}/api/v2/account/rewards`,
      {
        method: 'post',
        timeout: 2 * CONFIG.app.walletRefreshInterval,
        data: rest,
        headers: {
          'yoroi-version': this.getLastLaunchVersion(),
          'yoroi-locale': this.getCurrentLocale()
        }
      }
    ).then(response => response.data)
      .catch((error) => {
        Logger.error(`${nameof(RemoteFetcher)}::${nameof(this.getRewardHistory)} error: ` + stringifyError(error));
        throw new GetRewardHistoryApiError();
      });
  }

  getBestBlock: BestBlockRequest => Promise<BestBlockResponse> = (body) => {
    const { BackendService } = body.network.Backend;
    if (BackendService == null) throw new Error(`${nameof(this.getUTXOsForAddresses)} missing backend url`);
    return axios(
      `${BackendService}/api/v2/bestblock`,
      {
        method: 'get',
        timeout: 2 * CONFIG.app.walletRefreshInterval,
        headers: {
          'yoroi-version': this.getLastLaunchVersion(),
          'yoroi-locale': this.getCurrentLocale()
        }
      }
    ).then(response => response.data)
      .catch((error) => {
        Logger.error(`${nameof(RemoteFetcher)}::${nameof(this.getBestBlock)} error: ` + stringifyError(error));
        throw new GetBestBlockError();
      });
  }

  sendTx: SignedRequest => Promise<SignedResponse> = (body) => {
    const signedTx64 = Buffer.from(body.encodedTx).toString('base64');
    const { BackendService } = body.network.Backend;
    if (BackendService == null) throw new Error(`${nameof(this.getUTXOsForAddresses)} missing backend url`);
    return axios(
      `${BackendService}/api/txs/signed`,
      {
        method: 'post',
        timeout: 2 * CONFIG.app.walletRefreshInterval,
        data: ({
          signedTx: signedTx64
        }: SignedRequestInternal),
        headers: {
          'yoroi-version': this.getLastLaunchVersion(),
          'yoroi-locale': this.getCurrentLocale()
        }
      }
    ).then(() => ({
      txId: body.id
    }))
      .catch((error) => {
        Logger.error(`${nameof(RemoteFetcher)}::${nameof(this.sendTx)} error: ` + stringifyError(error));
        if (error.request.response.includes('Invalid witness')) {
          throw new InvalidWitnessError();
        }
        throw new SendTransactionApiError();
      });
  }

  checkAddressesInUse: FilterUsedRequest => Promise<FilterUsedResponse> = (body) => {
    const { BackendService } = body.network.Backend;
    if (BackendService == null) throw new Error(`${nameof(this.getUTXOsForAddresses)} missing backend url`);
    return axios(
      `${BackendService}/api/v2/addresses/filterUsed`,
      {
        method: 'post',
        timeout: 2 * CONFIG.app.walletRefreshInterval,
        data: {
          addresses: body.addresses
        },
        headers: {
          'yoroi-version': this.getLastLaunchVersion(),
          'yoroi-locale': this.getCurrentLocale()
        }
      }
    ).then(response => response.data)
      .catch((error) => {
        Logger.error(`${nameof(RemoteFetcher)}::${nameof(this.checkAddressesInUse)} error: ` + stringifyError(error));
        throw new CheckAddressesInUseApiError();
      });
  }

  getAccountState: AccountStateRequest => Promise<AccountStateResponse> = (body) => {
    const { BackendService } = body.network.Backend;
    if (BackendService == null) throw new Error(`${nameof(this.getUTXOsForAddresses)} missing backend url`);
    return axios(
      `${BackendService}/api/v2/account/state`,
      {
        method: 'post',
        timeout: 2 * CONFIG.app.walletRefreshInterval,
        data: {
          addresses: body.addresses
        },
        headers: {
          'yoroi-version': this.getLastLaunchVersion(),
          'yoroi-locale': this.getCurrentLocale()
        }
      }
    ).then(response => {
      const mapped = {};
      for (const key of Object.keys(response.data)) {
        // Jormungandr returns '' when the address is valid but it hasn't appeared in the blockchain
        // edit: Jormungandr can now also return a description error whe not in the blockchain
        if (response.data[key] === '' || response.data[key] === 'Account does not exist') {
          mapped[key] = {
            delegation: { pools: [], },
            value: 0,
            counter: 0,
          };
        } else {
          mapped[key] = response.data[key];
        }
      }
      return mapped;
    })
      .catch((error) => {
        Logger.error(`${nameof(RemoteFetcher)}::${nameof(this.getAccountState)} error: ` + stringifyError(error));
        throw new GetAccountStateApiError();
      });
  }

  getPoolInfo: PoolInfoRequest => Promise<PoolInfoResponse> = (body) => {
    const { BackendService } = body.network.Backend;
    if (BackendService == null) throw new Error(`${nameof(this.getUTXOsForAddresses)} missing backend url`);
    return axios(
      `${BackendService}/api/v2/pool/info`,
      {
        method: 'post',
        timeout: 2 * CONFIG.app.walletRefreshInterval,
        data: {
          ids: body.ids
        },
        headers: {
          'yoroi-version': this.getLastLaunchVersion(),
          'yoroi-locale': this.getCurrentLocale()
        }
      }
    ).then(response => response.data)
      .catch((error) => {
        Logger.error(`${nameof(RemoteFetcher)}::${nameof(this.getPoolInfo)} error: ` + stringifyError(error));
        throw new GetPoolInfoApiError();
      });
  }

  getReputation: ReputationRequest => Promise<ReputationResponse> = (body) => {
    const { BackendService } = body.network.Backend;
    if (BackendService == null) throw new Error(`${nameof(this.getUTXOsForAddresses)} missing backend url`);
    return axios(
      `${BackendService}/api/v2/pool/reputation`,
      {
        method: 'get',
        timeout: 2 * CONFIG.app.walletRefreshInterval,
        headers: {
          'yoroi-version': this.getLastLaunchVersion(),
          'yoroi-locale': this.getCurrentLocale()
        }
      }
    ).then(response => response.data)
      .catch((error) => {
        Logger.error(`${nameof(RemoteFetcher)}::${nameof(this.getReputation)} error: ` + stringifyError(error));
        throw new GetReputationError();
      });
  }
}
