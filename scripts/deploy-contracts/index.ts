import { deployContracts } from "./deploy-contracts";

deployContracts()
.then(() => process.exit(0))
.catch((error) => {
  console.error(error);
  process.exit(1);
});
