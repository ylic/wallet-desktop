import Eos from 'eosjs';
import axios from 'axios'
import { NODE_API_URL } from '@/constants/config.constants';
import Store from '@/store';

import {
  getToken,
  toAsset,
  toBigNumber,
  calcVoteExist,
  calcTotalAmount,
  handleApiError,
  calcVoteage,
  calcReward,
  calcApr,
  get_error_msg
} from '@/utils/util';

export const getBpNick = () => {
  return fetch('https://updatewallet.oss-cn-hangzhou.aliyuncs.com/eosforce/bp-nickname.json').then(res => res.json());
};

export const getNodeList = () => {
  const map = {
    '1.0': NODE_API_URL,
    // '0.7': NODE_TEST_NET_URL,
  };
  return fetch(map[Store.state.app.chainNet]).then(async res => {
    let data = await res.json();
    return data;
  });
};

// 获取节点信息
export const getNodeInfo = async (httpEndpoint) => {
    let api_path = '/v1/chain/get_info';
    let data = await axios.post(httpEndpoint + api_path, {})
    .then(data => {
      return data.data;
    })
    .catch(err => {
      console.log('error__', err);
      return null;
    })
    return data;  
};

// 查询块信息
export const getBlock = httpEndpoint => async (block_num_or_id, concel_container = {cancel: []}) => {
  let CancelToken = axios.CancelToken;
  let api_path = '/v1/chain/get_block';
  let data = await axios.post(httpEndpoint + api_path, 
      { 
        block_num_or_id
      },  
      {
        cancelToken: new CancelToken(function executor(c) {
          concel_container.cancel.push(c);
        })
      }
    )
    .then(data => data.data)
    .catch(err => null);
  return data;
};
// '/v1/chain/get_account'
// 根据公钥获取用户名数组
export const getAccounts = httpEndpoint => async (publicKey) => {
  let CancelToken = axios.CancelToken;
  let api_path = '/v1/history/get_key_accounts';
  let data = await axios.post(httpEndpoint + api_path, 
    { 
      public_key: publicKey
    },  
    {
      cancelToken: new CancelToken(function executor(c) {
        // concel_container.cancel.push(c);
      })
    }
  )
  .then(data => data.data.account_names)
  .catch(err => []);
  return data;
};

// 获取交易记录
export const getTransferRecord = httpEndpoint => async ({accountName, pos, offset, concel_container = {cancel: []}}) => {
  // /v1/history/get_actions
  let CancelToken = axios.CancelToken;
  let api_path = '/v1/history/get_actions';
  let data = await axios.post(httpEndpoint + api_path, 
    { 
      account_name: accountName, pos: pos, offset: offset, limit: 100
    },  
    {
      cancelToken: new CancelToken(function executor(c) {
        concel_container.cancel.push(c);
      })
    }
  )
  .then(data => data.data)
  .catch(err => []);
  return data;
};

// 获取交易详情
export const getTransAction = httpEndpoint => async (tid) => {
  // /v1/history/get_transaction
  let CancelToken = axios.CancelToken;
  let api_path = '/v1/history/get_transaction';
  let data = await axios.post(httpEndpoint + api_path, 
    { 
      id: tid
    }
  )
  .then(data => data.data)
  .catch(err => []);
  return data;
};
// 查询账号是否存在
export const queryAccount = httpEndpoint => accountName => {
  return Eos({ httpEndpoint })
    .getTableRows({
      scope: 'eosio',
      code: 'eosio',
      table: 'accounts',
      table_key: accountName,
      limit: 10000,
      json: true,
    })
    .then(result => {
      const account = result.rows.find(acc => acc.name === accountName);
      if (account) {
        return true;
      } else {
        return false;
      }
    });
};

export const getAccount = httpEndpoint => async (accountName, concel_container = {cancel: []}) => {
  let CancelToken = axios.CancelToken;
  let api_path = '/v1/chain/get_account';
  let data = await axios.post(httpEndpoint + api_path, 
    { 
      account_name: accountName
    },  
    {
      cancelToken: new CancelToken(function executor(c) {
        concel_container.cancel.push(c);
      })
    }
  )
  .then(data => data.data)
  .catch(err => null);
  return data;
};

