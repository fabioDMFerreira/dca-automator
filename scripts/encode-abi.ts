import {  utils } from "ethers";
import instaDSAResolver from "../artifacts/contracts/InstaDSAResolver.sol/InstaDSAResolver.json";

const args = ["0x28f3197712b6F25C752D1675abcFFD9037D3EB95",[]];

const ifc = new utils.Interface(instaDSAResolver.abi)

const funcFrags = ifc.getFunction("")

console.log(ifc.encodeFunctionData(funcFrags, args));
