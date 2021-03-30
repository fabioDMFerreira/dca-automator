import { AaveToken } from 'hooks/useAaveResolver';
import { CreateDCAContractPayload } from 'lib/createDCAContract';
import { periods } from 'lib/period';
import React, { useEffect, useState } from 'react';

interface Props {
  buildDCAContract: (payload: CreateDCAContractPayload) => Promise<any>
  tokens: AaveToken[]
}

export default ({ buildDCAContract, tokens }: Props) => {
  const [sellAmount, setSellAmount] = useState<string>("")
  const [token, setToken] = useState<string>("")
  const [period, setPeriod] = useState<string>("3600")
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (tokens.length) {
      setToken(tokens[0].address)
    }
  }, [tokens])

  const [building, setBuilding] = useState<boolean>(false)

  return (
    <form className="form-row jumbotron">
      <div className="form-group mx-sm-3 mb-2">
        <label>Amount</label>
        <input className="form-control" value={sellAmount} type="number" onChange={e => { setSellAmount(e.target.value) }} />
      </div>
      <div className="form-group mx-sm-3 mb-2">
        <label>Token</label>
        <select className="form-control" value={token} onChange={e => { setToken(e.target.value) }}>
          {
            tokens.map(
              token => (
                <option key={token.address} value={token.address}>{token.name}</option>
              )
            )
          }
        </select>
      </div>
      <div className="form-group mx-sm-3 mb-2">
        <label>Period</label>
        <select className="form-control" value={period} onChange={e => { setPeriod(e.target.value) }}>
          {
            periods.map(period => <option value={period.value} key={period.value}>{period.label}</option>)
          }
        </select>
      </div>
      <button disabled={!sellAmount || !period || !token || building} className="btn btn-info" onClick={async () => {
        setError("");
        setBuilding(true)

        try {
          await buildDCAContract({
            sellAmount,
            period: +period,
            token,
          })
        } catch (err) {
          setError(err.message)
        }

        setBuilding(false)
      }}>+ Create</button>
      {
        error ?
          <p className="invalid-feedback">{error}</p> :
          ""
      }
    </form>
  )
}