// 获取指定账户可用余额
export const getAvailable = httpEndpoint => async (accountName, concel_container = {cancel: []}) => {
  let CancelToken = axios.CancelToken;
  let api_path = '/v1/chain/get_table_rows';
  let data = await axios.post(httpEndpoint + api_path, 
    { 
      scope: 'eosio',
      code: 'eosio',
      table: 'accounts',
      table_key: accountName,
      limit: 10000,
      json: true,
    },  
    {
      cancelToken: new CancelToken(function executor(c) {
        concel_container.cancel.push(c);
      })
    }
  )
  .then(data => data.data)
  .catch(err => null);
  if(!data) return data;
  const account = data.rows.find(acc => acc.name === accountName);
  if (account) {
    return toBigNumber(account.available);
  } else {
    return toBigNumber(0);
  }
};

// 获取 token list
export const getTokenList = httpEndpoint => accountName => {
  return Eos({ httpEndpoint })
    .getTableRows({ scope: accountName, code: 'eosio.token', table: 'accounts', json: true, limit: 1000 })
    .then(data => {
      if (data.rows.length) {
        return Promise.all(
          data.rows.map(row => {
            let balance = row.balance;
            const symbol = getToken(balance);
            return Eos({ httpEndpoint })
              .getTableRows({
                scope: symbol,
                code: 'eosio.token',
                table: 'stat',
                json: true,
                limit: 1000,
              })
              .then(result => {
                const match = balance && balance.match(/\.(\d*)/);
                const precision = match && match[1] ? match[1].length : 0;
                balance = toBigNumber(balance, symbol);
                let token_config = result.rows[0];
                token_config.max_supply = toBigNumber(token_config.max_supply, symbol);
                token_config.supply = toBigNumber(token_config.supply, symbol);
                return {
                  symbol,
                  precision,
                  balance,
                  ...token_config,
                };
              });
          })
        );
      } else {
        return Promise.resolve();
      }
    });
};

// 获取 bp 表
export const getBpsTable = httpEndpoint => async (concel_container = {cancel: []}) => {
  let CancelToken = axios.CancelToken;
  let api_path = '/v1/chain/get_table_rows';
  let data = await axios.post(httpEndpoint + api_path, 
    { 
      scope: 'eosio',
      code: 'eosio',
      table: 'bps',
      json: true,
      limit: 1000 
    },  
    {
      cancelToken: new CancelToken(function executor(c) {
        concel_container.cancel.push(c);
      })
    }
  )
  .then(data => data.data.rows)
  .catch(err => []);
  return data;
};

// 获取 vote 表
export const getVotesTable = httpEndpoint => async (accountName, concel_container = {cancel: []}) => {
  let CancelToken = axios.CancelToken;
  let api_path = '/v1/chain/get_table_rows';
  let data = await axios.post(httpEndpoint + api_path, 
    { 
      scope: accountName, code: 'eosio', table: 'votes', json: true, limit: 1000
    },  
    {
      cancelToken: new CancelToken(function executor(c) {
        concel_container.cancel.push(c);
      })
    }
  )
  .then(data => data.data.rows)
  .catch(err => []);
  return data;
};

