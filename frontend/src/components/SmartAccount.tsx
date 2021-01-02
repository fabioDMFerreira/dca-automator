import { DCAAccount } from 'app-domain';
import { ethAddress } from 'consts';
import { formatDate } from 'lib/date';
import { formatPeriod } from 'lib/period';
import { formatTokenAmount, getTokenName } from 'lib/token';
import React, { useState } from 'react';

interface Props {
  account: DCAAccount,
  depositToken: (address: string) => Promise<any>,
  withdrawToken: (address: string) => Promise<any>,
  depositLiquidityPool: (address: string) => Promise<any>,
  withdrawLiquidityPool: (address: string) => Promise<any>
}

export default ({
  account,
  depositToken,
  withdrawToken,
  depositLiquidityPool,
  withdrawLiquidityPool
}: Props) => {

  const [tokenAmt, setTokenAmt] = useState("");
  const [liqPoolAmt, setLiqPoolAmt] = useState("");

  return (
    <div>
      <h3>DCA Contract</h3>
      <div className="row">
        <div className="col-6">
          <p>Address: {account.address}</p>
          <p>Deposit Amount: {formatTokenAmount(account.depositAmount)} {getTokenName(account.token)}</p>
          <p>Period: {formatPeriod(account.period)}</p>
          {
            account.timeRef ?
              <p>Next Deposit: {formatDate(account.timeRef)}</p>
              : ""
          }

        </div>
        <div className="col-6">
          <div className="mb-3">
            <p>Balance: {formatTokenAmount(account.tokenBalance)} {getTokenName(account.token)}</p>
            <div className="form-row">
              <div className="form-group mb-2">
                <input className="form-control" type="number" onChange={e => { setTokenAmt(e.target.value) }} value={tokenAmt} />
              </div>
              <button disabled={!tokenAmt} className="mx-sm-1 mb-2 btn btn-dark" onClick={() => { depositToken(tokenAmt) }}>Deposit</button>
              <button disabled={!tokenAmt} className="mx-sm-1 mb-2 btn btn-dark" onClick={() => { withdrawToken(tokenAmt) }}>Withdraw</button>
            </div>
          </div>

          <div className="mb-3">
            <p>Liquidity Pool Balance: {formatTokenAmount(account.liquidityPoolAmount)} {getTokenName(account.token)}</p>
            <div className="form-row">
              <div className="form-group mb-2">
                <input className="form-control" type="number" onChange={e => { setLiqPoolAmt(e.target.value) }} value={liqPoolAmt} />
              </div>
              <button disabled={!liqPoolAmt} className="mx-sm-1 mb-2 btn btn-dark" onClick={() => { depositLiquidityPool(liqPoolAmt) }}>Deposit</button>
              <button disabled={!liqPoolAmt} className="mx-sm-1 mb-2 btn btn-dark" onClick={() => { withdrawLiquidityPool(liqPoolAmt) }}>Withdraw</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
