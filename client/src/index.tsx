import React from "react";
import ReactDOM from "react-dom";
import Dapp  from "./components/Dapp";

import "bootstrap/dist/css/bootstrap.css";

declare global {
  interface Window { ethereum: any; }
}

window.ethereum = window.ethereum || {};

ReactDOM.render(
  <React.StrictMode>
    <Dapp />
  </React.StrictMode>,
  document.getElementById("root")
);