// table
export const getTable = httpEndpoint => async (params, concel_container = {cancel: []}) => {
  let CancelToken = axios.CancelToken;
  let api_path = '/v1/chain/get_table_rows';
  let data = await axios.post(httpEndpoint + api_path, 
    { 
      ...params, json: true, limit: 1000 
    },  
    {
      cancelToken: new CancelToken(function executor(c) {
        concel_container.cancel.push(c);
      })
    }
  )
  .then(data => data.data)
  .catch(err => []);
  return data;
};
// 全局基础信息获取
export const getGlobalTable = httpEndpoint => async (accountName, current_node, block) => {
  let start_time = new Date().getTime();
  let votesTable = await getVotesTable(httpEndpoint)(accountName);
  let bpsTable = await getBpsTable(httpEndpoint)();
  const { head_block_num: currentHeight } = current_node || await getNodeInfo(httpEndpoint);
  const { schedule_version } = block || await getBlock(httpEndpoint)(currentHeight);

  let version = schedule_version;
  let superBpsAmountTable = await getTable(httpEndpoint)({
    scope: 'eosio',
    code: 'eosio',
    table: 'schedules',
    table_key: schedule_version,
  }).then(result => {
    version = result.rows && result.rows[0] && result.rows[0].version;
    return result.rows && result.rows[0] && result.rows[0].producers;
  });
  return {
    votesTable,
    bpsTable,
    superBpsAmountTable,
    version
  }
}
// 根据 bp 和 vote 得到分红表，返回一个对象
export const getRewardsAndBpsTable = httpEndpoint => async (accountName, current_node, concel_container = {cancel: []}, votesTable, bpsTable, superBpsAmountTable, block) => {
  votesTable = votesTable || await getVotesTable(httpEndpoint)(accountName);
  bpsTable = bpsTable || await getBpsTable(httpEndpoint)();

  const { head_block_num: currentHeight } = current_node || await getNodeInfo(httpEndpoint);
  const { schedule_version } = block || await getBlock(httpEndpoint)(currentHeight);
  let version = schedule_version;
  superBpsAmountTable = superBpsAmountTable || await getTable(httpEndpoint)({
    scope: 'eosio',
    code: 'eosio',
    table: 'schedules',
    table_key: schedule_version,
  }).then(result => {
    version = result.rows && result.rows[0] && result.rows[0].version;
    return result.rows && result.rows[0] && result.rows[0].producers;
  });
  const rewardsTable = [];
  const superBpTable = [];
  const commonBpTable = [];
  let bpInfo;
  for (const bpRow of bpsTable) {
    for (let i = 0; i < superBpsAmountTable.length; i++) {
      if (superBpsAmountTable[i].bpname === bpRow.name) {
        bpRow.isSuperBp = true;
        bpRow.version = version;
        bpRow.amount = superBpsAmountTable[i].amount;
        break;
      }
    }

    const vote = votesTable.find(row => row.bpname === bpRow.name);

    if (bpRow.name === accountName) {
      bpInfo = {
        bpname: bpRow,
        ...bpRow,
      };
    }

    // 年化利率
    bpRow.adr = calcApr(bpRow.total_staked, bpRow.commission_rate);

    const bpVoteage = calcVoteage([
      bpRow.total_voteage,
      bpRow.total_staked,
      currentHeight,
      bpRow.voteage_update_height,
    ]);
    bpRow.bpVoteage = bpVoteage;

    if (vote) {
      // 我的最新票龄
      const myVoteage = calcVoteage([vote.voteage, vote.staked, currentHeight, vote.voteage_update_height]);
      // 节点最新票龄
      // 我的分红
      const reward = calcReward([myVoteage, bpVoteage, bpRow.rewards_pool]);

      const extraRow = { bpname: vote.bpname, reward, ...vote };

      rewardsTable.push({ ...extraRow });

      bpRow.vote = { ...extraRow };
      bpRow.hasVote = calcVoteExist(vote.staked, reward, vote.unstaking);
    }

    if (bpRow.isSuperBp) {
      superBpTable.push(bpRow);
    } else {
      commonBpTable.push(bpRow);
    }
  }
  const stakedTotal = calcTotalAmount(votesTable, 'staked');
  const unstakingTotal = calcTotalAmount(votesTable, 'unstaking');
  const rewardTotal = calcTotalAmount(rewardsTable, 'reward');
  return {
    rewardsTable,
    bpsTable: superBpTable
      .sort((bp1, bp2) => bp2.total_staked - bp1.total_staked)
      .map((bp, index) => {
        bp.order = index + 1;
        return bp;
      })
      .concat(
        commonBpTable.sort((bp1, bp2) => bp2.total_staked - bp1.total_staked).map((bp, index) => {
          bp.order = index + 24;
          return bp;
        })
      ),
    bpInfo,
    votesTable,
    stakedTotal,
    unstakingTotal,
    rewardTotal,
    version
  };
};

export const count_asset_total = (available, stakedTotal, unstakingTotal, rewardTotal) => {
  return calcTotalAmount([available, stakedTotal, unstakingTotal, rewardTotal]);
}

