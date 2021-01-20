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

  const [changingBalance, setChangingBalance] = useState<boolean>(false)
  const [changingBalanceErr, setChangingBalanceErr] = useState("")

  const [changingLiqPoolBalance, setChangingLiqPoolBalance] = useState<boolean>(false)
  const [changingLiqPoolBalanceErr, setChangingLiqPoolBalanceErr] = useState("")

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
              <button
                disabled={!tokenAmt || changingBalance}
                className="mx-sm-1 mb-2 btn btn-dark"
                onClick={async () => {
                  setChangingBalanceErr("")
                  setChangingBalance(true);

                  try {
                    await depositToken(tokenAmt)
                  } catch (err) {
                    setChangingBalanceErr(err.message)
                  }

                  setChangingBalance(false)
                }}>Deposit</button>
              <button
                disabled={!tokenAmt || changingBalance}
                className="mx-sm-1 mb-2 btn btn-dark"
                onClick={async () => {
                  setChangingBalanceErr("")
                  setChangingBalance(true);

                  try {
                    await withdrawToken(tokenAmt)
                  } catch (err) {
                    setChangingBalanceErr(err.message)
                  }

                  setChangingBalance(false)
                }}>Withdraw</button>
            </div>
            {
              changingBalanceErr ?
                <p className="invalid-feedback">{changingBalanceErr}</p> : ''
            }
          </div>

          <div className="mb-3">
            <p>Liquidity Pool Balance: {formatTokenAmount(account.liquidityPoolAmount)} {getTokenName(account.token)}</p>
            <div className="form-row">
              <div className="form-group mb-2">
                <input className="form-control" type="number" onChange={e => { setLiqPoolAmt(e.target.value) }} value={liqPoolAmt} />
              </div>
              <button
                disabled={!liqPoolAmt || changingLiqPoolBalance}
                className="mx-sm-1 mb-2 btn btn-dark"
                onClick={async () => {
                  setChangingLiqPoolBalanceErr("")
                  setChangingLiqPoolBalance(true);

                  try {
                    await depositLiquidityPool(liqPoolAmt)
                  } catch (err) {
                    setChangingLiqPoolBalanceErr(err.message)
                  }

                  setChangingLiqPoolBalance(false)
                }}>Deposit</button>
              <button
                disabled={!liqPoolAmt || changingLiqPoolBalance}
                className="mx-sm-1 mb-2 btn btn-dark"
                onClick={async () => {
                  setChangingLiqPoolBalanceErr("")
                  setChangingLiqPoolBalance(true);

                  try {
                    await withdrawLiquidityPool(liqPoolAmt)
                  } catch (err) {
                    setChangingLiqPoolBalanceErr(err.message)
                  }

                  setChangingLiqPoolBalance(false)
                }}>Withdraw</button>
              {
                changingLiqPoolBalanceErr ?
                  <p className="invalid-feedback">{changingBalanceErr}</p> : ''
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
