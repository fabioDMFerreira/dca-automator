import React from 'react';

interface Props {
  activeSmartAccount?: string,
  smartAccounts: string[],
  setActive: (account: string) => void
}

export default ({ activeSmartAccount, smartAccounts, setActive }: Props) => (
  <ul className="list-group">
    {
      smartAccounts.map(
        acc => (
          <li
            key={acc}
            onClick={() => setActive(acc)}
            className={
              `list-group-item ${activeSmartAccount === acc ? "active" : ""
              }`}
          >
            {acc}
          </li>
        )
      )
    }
  </ul>
)