export const getAccountInfo = httpEndpoint => async (accountName, current_node, concel_container = {cancel: []}, votesTable, bpsTable, superBpsAmountTable) => {
  const [available, account_base_info] = await Promise.all([getAvailable(httpEndpoint)(accountName), getAccount(httpEndpoint)(accountName)]);
  const reward_res = await getRewardsAndBpsTable(httpEndpoint)(accountName, current_node, concel_container = {cancel: []}, votesTable, bpsTable, superBpsAmountTable);
  bpsTable = reward_res.bpsTable;
  votesTable = reward_res.votesTable;
  const {rewardsTable, bpInfo} = reward_res;

  const stakedTotal = calcTotalAmount(votesTable, 'staked');
  const unstakingTotal = calcTotalAmount(votesTable, 'unstaking');
  const rewardTotal = calcTotalAmount(rewardsTable, 'reward');
  const assetTotal = calcTotalAmount([available, stakedTotal, unstakingTotal, rewardTotal]);

  const info = {
    assetTotal: toAsset(assetTotal), // 资产总额
    available: toAsset(available), // 可用余额
    stakedTotal: toAsset(stakedTotal), // 投票总额
    unstakingTotal: toAsset(unstakingTotal), // 赎回总额
    rewardTotal: toAsset(rewardTotal), // 待领分红总额
    baseInfo: account_base_info
  };

  if (bpInfo) {
    info.bpInfo = bpInfo;
  }

  return {
    info,
    bpsTable,
  };
};

// 创建用户
export const newAccount = config => ({creator, accountName, publicKey, permission}) => {
  return Eos(config)
    .newaccount(creator, accountName, publicKey, publicKey, permission)
    .catch(err => {
      return handleApiError(err);
    });
};

export const transfer = config => {
  return ({ from, to, amount, memo = '', tokenSymbol = 'EOS', precision = '4', permission } = {}) => {
    return Promise.resolve()
      .then(() => {
        return Eos(config)
          .contract(tokenSymbol === 'EOS' ? 'eosio' : 'eosio.token')
          .then(token => {
            return token.transfer(from, to, toAsset(amount, tokenSymbol, { precision }), memo, permission);
          });
      })
      .catch(err => {
        return handleApiError(err);
      });
  };
};

export const vote = config => {
  return ({voter, bpname, amount, permission} = {}) => {
    return Eos(config)
      .vote(voter, bpname, toAsset(amount), permission)
      .catch(err => {
        return handleApiError(err);
      });
  };
};

export const unfreeze = config => {
  return ({ voter, bpname, permission } = {}) => {
    return Eos(config)
      .unfreeze(voter, bpname, permission)
      .catch(err => {
        return handleApiError(err);
      });
  };
};

export const claim = config => {
  return ({ voter, bpname, permission } = {}) => {
    return Eos(config)
      .claim(voter, bpname, permission)
      .catch(err => {
        return handleApiError(err);
      });
  };
};

export const transfer_owner_auth = config => (name, to_public_key, permission) => {
  return new Promise((resolve, reject) => {
    Eos(config)
      .updateauth(name, 'owner', '', to_public_key, permission)
      .then(res => {
        resolve(res);
      })
      .catch(err => {
        handleApiError(err);
        let error_ob = null;
        try {
          error_ob = JSON.parse(err);
        } catch (e) {};
        resolve(error_ob);
      });
  });
};

export const transfer_active_auth = config => (name, to_public_key, permission) => {
  return new Promise((resolve, reject) => {
    Eos(config)
      .updateauth(name, 'active', 'owner', to_public_key, permission)
      .then(res => {
        resolve(res);
      })
      .catch(err => {
        handleApiError(err);
        let error_ob = null;
        try {
          error_ob = JSON.parse(err);
        } catch (e) {};
        resolve(error_ob);
      });
  });
};

export const transfer_account = config => async ({name, publick_key, permissions}) => {
  let res = {
    is_error: false,
    msg: '',
    data: []
  };

  if (permissions.indexOf('active') > -1) {
    let active_transfer_res = await transfer_active_auth(config)(name, publick_key, 'active');
    res.data.push(active_transfer_res);
    res.message = get_error_msg(active_transfer_res);
    if (res.message) {
      res.is_error = true;
      return res;
    }
  }
  if (permissions.indexOf('owner') > -1) {
    let owner_transfer_res = await transfer_owner_auth(config)(name, publick_key, 'owner');
    res.data.push(owner_transfer_res);
    res.message = get_error_msg(owner_transfer_res);
    if (res.message) {
      res.is_error = true;
      return res;
    }
  }
  return res;
};
