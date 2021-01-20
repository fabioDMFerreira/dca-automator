import { deployContracts } from "../deploy-contracts/deploy-contracts";
import { accountsSeed } from "./accounts-seed"

deployContracts()
  .then(contracts => accountsSeed(contracts))
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
