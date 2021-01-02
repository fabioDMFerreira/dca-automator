import { DCAAccount } from 'app-domain';
import { formatDate } from 'lib/date';
import { formatPeriod } from 'lib/period';
import { formatTokenAmount, getTokenName } from 'lib/token';
import React from 'react';

interface Props {
  activeSmartAccount?: string,
  smartAccounts: DCAAccount[],
  setActive: (account: string) => void,
  loading: boolean
}

export default ({ activeSmartAccount, smartAccounts, setActive, loading }: Props) => (
  <div>
    <table className="table table-bordered">
      <thead>
        <tr>
          <td className="table-secondary">Amount</td>
          <td className="table-secondary">Period</td>
          <td className="table-secondary">Next Deposit</td>
          <td>Balance</td>
          <td><span title="Liquidity Pool">LP</span> Balance</td>
        </tr>
      </thead>
      <tbody>
        {
          smartAccounts.map(
            acc => (
              <tr
                key={acc.address}
                onClick={() => setActive(acc.address)}
                className={
                  `${activeSmartAccount === acc.address ? "table-primary" : ""
                  }` + `
              ${acc.tokenBalance < acc.depositAmount ? "table-danger" : ""}
              `}
                title={acc.tokenBalance < acc.depositAmount ? "You need to deposit the token, so DCA can happen" : ""}
              >
                <td className="table-secondary">{formatTokenAmount(acc.depositAmount)} {getTokenName(acc.token)}</td>
                <td className="table-secondary">{formatPeriod(acc.period)}</td>
                <td className="table-secondary">{formatDate(acc.timeRef)}</td>
                <td>{formatTokenAmount(acc.tokenBalance)} {getTokenName(acc.token)}</td>
                <td>{formatTokenAmount(acc.liquidityPoolAmount)} {getTokenName(acc.token)}</td>
              </tr>
            )
          )
        }
      </tbody>
    </table>
    {
      !smartAccounts || !smartAccounts.length && !loading &&
      <h5 className="text-secondary">
        <em>Create your first DCA contract.</em>
      </h5>
    }
  </div>
)
