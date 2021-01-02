export interface DCAAccount {
  address: string,
  timeRef: Date,
  period: number,
  token: string,
  tokenBalance: number,
  ethBalance: number,
  depositAmount: number,
  liquidityPoolAmount: number
}
