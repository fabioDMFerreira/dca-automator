import React, { useState } from 'react';

interface Props {
  address: string,
  checkAddressAuthorized: (address: string) => Promise<boolean>
}

export default ({ address, checkAddressAuthorized }: Props) => {
  const [checkAddress, setCheckAddress] = useState("")
  const [checkAddressFeedback, setCheckAddressFeedback] = useState("")

  return (
    <div className="col-6">
      <h3>Account</h3>
      <p>Address: {address}</p>
      <div>
        <p>Check address is authorized to use account</p>
        <input
          className="form-control"
          type="text"
          value={checkAddress}
          onChange={e =>{
             setCheckAddress(e.target.value)
             setCheckAddressFeedback("")
          }}
        />
        <button
          className="btn btn-small btn-info"
          onClick={async () => {
            const enabled = await checkAddressAuthorized(checkAddress || "")

            if (enabled) {
              setCheckAddressFeedback("Address is authorized!")
            } else {
              setCheckAddressFeedback("Unfortunately, the address is not authorized!")
            }
          }}>
          Check
          </button>
          {checkAddressFeedback}
        {}
      </div>
    </div>
  )
}
